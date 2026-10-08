import { supabase } from '@/lib/supabase';
import { AttendanceStatus } from '@/types';

export async function findExistingSession(sectionId: string, date: string) {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('section_id', sectionId)
    .eq('date', date)
    .is('lecture_number', null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createAttendanceSession(input: {
  classId: string;
  sectionId: string;
  date: string;
  takenBy: string;
  /** 'MANUAL' (default) or 'OCR_SCAN' — provenance only, purely informational. */
  source?: 'MANUAL' | 'OCR_SCAN';
}) {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .insert({
      class_id: input.classId,
      section_id: input.sectionId,
      date: input.date,
      taken_by: input.takenBy,
      source: input.source ?? 'MANUAL',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveAttendanceRecords(
  sessionId: string,
  records: { studentId: string; status: AttendanceStatus }[]
) {
  const rows = records.map((r) => ({
    attendance_session_id: sessionId,
    student_id: r.studentId,
    status: r.status,
  }));
  const { error } = await supabase.from('attendance_records').insert(rows);
  if (error) throw error;
}

export async function listSessionHistory(sectionId: string, limit = 50) {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('section_id', sectionId)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * Admin-facing session browser: lists attendance sessions for a specific
 * class/section (or across a class, or the whole system) with optional
 * date bounds — used by Principal / Sub Super Admin / Main Super Admin to
 * drill into real attendance data instead of only aggregate figures.
 */
export async function listSessionsFiltered(params: {
  sectionId?: string;
  classId?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  let query = supabase
    .from('attendance_sessions')
    .select('*, classes(name), sections(name)')
    .order('date', { ascending: false });
  if (params.sectionId) query = query.eq('section_id', params.sectionId);
  else if (params.classId) query = query.eq('class_id', params.classId);
  if (params.from) query = query.gte('date', params.from);
  if (params.to) query = query.lte('date', params.to);
  if (params.limit) query = query.limit(params.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Per-student attendance roster for a class and/or section, over an
 * optional date range — the "real data, not just figures" view used in
 * admin reports and the attendance viewer.
 */
export async function studentRosterStats(params: {
  classId?: string;
  sectionId?: string;
  from?: string;
  to?: string;
}) {
  let studentQuery = supabase
    .from('students')
    .select('id, full_name, roll_number, class_id, section_id, status, classes(name), sections(name)')
    .order('roll_number');
  if (params.sectionId) studentQuery = studentQuery.eq('section_id', params.sectionId);
  else if (params.classId) studentQuery = studentQuery.eq('class_id', params.classId);
  const { data: students, error } = await studentQuery;
  if (error) throw error;

  const results = await Promise.all(
    (students ?? []).map(async (s: any) => {
      const stats = await studentAttendanceStats(s.id, params.from, params.to);
      return { student: s, stats };
    })
  );
  return results;
}

export async function sessionSummary(sessionId: string) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('status, student_id, students(full_name, roll_number)')
    .eq('attendance_session_id', sessionId);
  if (error) throw error;
  return data;
}

/**
 * Looks up the single daily attendance session for a section/date (if one
 * was taken) and returns a student_id → status map — the building block
 * for "daily" reports (as opposed to all-time/date-range aggregates).
 * Returns null if attendance wasn't taken for that section on that date.
 */
export async function dailySessionStatusMap(sectionId: string, date: string): Promise<Record<string, AttendanceStatus> | null> {
  const session = await findExistingSession(sectionId, date);
  if (!session) return null;
  const rows = await sessionSummary(session.id);
  const map: Record<string, AttendanceStatus> = {};
  (rows as any[]).forEach((r) => {
    if (r.student_id) map[r.student_id] = r.status;
  });
  return map;
}

export async function studentAttendanceStats(studentId: string, from?: string, to?: string) {
  let query = supabase
    .from('attendance_records')
    .select('status, attendance_sessions!inner(date)')
    .eq('student_id', studentId);
  if (from) query = query.gte('attendance_sessions.date', from);
  if (to) query = query.lte('attendance_sessions.date', to);
  const { data, error } = await query;
  if (error) throw error;

  const total = data.length;
  // Kept generic (not narrowed to just PRESENT/ABSENT) so historical
  // sessions recorded before attendance was simplified — which may still
  // carry LATE/LEAVE — are still counted correctly in the total/percentage
  // instead of silently dropped.
  const counts: Record<string, number> = { PRESENT: 0, ABSENT: 0 };
  data.forEach((r: any) => {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  });
  const percentage = total > 0 ? Math.round((counts.PRESENT / total) * 1000) / 10 : 0;
  return { total, counts, percentage };
}

export async function todaysStats(sectionId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: sessions, error } = await supabase
    .from('attendance_sessions')
    .select('id')
    .eq('section_id', sectionId)
    .eq('date', today);
  if (error) throw error;
  if (!sessions.length) return { sessions: 0, present: 0, absent: 0 };

  const ids = sessions.map((s) => s.id);
  const { data: records, error: recErr } = await supabase
    .from('attendance_records')
    .select('status')
    .in('attendance_session_id', ids);
  if (recErr) throw recErr;

  const present = records.filter((r) => r.status === 'PRESENT').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  return { sessions: sessions.length, present, absent };
}
