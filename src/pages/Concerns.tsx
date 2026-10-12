import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Bell, Send, Inbox as InboxIcon, ClipboardList, ShieldCheck, Filter } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Label, Select, Badge, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { ClassRow, SectionRow, ConcernPriority, ConcernScope, ConcernStatus, Student } from '@/types';
import { listClasses, listSections } from '@/services/academics';
import { getSettings } from '@/services/settings';
import { myAssignments } from '@/services/crAssignments';
import { supabase } from '@/lib/supabase';
import {
  ConcernWithNames,
  getMyConcernCapabilities,
  listAssignedConcerns,
  listConcernNotifications,
  listMyConcerns,
  listVisibleConcerns,
  markConcernNotificationRead,
  raiseConcern,
  unreadConcernNotificationCount,
} from '@/services/concerns';
import { ConcernDetailPanel } from '@/components/concerns/ConcernDetailPanel';

type Tab = 'raise' | 'mine' | 'assigned' | 'manage';

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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const emptyForm = {
  category: '',
  subject: '',
  description: '',
  priority: 'MEDIUM' as ConcernPriority,
  scope: 'PERSONAL' as ConcernScope,
  classId: '',
  sectionId: '',
  studentId: '',
};

function ConcernRow({ c, onOpen }: { c: ConcernWithNames; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full flex-col gap-1.5 border-b border-slate-100 px-5 py-4 text-left last:border-0 hover:bg-slate-50"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="slate">{c.concern_type}</Badge>
        <Badge tone={STATUS_TONE[c.status]}>{c.status.replace('_', ' ')}</Badge>
        <Badge tone={PRIORITY_TONE[c.priority]}>{c.priority}</Badge>
        <span className="ml-auto text-xs text-slate-400">{timeAgo(c.created_at)}</span>
      </div>
      <p className="text-sm font-semibold text-ink-900">{c.short_description}</p>
      <p className="text-xs text-slate-500">
        {c.reporter?.full_name ? `By ${c.reporter.full_name}` : ''}
        {c.assignee?.full_name ? ` · Assigned to ${c.assignee.full_name}` : ' · Unassigned'}
      </p>
    </button>
  );
}

export default function ConcernsPage() {
  const { profile } = useAuth();
  const role = profile?.role;

  const [capabilities, setCapabilities] = useState<{ canRaise: boolean; canViewAll: boolean; canManage: boolean } | null>(
    null
  );
  const [tab, setTab] = useState<Tab>('mine');
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Awaited<ReturnType<typeof listConcernNotifications>>>([]);

  const [categories, setCategories] = useState<string[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [crSectionIds, setCrSectionIds] = useState<string[] | null>(null); // null = not a CR / not restricted
  const [sectionStudents, setSectionStudents] = useState<Student[]>([]);

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [mine, setMine] = useState<ConcernWithNames[]>([]);
  const [assigned, setAssigned] = useState<ConcernWithNames[]>([]);
  const [manageList, setManageList] = useState<ConcernWithNames[]>([]);
  const [manageFilters, setManageFilters] = useState<{ status?: ConcernStatus; priority?: ConcernPriority; unassignedOnly?: boolean }>({});
  const [loadingList, setLoadingList] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!role) return;
    getMyConcernCapabilities(role).then((caps) => {
      setCapabilities(caps);
      setTab(caps.canManage ? 'manage' : 'mine');
    });
  }, [role]);

  useEffect(() => {
    getSettings()
      .then((s) => setCategories(s.concern_categories ?? []))
      .catch(() => setCategories([]));
    listClasses().then(setClasses).catch(() => {});
    listSections().then(setSections).catch(() => {});
  }, []);

  useEffect(() => {
    if (role === 'CR' && profile) {
      myAssignments(profile.id).then((rows) => {
        setCrSectionIds((rows ?? []).map((r: any) => r.section_id));
      });
    }
  }, [role, profile]);

  async function refreshNotifications() {
    const [count, list] = await Promise.all([unreadConcernNotificationCount(), listConcernNotifications(15)]);
    setUnread(count);
    setNotifications(list);
  }
  useEffect(() => {
    refreshNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reloadMine() {
    setLoadingList(true);
    try {
      setMine(await listMyConcerns());
    } finally {
      setLoadingList(false);
    }
  }
  async function reloadAssigned() {
    setLoadingList(true);
    try {
      setAssigned(await listAssignedConcerns());
    } finally {
      setLoadingList(false);
    }
  }
  async function reloadManage() {
    setLoadingList(true);
    try {
      setManageList(await listVisibleConcerns(manageFilters));
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (tab === 'mine') reloadMine();
    if (tab === 'assigned') reloadAssigned();
    if (tab === 'manage') reloadManage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === 'manage') reloadManage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manageFilters]);

  const availableClasses = useMemo(() => {
    if (!crSectionIds) return classes;
    const allowedClassIds = new Set(sections.filter((s) => crSectionIds.includes(s.id)).map((s) => s.class_id));
    return classes.filter((c) => allowedClassIds.has(c.id));
  }, [classes, sections, crSectionIds]);

  const availableSections = useMemo(() => {
    let list = form.classId ? sections.filter((s) => s.class_id === form.classId) : sections;
    if (crSectionIds) list = list.filter((s) => crSectionIds.includes(s.id));
    return list;
  }, [sections, form.classId, crSectionIds]);

  useEffect(() => {
    if (!form.sectionId) {
      setSectionStudents([]);
      return;
    }
    supabase
      .from('students')
      .select('*')
      .eq('section_id', form.sectionId)
      .order('roll_number')
      .then(({ data }) => setSectionStudents((data as Student[]) ?? []));
  }, [form.sectionId]);

  function refreshAfterChange() {
    refreshNotifications();
    if (tab === 'mine') reloadMine();
    if (tab === 'assigned') reloadAssigned();
    if (tab === 'manage') reloadManage();
  }

  async function handleRaise() {
    if (!form.category || !form.subject.trim()) {
      toast.error('Please choose a category and add a subject.');
      return;
    }
    if ((form.scope === 'SECTION' || form.scope === 'CLASS') && !form.sectionId && !form.classId) {
      toast.error('Please select the related class/section for this scope.');
      return;
    }
    setSubmitting(true);
    try {
      await raiseConcern({
        category: form.category,
        subject: form.subject.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        scope: form.scope,
        classId: form.classId || null,
        sectionId: form.sectionId || null,
        studentId: form.studentId || null,
      });
      toast.success('Concern submitted.');
      setForm(emptyForm);
      setTab('mine');
      reloadMine();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to submit concern.');
    } finally {
      setSubmitting(false);
    }
  }

  async function openNotification(n: (typeof notifications)[number]) {
    if (!n.is_read) {
      await markConcernNotificationRead(n.id);
      refreshNotifications();
    }
    setSelectedId(n.concern_id);
    setNotifOpen(false);
  }

  if (!capabilities) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  const list = tab === 'mine' ? mine : tab === 'assigned' ? assigned : tab === 'manage' ? manageList : [];

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">Concerns</h1>
          <p className="text-sm text-slate-500">Raise and track institutional concerns and complaints.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50"
            >
              <Bell size={17} />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-card">
                {notifications.length === 0 && <p className="px-3 py-4 text-center text-xs text-slate-400">No notifications.</p>}
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openNotification(n)}
                    className={clsx(
                      'flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-50',
                      !n.is_read && 'bg-brand-50/50'
                    )}
                  >
                    <span className={clsx(!n.is_read && 'font-semibold text-ink-900')}>{n.message}</span>
                    <span className="text-slate-400">{timeAgo(n.created_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {capabilities.canRaise && (
              <button
                onClick={() => setTab('raise')}
                className={clsx('flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', tab === 'raise' ? 'bg-white text-ink-900 shadow-soft' : 'text-slate-500')}
              >
                <Send size={14} /> Raise
              </button>
            )}
            <button
              onClick={() => setTab('mine')}
              className={clsx('flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', tab === 'mine' ? 'bg-white text-ink-900 shadow-soft' : 'text-slate-500')}
            >
              <InboxIcon size={14} /> My Concerns
            </button>
            <button
              onClick={() => setTab('assigned')}
              className={clsx('flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', tab === 'assigned' ? 'bg-white text-ink-900 shadow-soft' : 'text-slate-500')}
            >
              <ClipboardList size={14} /> Assigned to Me
            </button>
            {capabilities.canManage && (
              <button
                onClick={() => setTab('manage')}
                className={clsx('flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', tab === 'manage' ? 'bg-white text-ink-900 shadow-soft' : 'text-slate-500')}
              >
                <ShieldCheck size={14} /> Manage
              </button>
            )}
          </div>
        </div>
      </div>

      {tab === 'raise' && capabilities.canRaise && (
        <Card className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <div className="flex flex-wrap gap-2 pt-1.5">
                {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as ConcernPriority[]).map((p) => {
                  const disabled = p === 'URGENT' && role === 'CR';
                  return (
                    <button
                      key={p}
                      disabled={disabled}
                      title={disabled ? 'Only administrators or the Principal may set Urgent priority.' : undefined}
                      onClick={() => setForm({ ...form, priority: p })}
                      className={clsx(
                        'rounded-full px-3.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
                        form.priority === p ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Label>Subject</Label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g. Broken projector in Room 4"
            />
          </div>

          <div className="mt-4">
            <Label>Description (optional)</Label>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add any relevant detail…"
            />
          </div>

          <div className="mt-4">
            <Label>Scope</Label>
            <div className="flex flex-wrap gap-2">
              {(['PERSONAL', 'SECTION', 'CLASS', 'INSTITUTION'] as ConcernScope[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, scope: s })}
                  className={clsx(
                    'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                    form.scope === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Personal/Institution concerns are only visible to you and concern managers. Section/Class concerns are
              also visible to CRs assigned there.
            </p>
          </div>

          {(form.scope === 'SECTION' || form.scope === 'CLASS') && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Class</Label>
                <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, sectionId: '' })}>
                  <option value="">Select class</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              {form.scope === 'SECTION' && (
                <div>
                  <Label>Section</Label>
                  <Select value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })}>
                    <option value="">Select section</option>
                    {availableSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          )}

          {form.sectionId && sectionStudents.length > 0 && (
            <div className="mt-4">
              <Label>Related Student (optional)</Label>
              <Select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                <option value="">None</option>
                {sectionStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} (Roll #{s.roll_number})
                  </option>
                ))}
              </Select>
            </div>
          )}

          <Button className="mt-5" onClick={handleRaise} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Concern'}
          </Button>
        </Card>
      )}

      {tab === 'manage' && capabilities.canManage && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5">
          <Filter size={14} className="text-slate-400" />
          <select
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            value={manageFilters.status ?? ''}
            onChange={(e) => setManageFilters((f) => ({ ...f, status: (e.target.value || undefined) as ConcernStatus | undefined }))}
          >
            <option value="">All statuses</option>
            {(['SUBMITTED', 'ACKNOWLEDGED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'] as ConcernStatus[]).map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            value={manageFilters.priority ?? ''}
            onChange={(e) => setManageFilters((f) => ({ ...f, priority: (e.target.value || undefined) as ConcernPriority | undefined }))}
          >
            <option value="">All priorities</option>
            {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as ConcernPriority[]).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={!!manageFilters.unassignedOnly}
              onChange={(e) => setManageFilters((f) => ({ ...f, unassignedOnly: e.target.checked }))}
            />
            Unassigned only
          </label>
        </div>
      )}

      {tab !== 'raise' && (
        <Card className="divide-y divide-slate-100">
          {loadingList && (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          )}
          {!loadingList && list.map((c) => <ConcernRow key={c.id} c={c} onOpen={() => setSelectedId(c.id)} />)}
          {!loadingList && !list.length && (
            <div className="px-5 py-10 text-center text-slate-400">
              {tab === 'mine' && "You haven't raised any concerns yet."}
              {tab === 'assigned' && 'No concerns are currently assigned to you.'}
              {tab === 'manage' && 'No concerns match these filters.'}
            </div>
          )}
        </Card>
      )}

      {selectedId && profile && (
        <ConcernDetailPanel
          concernId={selectedId}
          onClose={() => setSelectedId(null)}
          myProfileId={profile.id}
          canManageGlobally={capabilities.canManage}
          onChanged={refreshAfterChange}
        />
      )}
    </DashboardLayout>
  );
}
