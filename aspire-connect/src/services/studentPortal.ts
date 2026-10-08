import { supabase } from '@/lib/supabase';
import { AttendanceStatus } from '@/types';

export interface MyStudentRecord {
  id: string;
  full_name: string;
  father_name: string | null;
  roll_number: string;
  student_uid: string | null;
  session_label: string | null;
  class_id: string;
  section_id: string;
  classes: { name: string } | null;
  sections: { name: string } | null;
}

/** The signed-in student's own academic record — RLS (`user_id = auth.uid()`) guarantees this can never resolve to anyone else's row. */
export async function getMyStudentRecord(): Promise<MyStudentRecord | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, father_name, roll_number, student_uid, session_label, class_id, section_id, classes(name), sections(name)')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

interface RawAttendanceRow {
  status: AttendanceStatus;
  attendance_sessions: { date: string; subject: string | null } | null;
}

export interface SubjectAttendance {
  subject: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
}

export interface AttendanceHistoryEntry {
  date: string;
  subject: string | null;
  status: AttendanceStatus;
}

export interface AttendanceSummary {
  totalLectures: number;
  present: number;
  absent: number;
  percentage: number;
  bySubject: SubjectAttendance[];
  recent: AttendanceHistoryEntry[];
  /** True once every session on record has no subject — i.e. attendance was taken entirely under the current simplified one-mark-a-day model, so a subject breakdown wouldn't mean anything. */
  subjectDataAvailable: boolean;
}

/** Computes attendance stats purely from the existing, authoritative attendance_records/attendance_sessions tables — never a separate student-side copy. */
export async function getMyAttendanceSummary(studentId: string): Promise<AttendanceSummary> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('status, attendance_sessions(date, subject)')
    .eq('student_id', studentId);
  if (error) throw error;

  const rows = (data as unknown as RawAttendanceRow[]).filter((r) => r.attendance_sessions);
  const totalLectures = rows.length;
  const present = rows.filter((r) => r.status === 'PRESENT').length;
  const absent = rows.filter((r) => r.status === 'ABSENT').length;
  const percentage = totalLectures ? Math.round((present / totalLectures) * 1000) / 10 : 0;

  const subjectDataAvailable = rows.some((r) => r.attendance_sessions?.subject);
  const bySubjectMap = new Map<string, { total: number; present: number; absent: number }>();
  if (subjectDataAvailable) {
    for (const r of rows) {
      const subject = r.attendance_sessions?.subject;
      if (!subject) continue; // sessions taken under the current daily model simply aren't part of the subject-wise view
      const entry = bySubjectMap.get(subject) ?? { total: 0, present: 0, absent: 0 };
      entry.total++;
      if (r.status === 'PRESENT') entry.present++;
      if (r.status === 'ABSENT') entry.absent++;
      bySubjectMap.set(subject, entry);
    }
  }
  const bySubject: SubjectAttendance[] = Array.from(bySubjectMap.entries())
    .map(([subject, v]) => ({ subject, ...v, percentage: v.total ? Math.round((v.present / v.total) * 1000) / 10 : 0 }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const recent: AttendanceHistoryEntry[] = rows
    .map((r) => ({ date: r.attendance_sessions!.date, subject: r.attendance_sessions!.subject, status: r.status }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 20);

  return { totalLectures, present, absent, percentage, bySubject, recent, subjectDataAvailable };
}
