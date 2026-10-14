import { TextVideos } from '@/components/VideoEmbed';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Pin, PinOff, Pencil, Trash2, Send, Inbox as InboxIcon, CheckCheck, Clock, X } from 'lucide-react';
import clsx from 'clsx';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Label, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { Announcement, AnnouncementPriority, AppRole } from '@/types';
import {
  allowedAudienceFor, listInboxAnnouncements, listSentAnnouncements, createAnnouncement,
  updateAnnouncement, deleteAnnouncement, markAnnouncementRead, announcementReadStats,
  InboxAnnouncement,
} from '@/services/announcements';

const ROLE_LABEL: Record<AppRole, string> = {
  MAIN_SUPER_ADMIN: 'Main Super Admin',
  PRINCIPAL: 'Principal',
  SUB_SUPER_ADMIN: 'Sub Super Admin',
  CR: 'Class Representative',
  STUDENT: 'Student',
};

const ROLE_PLURAL: Record<AppRole, string> = {
  MAIN_SUPER_ADMIN: 'Main Super Admins',
  PRINCIPAL: 'Principals',
  SUB_SUPER_ADMIN: 'Sub Super Admins',
  CR: 'Class Representatives (CRs)',
  STUDENT: 'Students',
};

const PRIORITIES: { value: AnnouncementPriority; label: string; active: string }[] = [
  { value: 'LOW', label: 'Low', active: 'bg-slate-500 text-white' },
  { value: 'NORMAL', label: 'Normal', active: 'bg-brand-600 text-white' },
  { value: 'HIGH', label: 'High', active: 'bg-amber-500 text-white' },
  { value: 'URGENT', label: 'Urgent', active: 'bg-red-600 text-white' },
];

const PRIORITY_BORDER: Record<AnnouncementPriority, string> = {
  LOW: 'border-l-slate-400',
  NORMAL: 'border-l-brand-500',
  HIGH: 'border-l-amber-500',
  URGENT: 'border-l-red-500',
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

const emptyForm = { title: '', message: '', priority: 'NORMAL' as AnnouncementPriority, targetRoles: [] as AppRole[], isPinned: false, expiresAt: '' };

export default function AnnouncementsPage() {
  const { profile } = useAuth();
  const role = profile?.role as AppRole;
  const canCompose = allowedAudienceFor(role).length > 0;
  const [tab, setTab] = useState<'inbox' | 'compose' | 'sent'>(canCompose && role === 'MAIN_SUPER_ADMIN' ? 'compose' : 'inbox');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread'>('all');

  const [inbox, setInbox] = useState<InboxAnnouncement[]>([]);
  const [sent, setSent] = useState<Announcement[]>([]);
  const [readStats, setReadStats] = useState<Record<string, { total: number; read: number }>>({});
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reloadInbox() { setInbox(await listInboxAnnouncements()); }
  async function reloadSent() {
    if (!profile) return;
    const rows = await listSentAnnouncements(profile.id);
    setSent(rows);
    const stats = await Promise.all(rows.map((a) => announcementReadStats(a.id, a.target_roles)));
    setReadStats(Object.fromEntries(rows.map((a, i) => [a.id, stats[i]])));
  }

  useEffect(() => { if (role !== 'MAIN_SUPER_ADMIN') reloadInbox(); }, [role]); // eslint-disable-line
  useEffect(() => { if (canCompose) reloadSent(); }, [canCompose]); // eslint-disable-line

  const audience = allowedAudienceFor(role);

  function toggleTarget(r: AppRole) {
    setForm((f) => ({ ...f, targetRoles: f.targetRoles.includes(r) ? f.targetRoles.filter((x) => x !== r) : [...f.targetRoles, r] }));
  }

  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setForm({
      title: a.title, message: a.message, priority: a.priority, targetRoles: a.target_roles,
      isPinned: a.is_pinned, expiresAt: a.expires_at ? a.expires_at.slice(0, 16) : '',
    });
    setTab('compose');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit() {
    if (!profile) return;
    if (!form.title.trim() || !form.message.trim()) { toast.error('Please add a title and a message.'); return; }
    if (!form.targetRoles.length) { toast.error('Select at least one audience.'); return; }
    setSaving(true);
    try {
      const expiresAt = form.expiresAt ? new Date(form.expiresAt).toISOString() : null;
      if (editingId) {
        await updateAnnouncement(editingId, {
          title: form.title.trim(), message: form.message.trim(), priority: form.priority,
          target_roles: form.targetRoles, is_pinned: form.isPinned, expires_at: expiresAt,
        });
        toast.success('Announcement updated.');
      } else {
        await createAnnouncement({
          createdBy: profile.id, createdByName: profile.full_name, createdByRole: role,
          title: form.title.trim(), message: form.message.trim(), priority: form.priority,
          targetRoles: form.targetRoles, isPinned: form.isPinned, expiresAt,
        });
        toast.success('Announcement posted.');
      }
      cancelEdit();
      reloadSent();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save announcement.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this announcement? This cannot be undone.')) return;
    await deleteAnnouncement(id);
    toast.success('Announcement deleted.');
    reloadSent();
  }

  async function togglePin(a: Announcement) {
    await updateAnnouncement(a.id, { is_pinned: !a.is_pinned });
    reloadSent();
  }

  async function openInboxItem(item: InboxAnnouncement) {
    if (!item.read && profile) {
      await markAnnouncementRead(item.id, profile.id);
      setInbox((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    }
  }

  async function markAllRead() {
    if (!profile) return;
    const unread = inbox.filter((i) => !i.read);
    await Promise.all(unread.map((i) => markAnnouncementRead(i.id, profile.id)));
    setInbox((prev) => prev.map((i) => ({ ...i, read: true })));
  }

  const filteredInbox = inboxFilter === 'unread' ? inbox.filter((i) => !i.read) : inbox;

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">Announcements</h1>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            {canCompose
              ? `You can announce to: ${audience.map((r) => ROLE_PLURAL[r]).join(', ')}.`
              : 'Updates from your Principal and Sub Super Admin.'}
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {role !== 'MAIN_SUPER_ADMIN' && (
            <button onClick={() => setTab('inbox')} className={clsx('flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', tab === 'inbox' ? 'bg-white text-ink-900 shadow-soft' : 'text-slate-500')}>
              <InboxIcon size={14} /> Inbox
              {inbox.some((i) => !i.read) && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
            </button>
          )}
          {canCompose && (
            <>
              <button onClick={() => setTab('compose')} className={clsx('flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', tab === 'compose' ? 'bg-white text-ink-900 shadow-soft' : 'text-slate-500')}>
                <Send size={14} /> Compose
              </button>
              <button onClick={() => setTab('sent')} className={clsx('flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', tab === 'sent' ? 'bg-white text-ink-900 shadow-soft' : 'text-slate-500')}>
                <CheckCheck size={14} /> Sent
              </button>
            </>
          )}
        </div>
      </div>

      {tab === 'inbox' && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-2">
              <button onClick={() => setInboxFilter('all')} className={clsx('rounded-full px-3 py-1 text-xs font-semibold', inboxFilter === 'all' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500')}>All</button>
              <button onClick={() => setInboxFilter('unread')} className={clsx('rounded-full px-3 py-1 text-xs font-semibold', inboxFilter === 'unread' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500')}>Unread</button>
            </div>
            {inbox.some((i) => !i.read) && <button onClick={markAllRead} className="text-xs font-semibold text-brand-600 hover:underline">Mark all as read</button>}
          </div>
          <div className="space-y-3">
            {filteredInbox.map((item) => (
              <Card
                key={item.id}
                className={clsx('cursor-pointer border-l-4 p-4 transition hover:shadow-card', PRIORITY_BORDER[item.priority], !item.read && 'bg-brand-50/30')}
                onClick={() => openInboxItem(item)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    {item.is_pinned && <Pin size={13} className="text-brand-500" />}
                    <p className={clsx('text-sm', item.read ? 'text-ink-800' : 'font-bold text-ink-900')}>{item.title}</p>
                    {!item.read && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                  </div>
                  <Badge tone={item.priority === 'URGENT' ? 'red' : item.priority === 'HIGH' ? 'amber' : item.priority === 'LOW' ? 'slate' : 'blue'}>{item.priority}</Badge>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{item.message}</p>
                <TextVideos text={item.message} className="mt-3 max-w-xl" />
                <p className="mt-2 text-xs text-slate-500">
                  {item.created_by_name} · {ROLE_LABEL[item.created_by_role]} · {timeAgo(item.created_at)}
                  {item.expires_at && <> · <Clock size={11} className="inline -mt-0.5" /> expires {new Date(item.expires_at).toLocaleDateString()}</>}
                </p>
              </Card>
            ))}
            {!filteredInbox.length && <Card className="p-8 text-center text-slate-500">{inboxFilter === 'unread' ? 'No unread announcements.' : 'No announcements yet.'}</Card>}
          </div>
        </>
      )}

      {tab === 'compose' && canCompose && (
        <Card className="p-6">
          {editingId && (
            <div className="mb-4 flex items-center justify-between rounded-xl bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-700">
              Editing an existing announcement
              <button onClick={cancelEdit} className="rounded p-1 hover:bg-amber-100"><X size={14} /></button>
            </div>
          )}
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mid-term schedule released" /></div>
          <div className="mt-4">
            <Label>Message</Label>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Write your announcement…"
            />
            <p className="mt-1 text-xs text-slate-500">Tip: paste a YouTube, Vimeo, Facebook, Instagram or TikTok link in the message and it will play inside the announcement.</p>
            <TextVideos text={form.message} className="mt-2 max-w-sm" />
          </div>

          <div className="mt-4">
            <Label>Priority</Label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setForm({ ...form, priority: p.value })}
                  className={clsx('rounded-full px-3.5 py-1.5 text-xs font-semibold transition', form.priority === p.value ? p.active : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <Label>Audience</Label>
            <div className="flex flex-wrap gap-2">
              {audience.map((r) => (
                <button
                  key={r}
                  onClick={() => toggleTarget(r)}
                  className={clsx(
                    'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                    form.targetRoles.includes(r) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {ROLE_PLURAL[r]}
                </button>
              ))}
            </div>
            {audience.length > 1 && (
              <button onClick={() => setForm({ ...form, targetRoles: audience })} className="mt-2 text-xs font-semibold text-brand-600 hover:underline">
                Select everyone I can reach
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
              <input type="checkbox" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              Pin to top of recipients' inbox
            </label>
            <div>
              <Label>Auto-expire (optional)</Label>
              <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Post Announcement'}</Button>
            {editingId && <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>}
          </div>
        </Card>
      )}

      {tab === 'sent' && canCompose && (
        <div className="space-y-3">
          {sent.map((a) => {
            const stats = readStats[a.id];
            return (
              <Card key={a.id} className={clsx('border-l-4 p-4', PRIORITY_BORDER[a.priority])}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    {a.is_pinned && <Pin size={13} className="text-brand-500" />}
                    <p className="font-semibold text-ink-900">{a.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={a.priority === 'URGENT' ? 'red' : a.priority === 'HIGH' ? 'amber' : a.priority === 'LOW' ? 'slate' : 'blue'}>{a.priority}</Badge>
                    <button onClick={() => togglePin(a)} title={a.is_pinned ? 'Unpin' : 'Pin'} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600">
                      {a.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                    </button>
                    <button onClick={() => startEdit(a)} title="Edit" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(a.id)} title="Delete" className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{a.message}</p>
                <TextVideos text={a.message} className="mt-3 max-w-xl" />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>To: {a.target_roles.map((r) => ROLE_PLURAL[r]).join(', ')}</span>
                  <span>· {timeAgo(a.created_at)}</span>
                  {a.expires_at && <span>· expires {new Date(a.expires_at).toLocaleDateString()}</span>}
                  {stats && <span className="font-semibold text-brand-600">· Seen by {stats.read}/{stats.total}</span>}
                </div>
              </Card>
            );
          })}
          {!sent.length && <Card className="p-8 text-center text-slate-500">You haven't posted any announcements yet.</Card>}
        </div>
      )}
    </DashboardLayout>
  );
}
