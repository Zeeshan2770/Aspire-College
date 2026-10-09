import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge, Button, Card, Input, Modal, Select, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { FacultyInput, FacultyRow, listFaculty, saveFaculty } from '@/services/website';
import { OptionSelect, useOptions } from '@/components/OptionSelect';
import AiAssist from '@/components/AiAssist';
import { Checkbox, Field, ImageField, NoAccess, PAGE_SIZE, Pager, ReadOnlyNote, textareaCls } from './shared';

const EMPTY: FacultyInput = {
  full_name: '', designation: '', department: '', subject: '', qualification: '', bio: '',
  photo_url: null, email: '', phone: '', status: 'ACTIVE', is_public: true, display_order: 0,
};
const PHONE = /^[0-9+\-\s]{10,16}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function FacultyForm({ row, onClose, onSaved, canManageLists }: { row: FacultyRow | null; onClose: () => void; onSaved: () => void; canManageLists: boolean }) {
  const [f, setF] = useState<FacultyInput>(row ? { ...EMPTY, ...row } : EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof FacultyInput>(k: K, v: FacultyInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const txt = (k: keyof FacultyInput) => ({ value: (f[k] as string) ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never) });

  async function submit() {
    setErr(null);
    if (!f.full_name.trim()) return setErr('Enter the faculty member\'s name.');
    if (f.email?.trim() && !EMAIL.test(f.email.trim())) return setErr('Enter a valid email address.');
    if (f.phone?.trim() && !PHONE.test(f.phone.trim())) return setErr('Enter a valid phone number (10 to 16 digits).');
    const clean = (v: string | null) => (v?.trim() ? v.trim() : null);
    setBusy(true);
    try {
      await saveFaculty(row?.id ?? null, {
        ...f, full_name: f.full_name.trim(), designation: clean(f.designation), department: clean(f.department), subject: clean(f.subject),
        qualification: clean(f.qualification), bio: clean(f.bio), email: clean(f.email), phone: clean(f.phone), display_order: Number(f.display_order) || 0,
      });
      toast.success(row ? 'Faculty member updated.' : 'Faculty member added.');
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={row ? 'Edit faculty member' : 'Add faculty member'} wide>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name *"><Input {...txt('full_name')} /></Field>
          <Field label="Designation"><OptionSelect category="faculty_designation" title="Designation" placeholder="Select designation" canManage={canManageLists} value={f.designation ?? ''} onChange={(v) => set('designation', v)} /></Field>
          <Field label="Department"><OptionSelect category="faculty_department" title="Department" placeholder="Select department" canManage={canManageLists} value={f.department ?? ''} onChange={(v) => set('department', v)} /></Field>
          <Field label="Subject"><OptionSelect category="faculty_subject" title="Subject" placeholder="Select subject" canManage={canManageLists} value={f.subject ?? ''} onChange={(v) => set('subject', v)} /></Field>
          <Field label="Qualification"><OptionSelect category="faculty_qualification" title="Qualification" placeholder="Select qualification" canManage={canManageLists} value={f.qualification ?? ''} onChange={(v) => set('qualification', v)} /></Field>
          <Field label="Display order" hint="Lower numbers appear first on the website."><Input type="number" value={f.display_order} onChange={(e) => set('display_order', Number(e.target.value))} /></Field>
          <Field label="Email (internal only)"><Input type="email" {...txt('email')} /></Field>
          <Field label="Phone (internal only)"><Input type="tel" {...txt('phone')} /></Field>
        </div>
        <Field label="Short profile">
          <textarea rows={3} className={textareaCls} value={f.bio ?? ''} onChange={(e) => set('bio', e.target.value)} />
          <AiAssist
            kind="faculty_bio"
            context={{ name: f.full_name, designation: f.designation, department: f.department, subject: f.subject, qualification: f.qualification }}
            value={f.bio ?? ''}
            onApply={(t) => set('bio', t)}
            notesHint="e.g. what they teach, their qualifications, responsibilities or interests. Only facts you type here (or in the fields above) are used."
          />
        </Field>
        <ImageField label="Photograph" value={f.photo_url} folder="faculty" onChange={(u) => set('photo_url', u)} />
        <div className="flex flex-wrap items-center gap-6">
          <div className="w-40"><Field label="Status">
            <Select value={f.status} onChange={(e) => set('status', e.target.value as 'ACTIVE' | 'INACTIVE')}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></Select>
          </Field></div>
          <Checkbox label="Show on the public Faculty page" checked={f.is_public} onChange={(v) => set('is_public', v)} />
        </div>
        <p className="text-xs text-slate-500">Email and phone are never shown on the public website. Inactive faculty are hidden from the public page.</p>
        {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function FacultyPage() {
  const { profile } = useAuth();
  const { can, loading: permLoading } = usePermissions();
  const canEdit = can('manage_faculty');
  const canView = canEdit || profile?.role === 'PRINCIPAL' || profile?.role === 'SUB_SUPER_ADMIN';

  const [rows, setRows] = useState<FacultyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<FacultyRow | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await listFaculty()); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const { options: deptOptions } = useOptions('faculty_department');
  const depts = useMemo(() => Array.from(new Set([...deptOptions.map((o) => o.label), ...(rows.map((r) => r.department).filter(Boolean) as string[])])).sort(), [rows, deptOptions]);
  const filtered = useMemo(() => rows.filter((r) =>
    (!dept || r.department === dept) && (!status || r.status === status) &&
    (!q.trim() || [r.full_name, r.subject, r.designation].some((x) => x?.toLowerCase().includes(q.trim().toLowerCase())))), [rows, q, dept, status]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function toggleStatus(r: FacultyRow) {
    const next = r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (next === 'INACTIVE' && !window.confirm(`Mark ${r.full_name} as inactive? They will be hidden from the public website.`)) return;
    try { const { id, ...rest } = r; await saveFaculty(id, { ...rest, status: next }); toast.success(`${r.full_name} is now ${next.toLowerCase()}.`); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Faculty</h1>
          <p className="text-sm text-slate-500">Teaching staff. Active faculty marked public appear on the college website.</p>
        </div>
        {canEdit && <Button onClick={() => setEditing('new')}><Plus size={16} /> Add faculty</Button>}
      </div>

      {permLoading ? <div className="flex justify-center py-16"><Spinner /></div> : !canView ? <NoAccess /> : (
        <>
          {!canEdit && <ReadOnlyNote />}
          <Card>
            <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                <Input className="pl-9" aria-label="Search faculty" placeholder="Search by name, subject or designation" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
              </div>
              <div className="w-48"><Select aria-label="Department" value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }}><option value="">All departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</Select></div>
              <div className="w-40"><Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></Select></div>
            </div>
            {error ? <div className="p-8 text-center text-sm text-red-700" role="alert">{error} <button className="ml-2 underline" onClick={load}>Retry</button></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Designation</th><th className="px-4 py-3">Department / Subject</th><th className="px-4 py-3">Website</th><th className="px-4 py-3">Status</th>{canEdit && <th className="px-4 py-3 text-right">Actions</th>}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageRows.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3"><div className="flex items-center gap-3">
                          {r.photo_url ? <img src={r.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500" aria-hidden="true">{r.full_name.charAt(0)}</span>}
                          <span className="font-medium text-ink-900">{r.full_name}</span></div></td>
                        <td className="px-4 py-3 text-slate-700">{r.designation ?? '–'}</td>
                        <td className="px-4 py-3 text-slate-600">{[r.department, r.subject].filter(Boolean).join(' · ') || '–'}</td>
                        <td className="px-4 py-3"><Badge tone={r.is_public && r.status === 'ACTIVE' ? 'blue' : 'slate'}>{r.is_public && r.status === 'ACTIVE' ? 'Public' : 'Hidden'}</Badge></td>
                        <td className="px-4 py-3"><Badge tone={r.status === 'ACTIVE' ? 'green' : 'slate'}>{r.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge></td>
                        {canEdit && <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" aria-label={`Edit ${r.full_name}`} onClick={() => setEditing(r)}><Pencil size={14} /> Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleStatus(r)}>{r.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}</Button>
                        </td>}
                      </tr>
                    ))}
                    {loading && !rows.length && <tr><td colSpan={6} className="px-4 py-10 text-center"><Spinner className="mx-auto" /></td></tr>}
                    {!loading && !pageRows.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{rows.length ? 'No faculty match your search.' : 'No faculty have been added yet.'}</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={page} total={filtered.length} onPage={setPage} />
          </Card>
        </>
      )}
      {editing && <FacultyForm canManageLists={canEdit} row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </DashboardLayout>
  );
}
