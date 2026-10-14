import { useEffect, useState } from 'react';
import {
  X,
  Loader2,
  Send,
  Paperclip,
  Download,
  Lock,
  Clock,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Badge } from '@/components/ui';
import {
  AppRole,
  ConcernAttachment,
  ConcernComment,
  ConcernHistoryEntry,
  ConcernPriority,
  ConcernStatus,
} from '@/types';
import {
  ConcernWithNames,
  addConcernComment,
  deleteConcernAttachment,
  getAttachmentSignedUrl,
  getConcern,
  listConcernAttachments,
  listConcernComments,
  listConcernHistory,
  listConcernManagers,
  updateConcern,
  uploadConcernAttachment,
} from '@/services/concerns';

const STATUS_OPTIONS: ConcernStatus[] = [
  'SUBMITTED',
  'ACKNOWLEDGED',
  'UNDER_REVIEW',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
];

const STATUS_TONE: Record<ConcernStatus, 'slate' | 'green' | 'blue' | 'amber' | 'red'> = {
  SUBMITTED: 'slate',
  ACKNOWLEDGED: 'blue',
  UNDER_REVIEW: 'blue',
  IN_PROGRESS: 'amber',
  RESOLVED: 'green',
  CLOSED: 'green',
  REOPENED: 'red',
};

const PRIORITY_TONE: Record<ConcernPriority, 'slate' | 'blue' | 'amber' | 'red'> = {
  LOW: 'slate',
  MEDIUM: 'blue',
  HIGH: 'amber',
  URGENT: 'red',
};

const ROLE_LABEL: Record<AppRole, string> = {
  MAIN_SUPER_ADMIN: 'Main Super Admin',
  PRINCIPAL: 'Principal',
  SUB_SUPER_ADMIN: 'Sub Super Admin',
  CR: 'Class Representative',
  STUDENT: 'Student',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function historyLine(h: ConcernHistoryEntry): string {
  switch (h.action) {
    case 'CREATED':
      return 'Concern raised';
    case 'ASSIGNED':
      return h.to_value ? 'Assigned to a team member' : 'Unassigned';
    case 'STATUS_CHANGED':
      return `Status changed: ${h.from_value} → ${h.to_value}`;
    case 'PRIORITY_CHANGED':
      return `Priority changed: ${h.from_value} → ${h.to_value}`;
    case 'COMMENT_ADDED':
      return 'Comment added';
    default:
      return h.action;
  }
}

export function ConcernDetailPanel({
  concernId,
  onClose,
  myProfileId,
  canManageGlobally,
  onChanged,
}: {
  concernId: string;
  onClose: () => void;
  myProfileId: string;
  canManageGlobally: boolean;
  onChanged: () => void;
}) {
  const [concern, setConcern] = useState<ConcernWithNames | null>(null);
  const [comments, setComments] = useState<ConcernComment[]>([]);
  const [history, setHistory] = useState<ConcernHistoryEntry[]>([]);
  const [attachments, setAttachments] = useState<ConcernAttachment[]>([]);
  const [managers, setManagers] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingControl, setSavingControl] = useState(false);

  const canManageThis = canManageGlobally || concern?.assigned_to === myProfileId;

  async function reloadAll() {
    const [c, cm, h, a] = await Promise.all([
      getConcern(concernId),
      listConcernComments(concernId),
      listConcernHistory(concernId),
      listConcernAttachments(concernId),
    ]);
    setConcern(c);
    setComments(cm);
    setHistory(h);
    setAttachments(a);
  }

  useEffect(() => {
    setLoading(true);
    reloadAll()
      .catch((e) => toast.error(e.message ?? 'Failed to load concern.'))
      .finally(() => setLoading(false));
    if (canManageGlobally) {
      listConcernManagers().then(setManagers).catch(() => setManagers([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concernId]);

  async function submitComment() {
    if (!commentBody.trim()) return;
    setPosting(true);
    try {
      await addConcernComment(concernId, commentBody.trim(), isInternal);
      setCommentBody('');
      setIsInternal(false);
      await reloadAll();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to post comment.');
    } finally {
      setPosting(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      await uploadConcernAttachment(concernId, file);
      await reloadAll();
    } catch (e: any) {
      toast.error(e.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(a: ConcernAttachment) {
    try {
      const url = await getAttachmentSignedUrl(a.storage_path);
      window.open(url, '_blank');
    } catch (e: any) {
      toast.error(e.message ?? 'Could not open attachment.');
    }
  }

  async function handleDeleteAttachment(a: ConcernAttachment) {
    if (!confirm('Remove this attachment?')) return;
    try {
      await deleteConcernAttachment(a.id, a.storage_path);
      await reloadAll();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to remove attachment.');
    }
  }

  async function applyControl(patch: Parameters<typeof updateConcern>[1]) {
    setSavingControl(true);
    try {
      await updateConcern(concernId, patch);
      await reloadAll();
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update concern.');
    } finally {
      setSavingControl(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="font-display text-lg font-bold text-ink-900">Concern Details</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex justify-center py-16 text-slate-500">
              <Loader2 className="animate-spin" size={24} />
            </div>
          )}

          {!loading && concern && (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone="slate">{concern.concern_type}</Badge>
                    <Badge tone={STATUS_TONE[concern.status]}>{concern.status.replace('_', ' ')}</Badge>
                    <Badge tone={PRIORITY_TONE[concern.priority]}>{concern.priority}</Badge>
                    <Badge tone="slate">{concern.scope}</Badge>
                  </div>
                  <h4 className="text-base font-bold text-ink-900">{concern.short_description}</h4>
                  {concern.additional_notes && (
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{concern.additional_notes}</p>
                  )}
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600 sm:grid-cols-4">
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-500">Raised by</p>
                  <p>{concern.reporter?.full_name ?? '—'}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-500">Assigned to</p>
                  <p>{concern.assignee?.full_name ?? 'Unassigned'}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-500">Class / Section</p>
                  <p>
                    {concern.classes?.name ?? '—'} {concern.sections?.name ? `→ ${concern.sections.name}` : ''}
                  </p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-500">Student</p>
                  <p>{concern.students?.full_name ?? '—'}</p>
                </div>
              </div>

              {canManageThis && (
                <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-sm">
                  <label className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">Status</span>
                    <select
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      value={concern.status}
                      disabled={savingControl}
                      onChange={(e) => applyControl({ status: e.target.value as ConcernStatus })}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">Priority</span>
                    <select
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      value={concern.priority}
                      disabled={savingControl}
                      onChange={(e) => applyControl({ priority: e.target.value as ConcernPriority })}
                    >
                      {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as ConcernPriority[]).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                  {canManageGlobally && (
                    <label className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500">Assign to</span>
                      <select
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        value={concern.assigned_to ?? ''}
                        disabled={savingControl}
                        onChange={(e) => applyControl({ assignedTo: e.target.value || null })}
                      >
                        <option value="">Unassigned</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name} ({ROLE_LABEL[m.role as AppRole] ?? m.role})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}

              {/* Attachments */}
              <div className="mb-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Attachments</p>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
                      <Paperclip size={12} className="text-slate-500" />
                      <button onClick={() => handleDownload(a)} className="max-w-[160px] truncate font-medium text-brand-600 hover:underline">
                        {a.file_name}
                      </button>
                      <Download size={12} className="cursor-pointer text-slate-500" onClick={() => handleDownload(a)} />
                      <Trash2 size={12} className="cursor-pointer text-red-400" onClick={() => handleDeleteAttachment(a)} />
                    </div>
                  ))}
                  <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                    {uploading ? 'Uploading…' : '+ Attach file'}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Thread */}
              <div className="mb-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</p>
                <div className="space-y-2.5">
                  {history.map((h) => (
                    <div key={`h-${h.id}`} className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock size={12} />
                      <span>{historyLine(h)}</span>
                      <span>· {timeAgo(h.created_at)}</span>
                    </div>
                  ))}
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-xl px-3.5 py-2.5 text-sm ${
                        c.is_internal ? 'border border-amber-200 bg-amber-50' : 'bg-slate-50'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-ink-700">
                        {c.is_internal && <Lock size={11} className="text-amber-600" />}
                        {ROLE_LABEL[c.author_role] ?? c.author_role}
                        <span className="font-normal text-slate-500">· {timeAgo(c.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-line text-slate-700">{c.body}</p>
                    </div>
                  ))}
                  {!comments.length && !history.length && (
                    <p className="text-xs text-slate-500">No activity yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {!loading && concern && (
          <div className="border-t border-slate-100 px-6 py-4">
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                rows={2}
                placeholder="Write a reply…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              <Button disabled={posting || !commentBody.trim()} onClick={submitComment}>
                <Send size={15} />
              </Button>
            </div>
            {canManageThis && (
              <label className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                <ShieldCheck size={12} /> Internal note (hidden from the submitter)
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
