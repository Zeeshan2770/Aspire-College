import { supabase } from '@/lib/supabase';

export type QueryStatus = 'NEW' | 'IN_PROGRESS' | 'ANSWERED' | 'CLOSED';
export type Identity = 'STUDENT' | 'PARENT' | 'TEACHER' | 'APPLICANT' | 'ALUMNI' | 'OTHER';
export type Visibility = 'FULL' | 'NAME_ONLY' | 'ANONYMOUS';

export const QUERY_STATUSES: { value: QueryStatus; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'ANSWERED', label: 'Answered' },
  { value: 'CLOSED', label: 'Closed' },
];
export const statusLabel = (s: string) => QUERY_STATUSES.find((x) => x.value === s)?.label ?? s;

export const IDENTITIES: { value: Identity; label: string; hint: string }[] = [
  { value: 'STUDENT', label: 'Student', hint: 'I study at the college' },
  { value: 'PARENT', label: 'Parent / Guardian', hint: 'My child studies here' },
  { value: 'APPLICANT', label: 'Prospective student', hint: 'I want to join' },
  { value: 'TEACHER', label: 'Teacher / Staff', hint: 'I work at the college' },
  { value: 'ALUMNI', label: 'Former student', hint: 'I studied here before' },
  { value: 'OTHER', label: 'Other', hint: 'Anyone else' },
];
export const identityLabel = (v: string) => IDENTITIES.find((x) => x.value === v)?.label ?? v;

export const VISIBILITIES: { value: Visibility; label: string; hint: string }[] = [
  { value: 'FULL', label: 'Share my details', hint: 'Name and a way to reach you. The college can reply to you directly.' },
  { value: 'NAME_ONLY', label: 'Name only', hint: 'Only your name is saved. Follow the answer with your tracking code.' },
  { value: 'ANONYMOUS', label: 'Anonymous', hint: 'Nothing about you is saved. Follow the answer with your tracking code.' },
];
export const visibilityLabel = (v: string) => VISIBILITIES.find((x) => x.value === v)?.label ?? v;

/** Topics are fixed here so the public form never depends on a database list. */
export const QUERY_TOPICS = [
  'Admissions', 'Fees and scholarships', 'Academics and timetable', 'Examinations and results', 'Attendance',
  'Facilities', 'Teacher or staff concern', 'Complaint', 'Suggestion', 'Safety or welfare', 'Other',
];

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export interface QueryAttachment { path: string; name: string; size: number; type: string }

export interface PublicQueryInput {
  identity_type: Identity; visibility: Visibility; name: string; email: string; phone: string; roll_no: string; class_name: string;
  category: string; subject: string; message: string; website: string;
}

const BUCKET = 'query-attachments';

/** Uploads one file to the private bucket. Only management can read it afterwards. */
export async function uploadQueryFile(file: File): Promise<QueryAttachment> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error('Please attach a JPG, PNG, WebP image or a PDF.');
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 5 MB.`);
  const path = `incoming/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Could not upload ${file.name}. Please try again.`);
  return { path, name: file.name, size: file.size, type: file.type };
}

export async function submitQuery(input: PublicQueryInput, attachments: QueryAttachment[]): Promise<string> {
  const { data, error } = await supabase.rpc('submit_query', { payload: { ...input, attachments } });
  if (error) {
    const raw = error.message ?? '';
    // Friendly text for "function/table missing" (script not run yet); otherwise the database's own readable message.
    if (/submit_query|schema cache|does not exist/i.test(raw)) throw new Error('The question box is not switched on yet. Please contact the college directly.');
    throw new Error(raw || 'Unable to send your question. Please try again.');
  }
  return (data as { code: string }).code;
}

export interface TrackedQuery {
  code: string; status: QueryStatus; category: string; subject: string; message: string; created_at: string;
  replies: { body: string; created_at: string }[];
}
export async function trackQuery(code: string): Promise<TrackedQuery | null> {
  const { data, error } = await supabase.rpc('track_query', { p_code: code });
  if (error) throw new Error(/unsuccessful|wait a few minutes/i.test(error.message ?? '') ? error.message : 'Unable to look up this code. Please try again.');
  return (data as TrackedQuery | null) ?? null;
}

/* ------------------------------ Management ------------------------------ */

export interface QueryRow {
  id: string; code: string; identity_type: Identity; visibility: Visibility; name: string | null; email: string | null; phone: string | null;
  roll_no: string | null; class_name: string | null; category: string; subject: string; message: string;
  attachments: QueryAttachment[]; status: QueryStatus; created_at: string; updated_at: string;
}
export interface QueryReply { id: string; body: string; is_public: boolean; created_at: string; author_name: string | null }

const clean = (s: string) => s.replace(/[,()%_*\\]/g, ' ').trim();

export async function listQueries(opts: { search: string; status: string; page: number; pageSize: number }) {
  let q = supabase.from('public_queries').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  const term = clean(opts.search);
  if (term) q = q.or(`subject.ilike.%${term}%,code.ilike.%${term}%,name.ilike.%${term}%`);
  const from = (opts.page - 1) * opts.pageSize;
  const { data, count, error } = await q.range(from, from + opts.pageSize - 1);
  if (error) throw new Error('Unable to load questions. Please try again.');
  return { rows: (data ?? []) as QueryRow[], total: count ?? 0 };
}

export async function queryStatusCounts(): Promise<Record<QueryStatus, number>> {
  const out = { NEW: 0, IN_PROGRESS: 0, ANSWERED: 0, CLOSED: 0 } as Record<QueryStatus, number>;
  await Promise.all(QUERY_STATUSES.map(async ({ value }) => {
    const { count } = await supabase.from('public_queries').select('id', { count: 'exact', head: true }).eq('status', value);
    out[value] = count ?? 0;
  }));
  return out;
}

export async function newQueryCount(): Promise<number> {
  const { count } = await supabase.from('public_queries').select('id', { count: 'exact', head: true }).eq('status', 'NEW');
  return count ?? 0;
}

export async function listReplies(queryId: string): Promise<QueryReply[]> {
  const withAuthor = await supabase.from('query_replies').select('id, body, is_public, created_at, author:profiles(full_name)').eq('query_id', queryId).order('created_at');
  if (!withAuthor.error) {
    return (withAuthor.data ?? []).map((r) => {
      const a = (r as unknown as { author: { full_name: string | null } | { full_name: string | null }[] | null }).author;
      const name = Array.isArray(a) ? a[0]?.full_name : a?.full_name;
      return { id: r.id as string, body: r.body as string, is_public: r.is_public as boolean, created_at: r.created_at as string, author_name: name ?? null };
    });
  }
  const plain = await supabase.from('query_replies').select('id, body, is_public, created_at').eq('query_id', queryId).order('created_at');
  if (plain.error) throw new Error('Unable to load replies.');
  return (plain.data ?? []).map((r) => ({ ...(r as Omit<QueryReply, 'author_name'>), author_name: null }));
}

export async function setQueryStatus(id: string, status: QueryStatus) {
  const { error } = await supabase.from('public_queries').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error('Unable to change the status.');
}

/** Adds a reply. A public reply (visible to the person who asked) also marks the question as answered. */
export async function addReply(query: Pick<QueryRow, 'id' | 'status'>, body: string, isPublic: boolean) {
  const { error } = await supabase.from('query_replies').insert({ query_id: query.id, body, is_public: isPublic });
  if (error) throw new Error('Unable to save the reply.');
  if (isPublic && (query.status === 'NEW' || query.status === 'IN_PROGRESS')) await setQueryStatus(query.id, 'ANSWERED');
}

export async function deleteQuery(q: Pick<QueryRow, 'id' | 'attachments'>) {
  const paths = (q.attachments ?? []).map((a) => a.path);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from('public_queries').delete().eq('id', q.id);
  if (error) throw new Error('Unable to delete the question.');
}

/** Short-lived link to a private attachment (management only). */
export async function attachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) throw new Error('Unable to open the attachment.');
  return data.signedUrl;
}

/**
 * Removes files that visitors uploaded but never attached to a question (for example they closed the page before sending).
 * Only files older than one day are touched. Run again if it says more may remain.
 */
export async function cleanupUnusedUploads(): Promise<{ removed: number; more: boolean }> {
  const listed = await supabase.storage.from(BUCKET).list('incoming', { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });
  if (listed.error) throw new Error('Unable to check the uploads. Please try again.');
  const files = listed.data ?? [];
  const used = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('public_queries').select('attachments').range(from, from + 999);
    if (error) throw new Error('Unable to check the questions. Please try again.');
    (data ?? []).forEach((r) => ((r.attachments as QueryAttachment[]) ?? []).forEach((a) => used.add(a.path)));
    if ((data ?? []).length < 1000) break;
  }
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const stale = files.filter((f) => f.created_at && +new Date(f.created_at) < cutoff && !used.has(`incoming/${f.name}`)).map((f) => `incoming/${f.name}`);
  if (stale.length) {
    const { error } = await supabase.storage.from(BUCKET).remove(stale);
    if (error) throw new Error('Unable to remove the unused files.');
  }
  return { removed: stale.length, more: files.length === 1000 };
}
