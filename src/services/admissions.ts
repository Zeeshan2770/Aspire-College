import { supabase } from '@/lib/supabase';

export type AdmissionStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';

export const ADMISSION_STATUSES: { value: AdmissionStatus; label: string }[] = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
];

export interface Admission {
  id: string;
  application_no: string;
  full_name: string;
  father_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  email: string | null;
  address: string;
  previous_institution: string | null;
  previous_class: string | null;
  percentage: number | null;
  board: string | null;
  passing_year: number | null;
  program_applied: string;
  preferred_class: string | null;
  guardian_name: string;
  guardian_relationship: string | null;
  guardian_phone: string;
  status: AdmissionStatus;
  reviewed_at: string | null;
  student_id: string | null;
  created_at: string;
}

export interface AdmissionNote {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Characters that would break a PostgREST or() filter, or act as LIKE wildcards.
const clean = (s: string) => s.replace(/[,()%_*\\]/g, ' ').trim();

export async function listAdmissions(opts: { search: string; status: string; page: number; pageSize: number }) {
  let q = supabase.from('admissions').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  const term = clean(opts.search);
  if (term) q = q.or(`full_name.ilike.%${term}%,application_no.ilike.%${term}%,phone.ilike.%${term}%`);
  const from = (opts.page - 1) * opts.pageSize;
  const { data, count, error } = await q.range(from, from + opts.pageSize - 1);
  if (error) throw new Error('Unable to load applications. Please try again.');
  return { rows: (data ?? []) as Admission[], total: count ?? 0 };
}

export async function admissionStatusCounts(): Promise<Record<AdmissionStatus, number>> {
  const out = { SUBMITTED: 0, UNDER_REVIEW: 0, ACCEPTED: 0, REJECTED: 0 } as Record<AdmissionStatus, number>;
  await Promise.all(
    ADMISSION_STATUSES.map(async ({ value }) => {
      const { count } = await supabase.from('admissions').select('id', { count: 'exact', head: true }).eq('status', value);
      out[value] = count ?? 0;
    })
  );
  return out;
}

export async function listAdmissionNotes(admissionId: string): Promise<AdmissionNote[]> {
  const { data, error } = await supabase
    .from('admission_notes')
    .select('id, author_name, body, created_at')
    .eq('admission_id', admissionId)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Unable to load notes.');
  return (data ?? []) as AdmissionNote[];
}

function rpcError(e: { message?: string }): Error {
  // Database functions raise readable messages; strip the internal prefix.
  return new Error((e.message ?? 'Request failed.').replace(/^PERMISSION_DENIED:\s*/, ''));
}

export async function updateAdmissionStatus(id: string, status: AdmissionStatus, note?: string) {
  const { error } = await supabase.rpc('update_admission_status', { p_id: id, p_status: status, p_note: note ?? null });
  if (error) throw rpcError(error);
}

export async function addAdmissionNote(id: string, body: string) {
  const { error } = await supabase.rpc('add_admission_note', { p_id: id, p_body: body });
  if (error) throw rpcError(error);
}

export async function createStudentFromAdmission(input: {
  admissionId: string;
  classId: string;
  sectionId: string;
  rollNumber: string;
  sessionLabel?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_student_from_admission', {
    p_admission_id: input.admissionId,
    p_class_id: input.classId,
    p_section_id: input.sectionId,
    p_roll_number: input.rollNumber,
    p_session_label: input.sessionLabel ?? null,
  });
  if (error) throw rpcError(error);
  return (data as { student_id: string }).student_id;
}

export async function listClassesAndSections() {
  const [c, s] = await Promise.all([
    supabase.from('classes').select('id, name').order('name'),
    supabase.from('sections').select('id, name, class_id').order('name'),
  ]);
  if (c.error || s.error) throw new Error('Unable to load classes.');
  return { classes: c.data ?? [], sections: s.data ?? [] };
}

export async function listInquiries(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  const { data, count, error } = await supabase
    .from('contact_messages')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error('Unable to load inquiries. Please try again.');
  return { rows: (data ?? []) as ContactMessage[], total: count ?? 0 };
}

export async function unreadInquiryCount(): Promise<number> {
  const { count } = await supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('is_read', false);
  return count ?? 0;
}

export async function setInquiryRead(id: string, isRead: boolean) {
  const { error } = await supabase.from('contact_messages').update({ is_read: isRead }).eq('id', id);
  if (error) throw new Error('Unable to update the message.');
}
