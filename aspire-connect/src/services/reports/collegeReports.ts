import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import { getSettings } from '@/services/settings';
import { resolveBranding } from '@/services/reportBranding';
import { generatePdfReport } from '@/services/reports/pdf';

export type CollegeReportFormat = 'pdf' | 'csv';

function downloadCsv(filename: string, columns: string[], rows: (string | number)[][]) {
  // BOM so Excel opens non-English text correctly.
  const csv = '\uFEFF' + Papa.unparse({ fields: columns, data: rows });
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function deliver(
  format: CollegeReportFormat,
  opts: { title: string; subtitle?: string; dateRange?: string; columns: string[]; rows: (string | number)[][]; filename: string }
) {
  if (format === 'csv') return downloadCsv(opts.filename, opts.columns, opts.rows);
  const [settings, branding] = await Promise.all([getSettings(), resolveBranding(null, null)]);
  await generatePdfReport({ ...opts, settings, branding });
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB');
const STATUS_LABEL: Record<string, string> = { SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review', ACCEPTED: 'Accepted', REJECTED: 'Rejected' };

export async function admissionsReport(params: { status: string; from: string; to: string; format: CollegeReportFormat }) {
  let q = supabase
    .from('admissions')
    .select('application_no, full_name, father_name, phone, program_applied, percentage, status, created_at')
    .order('created_at', { ascending: false })
    .range(0, 4999);
  if (params.status) q = q.eq('status', params.status);
  if (params.from) q = q.gte('created_at', `${params.from}T00:00:00`);
  if (params.to) q = q.lte('created_at', `${params.to}T23:59:59.999`);
  const { data, error } = await q;
  if (error) throw new Error('Unable to load admission applications.');
  if (!data?.length) throw new Error('No applications match these filters.');

  const rows = data.map((a) => [
    a.application_no, a.full_name, a.father_name, a.phone, a.program_applied,
    a.percentage ?? '', STATUS_LABEL[a.status] ?? a.status, day(a.created_at),
  ]);
  const range = params.from || params.to ? `${params.from || 'start'} to ${params.to || 'today'}` : undefined;
  await deliver(params.format, {
    title: 'Admission Applications',
    subtitle: params.status ? `Status: ${STATUS_LABEL[params.status]}` : 'All statuses',
    dateRange: range,
    columns: ['Application No', 'Applicant', "Father's Name", 'Phone', 'Program', '%', 'Status', 'Submitted'],
    rows,
    filename: `admission-applications-${new Date().toISOString().slice(0, 10)}`,
  });
}

export async function facultyReport(params: { status: string; format: CollegeReportFormat }) {
  let q = supabase
    .from('faculty')
    .select('full_name, designation, department, subject, qualification, email, phone, status')
    .order('department', { nullsFirst: false })
    .order('full_name')
    .range(0, 1999);
  if (params.status) q = q.eq('status', params.status);
  const { data, error } = await q;
  if (error) throw new Error('Unable to load faculty.');
  if (!data?.length) throw new Error('No faculty members match these filters.');

  const rows = data.map((f) => [
    f.full_name, f.designation ?? '', f.department ?? '', f.subject ?? '', f.qualification ?? '',
    f.email ?? '', f.phone ?? '', f.status === 'ACTIVE' ? 'Active' : 'Inactive',
  ]);
  await deliver(params.format, {
    title: 'Faculty List',
    subtitle: params.status ? (params.status === 'ACTIVE' ? 'Active faculty' : 'Inactive faculty') : 'All faculty',
    columns: ['Name', 'Designation', 'Department', 'Subject', 'Qualification', 'Email', 'Phone', 'Status'],
    rows,
    filename: `faculty-list-${new Date().toISOString().slice(0, 10)}`,
  });
}
