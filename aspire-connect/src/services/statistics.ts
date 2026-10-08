import { supabase } from '@/lib/supabase';
import { listClasses, listSections } from '@/services/academics';

function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

export interface DayPoint {
  date: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

/** System-wide attendance trend, one point per day, for the last N days. */
export async function getAttendanceTrend(days = 14): Promise<DayPoint[]> {
  const fromStr = daysAgoStr(days);
  const { data, error } = await supabase
    .from('attendance_records')
    .select('status, attendance_sessions!inner(date)')
    .gte('attendance_sessions.date', fromStr);
  if (error) throw error;

  const byDate = new Map<string, { present: number; absent: number }>();
  (data as any[]).forEach((r) => {
    const date = r.attendance_sessions.date as string;
    if (!byDate.has(date)) byDate.set(date, { present: 0, absent: 0 });
    const bucket = byDate.get(date)!;
    if (r.status === 'PRESENT') bucket.present++;
    else if (r.status === 'ABSENT') bucket.absent++;
  });

  const points: DayPoint[] = [];
  const from = new Date(fromStr);
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const bucket = byDate.get(key) ?? { present: 0, absent: 0 };
    const total = bucket.present + bucket.absent;
    const percentage = total > 0 ? Math.round((bucket.present / total) * 1000) / 10 : 0;
    points.push({ date: key, ...bucket, total, percentage });
  }
  return points;
}

export interface SectionStat {
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  total: number;
  present: number;
  percentage: number;
  studentCount: number;
}

/** Per-section attendance comparison over the last N days. */
export async function getSectionComparison(days = 30): Promise<SectionStat[]> {
  const fromStr = daysAgoStr(days);

  const [{ data: records, error: recErr }, { data: students, error: stuErr }, classes, sections] = await Promise.all([
    supabase
      .from('attendance_records')
      .select('status, attendance_sessions!inner(date, section_id)')
      .gte('attendance_sessions.date', fromStr),
    supabase.from('students').select('id, section_id').eq('status', 'ACTIVE'),
    listClasses(),
    listSections(),
  ]);
  if (recErr) throw recErr;
  if (stuErr) throw stuErr;

  const bySection = new Map<string, { present: number; total: number }>();
  (records as any[]).forEach((r) => {
    const sid = r.attendance_sessions.section_id as string;
    if (!bySection.has(sid)) bySection.set(sid, { present: 0, total: 0 });
    const b = bySection.get(sid)!;
    b.total++;
    if (r.status === 'PRESENT') b.present++;
  });

  const studentCounts = new Map<string, number>();
  (students ?? []).forEach((s: any) => studentCounts.set(s.section_id, (studentCounts.get(s.section_id) ?? 0) + 1));

  return sections
    .map((sec) => {
      const cls = classes.find((c) => c.id === sec.class_id);
      const b = bySection.get(sec.id) ?? { present: 0, total: 0 };
      return {
        classId: sec.class_id,
        className: cls?.name ?? '—',
        sectionId: sec.id,
        sectionName: sec.name,
        total: b.total,
        present: b.present,
        percentage: b.total > 0 ? Math.round((b.present / b.total) * 1000) / 10 : 0,
        studentCount: studentCounts.get(sec.id) ?? 0,
      };
    })
    .sort((a, b) => b.percentage - a.percentage);
}

export interface AbsenteeStat {
  studentId: string;
  fullName: string;
  rollNumber: string;
  className: string;
  sectionName: string;
  total: number;
  present: number;
  percentage: number;
}

/** Students with the lowest attendance percentage over the last N days. */
export async function getTopAbsentees(limit = 10, days = 30): Promise<AbsenteeStat[]> {
  const fromStr = daysAgoStr(days);
  const { data, error } = await supabase
    .from('attendance_records')
    .select('status, student_id, students(full_name, roll_number, classes(name), sections(name)), attendance_sessions!inner(date)')
    .gte('attendance_sessions.date', fromStr);
  if (error) throw error;

  const byStudent = new Map<string, { present: number; total: number; info: any }>();
  (data as any[]).forEach((r) => {
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, { present: 0, total: 0, info: r.students });
    const b = byStudent.get(r.student_id)!;
    b.total++;
    if (r.status === 'PRESENT') b.present++;
  });

  return Array.from(byStudent.entries())
    .filter(([, b]) => b.total >= 3) // ignore students with too few records to be meaningful
    .map(([studentId, b]) => ({
      studentId,
      fullName: b.info?.full_name ?? '—',
      rollNumber: b.info?.roll_number ?? '—',
      className: b.info?.classes?.name ?? '—',
      sectionName: b.info?.sections?.name ?? '—',
      total: b.total,
      present: b.present,
      percentage: Math.round((b.present / b.total) * 1000) / 10,
    }))
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, limit);
}

export interface ConcernBreakdown {
  status: string;
  count: number;
}

/** Concern counts by status over the last N days. */
export async function getConcernBreakdown(days = 30): Promise<ConcernBreakdown[]> {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const { data, error } = await supabase.from('student_concerns').select('status').gte('created_at', from.toISOString());
  if (error) throw error;
  const counts: Record<string, number> = {};
  (data ?? []).forEach((c: any) => { counts[c.status] = (counts[c.status] ?? 0) + 1; });
  return Object.entries(counts).map(([status, count]) => ({ status, count }));
}
