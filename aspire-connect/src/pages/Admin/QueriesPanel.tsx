import { useCallback, useEffect, useState } from 'react';
import { FileText, Paperclip, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/services/activityLog';
import { Badge, Button, Card, Input, Label, Modal, Select, Spinner } from '@/components/ui';
import {
  QUERY_STATUSES, QueryReply, QueryRow, QueryStatus, addReply, attachmentUrl, cleanupUnusedUploads, deleteQuery, identityLabel, listQueries,
  listReplies, newQueryCount, queryStatusCounts, setQueryStatus, statusLabel, visibilityLabel,
} from '@/services/queries';

const PAGE_SIZE = 15;
const TONE: Record<QueryStatus, 'blue' | 'amber' | 'green' | 'slate'> = { NEW: 'blue', IN_PROGRESS: 'amber', ANSWERED: 'green', CLOSED: 'slate' };
const dt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Who asked, respecting the identity option the person chose. */
export const askerName = (q: Pick<QueryRow, 'name' | 'visibility'>) => (q.visibility === 'ANONYMOUS' ? 'Anonymous' : q.name || 'Name not given');

function Detail({ k, v }: { k: string; v?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{v ? v : <span className="text-slate-400">Not shared</span>}</dd>
    </div>
  );
}

function QueryModal({ q, canManage, onClose, onChanged }: { q: QueryRow; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const [cur, setCur] = useState(q);
  const [replies, setReplies] = useState<QueryReply[]>([]);
  const [text, setText] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const { profile } = useAuth();
  // Management actions go into the activity log (never the visitor's identity beyond what they chose to share).
  const log = (action: string, description: string) => {
    if (profile) void logActivity({ adminId: profile.id, adminName: profile.full_name, adminRole: profile.role, action, target: cur.code, description });
  };

  const loadReplies = useCallback(() => { listReplies(q.id).then(setReplies).catch(() => toast.error('Unable to load replies.')); }, [q.id]);
  useEffect(loadReplies, [loadReplies]);

  async function open(path: string) {
    // Open the tab first so the browser does not block it, then point it at the short-lived link.
    const w = window.open('', '_blank');
    try {
      const url = await attachmentUrl(path);
      if (w) { w.opener = null; w.location.href = url; } else window.location.href = url;
    } catch (e) { w?.close(); toast.error((e as Error).message); }
  }
  async function changeStatus(status: QueryStatus) {
    try { await setQueryStatus(cur.id, status); setCur({ ...cur, status }); log('Question Status Changed', `Marked question ${cur.code} as ${statusLabel(status).toLowerCase()}.`); toast.success(`Marked as ${statusLabel(status).toLowerCase()}.`); onChanged(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addReply(cur, text.trim(), isPublic);
      if (isPublic && (cur.status === 'NEW' || cur.status === 'IN_PROGRESS')) setCur({ ...cur, status: 'ANSWERED' });
      log(isPublic ? 'Question Answered' : 'Question Note Added', `${isPublic ? 'Replied to' : 'Added an internal note on'} question ${cur.code}.`);
      setText(''); loadReplies(); onChanged();
      toast.success(isPublic ? 'Reply saved. The person can see it with their tracking code.' : 'Internal note saved.');
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('Delete this question, its replies and its attachments? This cannot be undone.')) return;
    try { await deleteQuery(cur); log('Question Deleted', `Deleted question ${cur.code}.`); toast.success('Question deleted.'); onChanged(); onClose(); } catch (e) { toast.error((e as Error).message); }
  }

  const reachable = [cur.email && `Email: ${cur.email}`, cur.phone && `Phone: ${cur.phone}`].filter(Boolean);
  return (
    <Modal open onClose={onClose} title={`${cur.subject}`} wide>
      <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={TONE[cur.status]}>{statusLabel(cur.status)}</Badge>
          <span className="font-mono text-xs text-slate-500">{cur.code}</span>
          <span className="text-xs text-slate-500">{dt(cur.created_at)} · {cur.category}</span>
        </div>

        <section>
          <h4 className="mb-2 text-sm font-bold text-slate-700">Asked by</h4>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail k="Name" v={askerName(cur)} />
            <Detail k="Role" v={identityLabel(cur.identity_type)} />
            <Detail k="Identity shared" v={visibilityLabel(cur.visibility)} />
            <Detail k="Contact" v={reachable.length ? reachable.join(' · ') : null} />
            {(cur.class_name || cur.roll_no) && <Detail k="Class / roll number" v={[cur.class_name, cur.roll_no && `#${cur.roll_no}`].filter(Boolean).join(' ')} />}
          </dl>
          {cur.visibility !== 'FULL' && <p className="mt-2 text-xs text-slate-500">This person chose not to share contact details. Reply here; they read it with their tracking code on the website.</p>}
        </section>

        <section>
          <h4 className="mb-2 text-sm font-bold text-slate-700">Question</h4>
          <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{cur.message}</p>
          {cur.attachments?.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {cur.attachments.map((a) => (
                <li key={a.path}>
                  <button type="button" onClick={() => open(a.path)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    {a.type === 'application/pdf' ? <FileText size={14} /> : <Paperclip size={14} />} {a.name} <span className="text-xs text-slate-400">({kb(a.size)})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-sm font-bold text-slate-700">Replies and notes</h4>
          {!replies.length ? <p className="text-sm text-slate-400">No replies yet.</p> : (
            <ul className="space-y-3">
              {replies.map((r) => (
                <li key={r.id} className={`rounded-lg px-3 py-2 text-sm ${r.is_public ? 'bg-green-50' : 'bg-amber-50'}`}>
                  <p className="whitespace-pre-wrap text-slate-800">{r.body}</p>
                  <p className="mt-1 text-xs text-slate-500">{r.is_public ? 'Public reply' : 'Internal note (not shown to the person)'} · {r.author_name ?? 'Staff'} · {dt(r.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {canManage && (
          <section className="rounded-xl border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-bold text-slate-700">Respond</h4>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={3000} aria-label="Reply or note"
              placeholder={isPublic ? 'Write the reply the person will read' : 'Write a note for staff only'}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                Show this to the person who asked
              </label>
              <Button size="sm" disabled={busy || !text.trim()} onClick={send}>{busy ? 'Saving…' : isPublic ? 'Send reply' : 'Save note'}</Button>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
              <div className="w-48">
                <Label>Status</Label>
                <Select value={cur.status} onChange={(e) => changeStatus(e.target.value as QueryStatus)}>
                  {QUERY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </div>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={remove}><Trash2 size={14} /> Delete</Button>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

export default function QueriesPanel({ canManage, onNew }: { canManage: boolean; onNew: (n: number) => void }) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<QueryStatus, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<QueryRow | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const { profile } = useAuth();

  async function cleanUp() {
    setCleaning(true);
    try {
      const r = await cleanupUnusedUploads();
      if (r.removed && profile) void logActivity({ adminId: profile.id, adminName: profile.full_name, adminRole: profile.role, action: 'Unused Uploads Removed', description: `Removed ${r.removed} unused question upload${r.removed === 1 ? '' : 's'}.` });
      toast.success(r.removed ? `Removed ${r.removed} unused file${r.removed === 1 ? '' : 's'}${r.more ? '. More may remain; run it again.' : '.'}` : 'No unused files found.');
    } catch (e) { toast.error((e as Error).message); } finally { setCleaning(false); }
  }

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [res, c] = await Promise.all([listQueries({ search: debounced, status, page, pageSize: PAGE_SIZE }), queryStatusCounts()]);
      setRows(res.rows); setTotal(res.total); setCounts(c); onNew(c.NEW);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [debounced, status, page, onNew]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUERY_STATUSES.map((s) => (
          <button key={s.value} onClick={() => { setStatus(status === s.value ? '' : s.value); setPage(1); }} aria-pressed={status === s.value}
            className={`rounded-xl border px-4 py-3 text-left ${status === s.value ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-ink-900">{counts ? counts[s.value] : '–'}</p>
          </button>
        ))}
      </div>
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input className="pl-9" placeholder="Search by subject, tracking code or name" aria-label="Search questions" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-48">
            <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>{QUERY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
          {canManage && <Button variant="secondary" size="sm" disabled={cleaning} onClick={cleanUp} title="Delete files that visitors uploaded but never sent with a question (older than one day)">{cleaning ? 'Cleaning…' : 'Clear unused uploads'}</Button>}
        </div>
        {error ? (
          <div className="p-8 text-center text-sm text-red-700" role="alert">{error} If this is the first time, the administrator needs to run the 0025 database script. <button className="ml-2 underline" onClick={load}>Retry</button></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Question</th><th className="px-4 py-3">From</th><th className="px-4 py-3">Topic</th><th className="px-4 py-3">Received</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-slate-50/60" onClick={() => setOpen(r)}>
                    <td className="px-4 py-3"><button className={`text-left hover:underline ${r.status === 'NEW' ? 'font-semibold' : 'font-medium'} text-ink-900`} onClick={(e) => { e.stopPropagation(); setOpen(r); }}>{r.subject}</button>
                      <p className="font-mono text-xs text-slate-500">{r.code}{r.attachments?.length ? ` · ${r.attachments.length} file${r.attachments.length > 1 ? 's' : ''}` : ''}</p></td>
                    <td className="px-4 py-3 text-slate-700">{askerName(r)}<p className="text-xs text-slate-500">{identityLabel(r.identity_type)}</p></td>
                    <td className="px-4 py-3 text-slate-600">{r.category}</td>
                    <td className="px-4 py-3 text-slate-600">{dt(r.created_at)}</td>
                    <td className="px-4 py-3"><Badge tone={TONE[r.status]}>{statusLabel(r.status)}</Badge></td>
                  </tr>
                ))}
                {loading && !rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center"><Spinner className="mx-auto" /></td></tr>}
                {!loading && !rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">{debounced || status ? 'No questions match your search.' : 'No questions have been received yet.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>Page {page} of {Math.ceil(total / PAGE_SIZE)} · {total} total</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={page * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
      {open && <QueryModal q={open} canManage={canManage} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}
