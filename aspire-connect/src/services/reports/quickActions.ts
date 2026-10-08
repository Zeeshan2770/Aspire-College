import { supabase } from '@/lib/supabase';
import { Student } from '@/types';
import { getSettings } from '@/services/settings';
import { resolveBranding } from '@/services/reportBranding';
import { dailySessionStatusMap } from '@/services/attendance';
import { generatePdfReport, PdfReportOptions } from '@/services/reports/pdf';
import { generateJpgReport, JpgReportOptions } from '@/services/reports/jpg';

/**
 * One-click report generators. Every function here builds the report and
 * triggers an immediate download — no preview step, no form to fill in —
 * so they're safe to wire straight to a single button. They throw a plain
 * `Error` with a user-facing message on failure (e.g. "not taken yet"),
 * which callers should catch and surface via toast.
 */

export type QuickFormat = 'pdf' | 'jpg';

type DeliverableOptions = Omit<PdfReportOptions, 'filename'> & Omit<JpgReportOptions, 'filename'> & { filename: string };

async function deliver(format: QuickFormat, opts: DeliverableOptions) {
  if (format === 'pdf') await generatePdfReport(opts);
  else await generateJpgReport(opts);
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatStatus(status?: string) {
  if (!status) return 'Not Marked';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * CR one-click "Today's Attendance Report" for their currently active
 * section — every student in the section with today's Present/Absent
 * status. Mirrors the "Daily Class Report" available in the full CR
 * Reports form, but skips the period toggle, date picker, and preview
 * step entirely.
 */
export async function quickTodayClassReport(params: {
  classId: string;
  sectionId: string;
  className?: string;
  sectionName?: string;
  format: QuickFormat;
}) {
  const date = todayStr();
  const [statusMap, { data: students, error }] = await Promise.all([
    dailySessionStatusMap(params.sectionId, date),
    supabase.from('students').select('*').eq('section_id', params.sectionId).order('roll_number'),
  ]);
  if (error) throw error;
  if (!statusMap) throw new Error(`Attendance hasn't been taken for today (${date}) yet.`);

  const [settings, branding] = await Promise.all([
    getSettings(),
    resolveBranding(params.classId, params.sectionId),
  ]);

  const columns = ['Roll #', 'Name', 'Status'];
  const rows = ((students as Student[]) ?? []).map((s) => [s.roll_number, s.full_name, formatStatus(statusMap[s.id])]);
  const subtitle = [params.className && `Class: ${params.className}`, params.sectionName && `Section: ${params.sectionName}`]
    .filter(Boolean)
    .join(' | ');

  await deliver(params.format, {
    title: "Today's Class Attendance Report",
    subtitle,
    dateRange: date,
    columns,
    rows,
    settings,
    branding,
    filename: `class-attendance-daily-${date}`,
  });
}

/** Shared row-builder for the admin-facing, all-sections attendance report over a date range. */
async function systemAttendanceRows(from: string, to: string) {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('date, section_id, sections(name), classes(name), attendance_records(status)')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s: any) => {
    const present = s.attendance_records.filter((r: any) => r.status === 'PRESENT').length;
    const absent = s.attendance_records.filter((r: any) => r.status === 'ABSENT').length;
    return [s.date, s.classes?.name ?? '', s.sections?.name ?? '', present, absent];
  });
}

/**
 * Super Admin one-click attendance report across every class and section
 * for an arbitrary trailing window (`days` = 1 gives "today"). Used by the
 * Quick Reports bar on the admin Reports page and dashboard.
 */
export async function quickSystemAttendanceReport(params: { days: number; label: string; format: QuickFormat }) {
  const to = todayStr();
  const from = params.days <= 1 ? to : daysAgoStr(params.days - 1);
  const rows = await systemAttendanceRows(from, to);
  if (rows.length === 0) throw new Error(`No attendance has been recorded between ${from} and ${to} yet.`);

  const [settings, branding] = await Promise.all([getSettings(), resolveBranding(null, null)]);

  await deliver(params.format, {
    title: 'Attendance Report',
    subtitle: `All Classes & Sections — ${params.label}`,
    dateRange: from === to ? from : `${from} to ${to}`,
    columns: ['Date', 'Class', 'Section', 'Present', 'Absent'],
    rows,
    settings,
    branding,
    filename: `attendance-report-${from}_to_${to}`,
  });
}

/**
 * Super Admin one-click "Today's Student Concerns" report — every concern
 * logged today across the whole system.
 */
export async function quickTodayConcernsReport(format: QuickFormat) {
  const date = todayStr();
  const { data, error } = await supabase
    .from('student_concerns')
    .select('created_at, concern_type, status, students(full_name, roll_number), classes(name), sections(name)')
    .gte('created_at', `${date}T00:00:00`)
    .lte('created_at', `${date}T23:59:59.999`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`No concerns have been logged today (${date}) yet.`);

  const rows = data.map((c: any) => [
    new Date(c.created_at).toLocaleDateString(),
    c.students?.full_name ?? '',
    c.students?.roll_number ?? '',
    c.classes?.name ?? '',
    c.sections?.name ?? '',
    c.concern_type,
    c.status,
  ]);

  const [settings, branding] = await Promise.all([getSettings(), resolveBranding(null, null)]);

  await deliver(format, {
    title: "Today's Student Concern Report",
    subtitle: `All Classes & Sections — ${date}`,
    columns: ['Date', 'Student', 'Roll #', 'Class', 'Section', 'Concern', 'Status'],
    rows,
    settings,
    branding,
    filename: `concern-report-${date}`,
  });
}
