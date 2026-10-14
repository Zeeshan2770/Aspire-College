import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Search, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge, Button, Card, Input, Label, Modal, Select, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import QueriesPanel from './QueriesPanel';
import { newQueryCount } from '@/services/queries';
import {
  ADMISSION_STATUSES, Admission, AdmissionNote, AdmissionStatus, ContactMessage,
  addAdmissionNote, setAdmissionMessage, admissionStatusCounts, createStudentFromAdmission, listAdmissionNotes,
  listAdmissions, listClassesAndSections, listInquiries, setInquiryRead, unreadInquiryCount, updateAdmissionStatus,
} from '@/services/admissions';

const PAGE_SIZE = 15;
const TONE: Record<AdmissionStatus, 'slate' | 'amber' | 'green' | 'red'> = {
  SUBMITTED: 'slate', UNDER_REVIEW: 'amber', ACCEPTED: 'green', REJECTED: 'red',
};
const label = (s: AdmissionStatus) => ADMISSION_STATUSES.find((x) => x.value === s)?.label ?? s;
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>Page {page} of {Math.ceil(total / PAGE_SIZE)} · {total} total</span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button size="sm" variant="secondary" disabled={page * PAGE_SIZE >= total} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

/** Link to the Message Center, prefilled from the application. */
function messageLink(app: Admission, channel: 'email' | 'whatsapp' | 'sms') {
  const template = app.status === 'ACCEPTED' ? 'adm-accepted' : app.status === 'REJECTED' ? 'adm-declined' : app.status === 'UNDER_REVIEW' ? 'adm-review' : 'adm-received';
  const q = new URLSearchParams({
    template, channel, to: channel === 'email' ? (app.email ?? '') : app.phone,
    name: app.full_name, application_no: app.application_no, program: app.program_applied,
  });
  return `/admin/messages?${q.toString()}`;
}

function Detail({ k, v }: { k: string; v?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{v === null || v === undefined || v === '' ? <span className="text-slate-500">Not provided</span> : v}</dd>
    </div>
  );
}

/* ---------------------------- Applications ---------------------------- */

function ApplicationModal({ app, canManage, canCreateStudent, onClose, onChanged }: {
  app: Admission; canManage: boolean; canCreateStudent: boolean; onClose: () => void; onChanged: () => void;
}) {
  const [notes, setNotes] = useState<AdmissionNote[]>([]);
  const [status, setStatus] = useState<AdmissionStatus>(app.status);
  const [note, setNote] = useState('');
  const [pubMsg, setPubMsg] = useState(app.applicant_message ?? '');
  const [busy, setBusy] = useState(false);
  const [studentOpen, setStudentOpen] = useState(false);
  const locked = !!app.student_id;

  const [autoSending, setAutoSending] = useState(false);
  async function sendAutoEmail() {
    setAutoSending(true);
    const { data, error } = await supabase.functions.invoke('notify-applicant', { body: { application_id: app.id } });
    setAutoSending(false);
    if (error || data?.error) toast.error(data?.error ?? 'Automatic email is not set up yet. Use the Email button to send it by hand.');
    else toast.success('Email sent to the applicant.');
  }

  const loadNotes = useCallback(() => {
    listAdmissionNotes(app.id).then(setNotes).catch(() => toast.error('Unable to load notes.'));
  }, [app.id]);
  useEffect(loadNotes, [loadNotes]);

  async function saveStatus() {
    if (status === 'REJECTED' && !window.confirm(`Reject the application from ${app.full_name}?`)) return;
    setBusy(true);
    try {
      await updateAdmissionStatus(app.id, status, note.trim() || undefined);
      toast.success(`Status changed to ${label(status)}.`);
      setNote('');
      onChanged();
      loadNotes();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function savePubMsg() {
    setBusy(true);
    try { await setAdmissionMessage(app.id, pubMsg.trim()); toast.success(pubMsg.trim() ? 'Message saved. The applicant can now see it.' : 'Message removed.'); onChanged(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await addAdmissionNote(app.id, note.trim());
      setNote('');
      loadNotes();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title={`${app.full_name} · ${app.application_no}`} wide>
        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
          <div className="flex items-center gap-3">
            <Badge tone={TONE[app.status]}>{label(app.status)}</Badge>
            <span className="text-xs text-slate-500">Submitted {dt(app.created_at)}{app.reviewed_at ? ` · Last reviewed ${dt(app.reviewed_at)}` : ''}</span>
          </div>

          <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <h4 className="text-sm font-bold text-slate-700">Send a message to the applicant</h4>
            <p className="mt-0.5 text-xs text-slate-500">Opens the Message Center with this applicant's details already filled in. A template matching the current status is chosen for you.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {([['whatsapp', 'WhatsApp', MessageCircle], ['sms', 'SMS', Smartphone]] as const).map(([ch, lbl, Icon]) => (
                <Link key={ch} to={messageLink(app, ch)} className="inline-flex items-center gap-2 rounded-full border border-[#CBD5E4] bg-white px-4 py-2 text-sm font-semibold text-[#41516B] hover:border-[#AEBBD0]"><Icon size={16} /> {lbl}</Link>
              ))}
              {app.email && (
                <Button size="sm" variant="secondary" disabled={autoSending} onClick={sendAutoEmail}>
                  <Mail size={16} /> {autoSending ? 'Sending…' : 'Email automatically'}
                </Button>
              )}
              {app.email && <Link to={messageLink(app, 'email')} className="inline-flex items-center gap-2 rounded-full border border-[#CBD5E4] bg-white px-4 py-2 text-sm font-semibold text-[#41516B] hover:border-[#AEBBD0]"><Mail size={16} /> Email</Link>}
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-sm font-bold text-slate-700">Applicant</h4>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail k="Father's / guardian's name" v={app.father_name} />
              <Detail k="Date of birth" v={fmt(app.date_of_birth)} />
              <Detail k="Gender" v={app.gender} />
              <Detail k="Phone" v={app.phone} />
              <Detail k="Email" v={app.email} />
              <Detail k="Address" v={app.address} />
            </dl>
          </section>
          <section>
            <h4 className="mb-2 text-sm font-bold text-slate-700">Academic</h4>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail k="Previous institution" v={app.previous_institution} />
              <Detail k="Previous class" v={app.previous_class} />
              <Detail k="Percentage" v={app.percentage !== null ? `${app.percentage}%` : null} />
              <Detail k="Board" v={app.board} />
              <Detail k="Passing year" v={app.passing_year} />
            </dl>
          </section>
          <section>
            <h4 className="mb-2 text-sm font-bold text-slate-700">Program and guardian</h4>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail k="Applying for" v={app.program_applied} />
              <Detail k="Preferred class" v={app.preferred_class} />
              <Detail k="Guardian" v={app.guardian_name} />
              <Detail k="Relationship" v={app.guardian_relationship} />
              <Detail k="Guardian phone" v={app.guardian_phone} />
            </dl>
          </section>

          {canManage && (
            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 text-sm font-bold text-slate-700">Review</h4>
              {locked ? (
                <p className="text-sm text-slate-600">A student record has been created for this applicant, so the status can no longer be changed.</p>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-48">
                    <Label>Status</Label>
                    <Select value={status} onChange={(e) => setStatus(e.target.value as AdmissionStatus)}>
                      {ADMISSION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </Select>
                  </div>
                  <Button disabled={busy || status === app.status} onClick={saveStatus}>Update status</Button>
                </div>
              )}
              <div className="mt-4">
                <Label>Internal note (staff only)</Label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder={locked ? 'Add a note' : 'Add a note (saved with the status change, or on its own)'}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                />
                <Button className="mt-2" size="sm" variant="secondary" disabled={busy || !note.trim()} onClick={saveNote}>Add note only</Button>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <Label>Message to the applicant (shown on the public status page)</Label>
                <textarea
                  value={pubMsg}
                  onChange={(e) => setPubMsg(e.target.value)}
                  rows={2}
                  maxLength={600}
                  placeholder="For example: Please bring your original documents to the admissions office by 20 October."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                />
                <p className="mt-1 text-xs text-slate-500">The applicant sees this together with the status when they check with their application number and phone. Do not write private details.</p>
                <Button className="mt-2" size="sm" variant="secondary" disabled={busy || pubMsg.trim() === (app.applicant_message ?? '').trim()} onClick={savePubMsg}>Save message</Button>
              </div>
            </section>
          )}

          {app.status === 'ACCEPTED' && (
            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-2 text-sm font-bold text-slate-700">Student record</h4>
              {app.student_id ? (
                <p className="text-sm text-slate-600">Student record created. <Link to="/admin/students" className="font-medium text-brand-700 hover:underline">Open Students</Link></p>
              ) : canCreateStudent ? (
                <Button onClick={() => setStudentOpen(true)}>Create student record</Button>
              ) : (
                <p className="text-sm text-slate-500">Creating a student record needs both admissions and student management permission.</p>
              )}
            </section>
          )}

          <section>
            <h4 className="mb-2 text-sm font-bold text-slate-700">Notes and history</h4>
            {!notes.length ? <p className="text-sm text-slate-500">No notes yet.</p> : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <p className="text-slate-800">{n.body}</p>
                    <p className="mt-1 text-xs text-slate-500">{n.author_name} · {dt(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Modal>
      {studentOpen && <CreateStudentModal app={app} onClose={() => setStudentOpen(false)} onDone={() => { setStudentOpen(false); onChanged(); onClose(); }} />}
    </>
  );
}

function CreateStudentModal({ app, onClose, onDone }: { app: Admission; onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<{ classes: { id: string; name: string }[]; sections: { id: string; name: string; class_id: string }[] } | null>(null);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [roll, setRoll] = useState('');
  const [session, setSession] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { listClassesAndSections().then(setData).catch((e) => setErr(e.message)); }, []);
  const sections = (data?.sections ?? []).filter((s) => s.class_id === classId);

  async function submit() {
    setErr(null);
    if (!classId || !sectionId || !roll.trim()) { setErr('Select a class and section and enter a roll number.'); return; }
    setBusy(true);
    try {
      await createStudentFromAdmission({ admissionId: app.id, classId, sectionId, rollNumber: roll.trim(), sessionLabel: session.trim() || undefined });
      toast.success('Student record created.');
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Create student record">
      <p className="mb-4 text-sm text-slate-600">Creates a student record for <strong>{app.full_name}</strong> using the details from the application.</p>
      {!data && !err ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <div className="space-y-4">
          <div><Label>Class</Label>
            <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}>
              <option value="">Select class</option>{data?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select></div>
          <div><Label>Section</Label>
            <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
              <option value="">Select section</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select></div>
          <div><Label>Roll number</Label><Input value={roll} onChange={(e) => setRoll(e.target.value)} /></div>
          <div><Label>Session (optional)</Label><Input value={session} onChange={(e) => setSession(e.target.value)} placeholder="e.g. 2026-28" /></div>
          {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create student'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Applications({ canManage, canCreateStudent }: { canManage: boolean; canCreateStudent: boolean }) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Admission[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<AdmissionStatus, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Admission | null>(null);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [res, c] = await Promise.all([listAdmissions({ search: debounced, status, page, pageSize: PAGE_SIZE }), admissionStatusCounts()]);
      setRows(res.rows); setTotal(res.total); setCounts(c);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [debounced, status, page]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ADMISSION_STATUSES.map((s) => (
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
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
            <Input className="pl-9" placeholder="Search by name, application number or phone" aria-label="Search applications" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-48">
            <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>{ADMISSION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center text-sm text-red-700" role="alert">{error} <button className="ml-2 underline" onClick={load}>Retry</button></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-[#F4F7FC] text-left text-xs font-semibold tracking-wide text-[#5B6B83]">
                <tr><th className="px-4 py-3">Application</th><th className="px-4 py-3">Applicant</th><th className="px-4 py-3">Program</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((a) => (
                  <tr key={a.id} className="cursor-pointer hover:bg-slate-50/60" onClick={() => setOpen(a)}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{a.application_no}</td>
                    <td className="px-4 py-3"><button className="font-medium text-ink-900 hover:underline" onClick={(e) => { e.stopPropagation(); setOpen(a); }}>{a.full_name}</button><p className="text-xs text-slate-500">{a.phone}</p></td>
                    <td className="px-4 py-3 text-slate-700">{a.program_applied}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(a.created_at)}</td>
                    <td className="px-4 py-3"><Badge tone={TONE[a.status]}>{label(a.status)}</Badge></td>
                  </tr>
                ))}
                {loading && !rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center"><Spinner className="mx-auto" /></td></tr>}
                {!loading && !rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">{debounced || status ? 'No applications match your search.' : 'No applications have been submitted yet.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} total={total} onPage={setPage} />
      </Card>

      {open && <ApplicationModal app={open} canManage={canManage} canCreateStudent={canCreateStudent} onClose={() => setOpen(null)} onChanged={() => { load(); }} />}
    </>
  );
}

/* ------------------------------ Inquiries ------------------------------ */

function Inquiries({ canManage, onUnread }: { canManage: boolean; onUnread: (n: number) => void }) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ContactMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await listInquiries(page, PAGE_SIZE);
      setRows(res.rows); setTotal(res.total);
      onUnread(await unreadInquiryCount());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, onUnread]);
  useEffect(() => { load(); }, [load]);

  async function toggleRead(m: ContactMessage, isRead: boolean) {
    try { await setInquiryRead(m.id, isRead); load(); } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Card>
      {error ? (
        <div className="p-8 text-center text-sm text-red-700" role="alert">{error} <button className="ml-2 underline" onClick={load}>Retry</button></div>
      ) : loading && !rows.length ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : !rows.length ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">No messages have been received yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((m) => {
            const isOpen = openId === m.id;
            return (
              <li key={m.id} className="px-4 py-3">
                <button className="flex w-full items-start justify-between gap-3 text-left" aria-expanded={isOpen}
                  onClick={() => { setOpenId(isOpen ? null : m.id); if (!isOpen && !m.is_read && canManage) toggleRead(m, true); }}>
                  <span>
                    <span className={`text-sm ${m.is_read ? 'text-slate-700' : 'font-semibold text-ink-900'}`}>{m.subject || 'No subject'}</span>
                    <span className="block text-xs text-slate-500">{m.name} · {dt(m.created_at)}</span>
                  </span>
                  {!m.is_read && <Badge tone="blue">New</Badge>}
                </button>
                {isOpen && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                    <p className="whitespace-pre-wrap text-slate-800">{m.message}</p>
                    <p className="mt-3 text-xs text-slate-500">
                      {m.email && <>Email: <a className="text-brand-700 hover:underline" href={`mailto:${m.email}`}>{m.email}</a> </>}
                      {m.phone && <>Phone: <a className="text-brand-700 hover:underline" href={`tel:${m.phone}`}>{m.phone}</a></>}
                    </p>
                    {(m.email || m.phone) && (
                      <Link className="mt-3 mr-2 inline-flex items-center gap-2 rounded-full border border-[#CBD5E4] bg-white px-4 py-2 text-sm font-semibold text-[#41516B] hover:border-[#AEBBD0]"
                        to={`/admin/messages?${new URLSearchParams({ template: 'contact-reply', channel: m.email ? 'email' : 'whatsapp', to: m.email ?? m.phone ?? '', name: m.name, subject: m.subject ?? 'your message' }).toString()}`}>
                        <Mail size={16} /> Reply by message
                      </Link>
                    )}
                    {canManage && m.is_read && <Button className="mt-3" size="sm" variant="secondary" onClick={() => toggleRead(m, false)}>Mark as unread</Button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} total={total} onPage={setPage} />
    </Card>
  );
}

/* -------------------------------- Page --------------------------------- */

export default function AdmissionsPage() {
  const { profile } = useAuth();
  const { can, loading } = usePermissions();
  const [tab, setTab] = useState<'applications' | 'inquiries' | 'queries'>('applications');
  const [unread, setUnread] = useState(0);
  const [newQ, setNewQ] = useState(0);

  const role = profile?.role;
  const canManage = can('manage_admissions');
  const canView = canManage || role === 'PRINCIPAL';

  useEffect(() => { if (canView) { unreadInquiryCount().then(setUnread); newQueryCount().then(setNewQ); } }, [canView]);

  const tabCls = (t: string) => `-mb-px border-b-2 px-1 pb-3 text-sm font-semibold ${tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">Admissions</h1>
        <p className="mt-1 text-sm text-[var(--text-2)]">Applications, contact-form messages and questions from the public website.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !canView ? (
        <Card className="p-8 text-center text-sm text-slate-600">You do not have permission to view admissions. Please contact the Super Admin.</Card>
      ) : (
        <>
          {role === 'PRINCIPAL' && <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">You have read-only access to admissions.</p>}
          <div className="mb-5 flex gap-6 border-b border-slate-200" role="tablist">
            <button role="tab" aria-selected={tab === 'applications'} className={tabCls('applications')} onClick={() => setTab('applications')}>Applications</button>
            <button role="tab" aria-selected={tab === 'inquiries'} className={tabCls('inquiries')} onClick={() => setTab('inquiries')}>
              Inquiries {unread > 0 && <span className="ml-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">{unread}</span>}
            </button>
            <button role="tab" aria-selected={tab === 'queries'} className={tabCls('queries')} onClick={() => setTab('queries')}>
              Questions {newQ > 0 && <span className="ml-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">{newQ}</span>}
            </button>
          </div>
          {tab === 'applications' && <Applications canManage={canManage} canCreateStudent={canManage && can('manage_students')} />}
          {tab === 'inquiries' && <Inquiries canManage={canManage} onUnread={setUnread} />}
          {tab === 'queries' && <QueriesPanel canManage={canManage} onNew={setNewQ} />}
        </>
      )}
    </DashboardLayout>
  );
}
