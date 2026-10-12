import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, RotateCcw, Send } from 'lucide-react';
import { StudentLayout } from '@/components/layout/StudentLayout';
import { Button, Card, Badge, Spinner } from '@/components/ui';
import {
  listMyConcerns,
  listConcernComments,
  addConcernComment,
  updateConcern,
  ConcernWithNames,
} from '@/services/concerns';
import { ConcernComment, ConcernStatus } from '@/types';

const STATUS_TONE: Record<ConcernStatus, 'slate' | 'green' | 'red' | 'amber' | 'blue'> = {
  SUBMITTED: 'slate',
  ACKNOWLEDGED: 'blue',
  UNDER_REVIEW: 'amber',
  IN_PROGRESS: 'amber',
  RESOLVED: 'green',
  CLOSED: 'slate',
  REOPENED: 'red',
};

export default function StudentMyQueries() {
  const [queries, setQueries] = useState<ConcernWithNames[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConcernWithNames | null>(null);
  const [comments, setComments] = useState<ConcernComment[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    setQueries(await listMyConcerns());
    setLoading(false);
  }
  useEffect(() => { reload(); }, []);

  async function openQuery(q: ConcernWithNames) {
    setSelected(q);
    setComments(await listConcernComments(q.id));
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      await addConcernComment(selected.id, reply.trim());
      setReply('');
      setComments(await listConcernComments(selected.id));
      toast.success('Reply sent.');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to send your reply.');
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    if (!selected) return;
    setBusy(true);
    try {
      await updateConcern(selected.id, { status: 'REOPENED' });
      toast.success('Query reopened.');
      await reload();
      setSelected({ ...selected, status: 'REOPENED' });
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to reopen this query.');
    } finally {
      setBusy(false);
    }
  }

  if (selected) {
    return (
      <StudentLayout>
        <button onClick={() => setSelected(null)} className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft size={15} /> Back to My Queries
        </button>

        <Card className="mb-4 p-5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{selected.concern_type}</p>
              <h1 className="text-lg font-extrabold text-ink-900">{selected.short_description}</h1>
            </div>
            <Badge tone={STATUS_TONE[selected.status]}>{selected.status.replace(/_/g, ' ')}</Badge>
          </div>
          {selected.additional_notes && <p className="mt-2 text-sm text-slate-600">{selected.additional_notes}</p>}
          <p className="mt-3 text-xs text-slate-400">Submitted {new Date(selected.created_at).toLocaleDateString()}</p>

          {(selected.status === 'RESOLVED' || selected.status === 'CLOSED') && (
            <Button variant="secondary" onClick={reopen} disabled={busy} className="mt-4">
              <RotateCcw size={14} className="mr-1.5 inline" /> Reopen This Query
            </Button>
          )}
        </Card>

        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">Replies</h2>
        <Card className="mb-4 divide-y divide-slate-100">
          {comments.map((c) => (
            <div key={c.id} className="px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">{c.author_role.replace(/_/g, ' ')}</p>
              <p className="text-sm text-ink-900">{c.body}</p>
              <p className="mt-1 text-[11px] text-slate-400">{new Date(c.created_at).toLocaleString()}</p>
            </div>
          ))}
          {/* Internal admin notes never appear here — the query only ever
              returns comments visible to this student (see
              concern_comments_select RLS in 0011_concerns_upgrade.sql). */}
          {!comments.length && <div className="px-4 py-8 text-center text-slate-400">No replies yet.</div>}
        </Card>

        <Card className="p-4">
          <textarea
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            rows={3}
            placeholder="Add a follow-up…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <Button onClick={sendReply} disabled={busy || !reply.trim()} className="mt-2">
            <Send size={14} className="mr-1.5 inline" /> Send
          </Button>
        </Card>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">My Queries</h1>
        <p className="text-sm text-slate-500">Only queries you've raised — never anyone else's.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : (
        <Card className="divide-y divide-slate-100">
          {queries.map((q) => (
            <button key={q.id} onClick={() => openQuery(q)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{q.concern_type}</p>
                <p className="text-sm font-medium text-ink-900">{q.short_description}</p>
                <p className="text-xs text-slate-400">{new Date(q.created_at).toLocaleDateString()}</p>
              </div>
              <Badge tone={STATUS_TONE[q.status]}>{q.status.replace(/_/g, ' ')}</Badge>
            </button>
          ))}
          {!queries.length && <div className="px-4 py-14 text-center text-slate-400">You haven't raised any queries yet.</div>}
        </Card>
      )}
    </StudentLayout>
  );
}
