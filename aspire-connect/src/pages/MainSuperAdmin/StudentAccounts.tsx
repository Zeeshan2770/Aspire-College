import { useEffect, useMemo, useState } from 'react';
import { UserPlus, Copy, Eye, EyeOff, RefreshCcw, Trash2, Search, Power, PowerOff, Users, Download, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Select, Label, Modal, Badge, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { ClassRow, SectionRow } from '@/types';
import { listClasses, listSections } from '@/services/academics';
import {
  createStudentLogin, listStudentCredentials, resetStudentPassword, setStudentAccountActive, deleteStudentAccount,
  bulkCreateStudentLogins, BulkCreateResult,
} from '@/services/studentAccounts';
import { exportCredentialsToCsv } from '@/services/csv';
import { logActivity } from '@/services/activityLog';

export default function StudentAccountsPage() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [vault, setVault] = useState<any[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'no-account' | 'accounts'>('no-account');

  const [creating, setCreating] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string; full_name: string; student_uid: string } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busyRow, setBusyRow] = useState<string | null>(null);

  // Bulk creation: narrow the "without account" list by section and/or a
  // roll-number range, hand-pick individual students on top of that, then
  // create every selected account in one go.
  const [bulkClassFilter, setBulkClassFilter] = useState('');
  const [bulkSectionFilter, setBulkSectionFilter] = useState('');
  const [rollFrom, setRollFrom] = useState('');
  const [rollTo, setRollTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkResults, setBulkResults] = useState<BulkCreateResult[] | null>(null);

  async function reload() {
    setLoading(true);
    const [{ data: stu }, creds, cls, sec] = await Promise.all([
      supabase.from('students').select('*, classes(name), sections(name)').eq('status', 'ACTIVE').order('roll_number'),
      listStudentCredentials(),
      listClasses(),
      listSections(),
    ]);
    setStudents((stu as any) ?? []);
    setVault(creds);
    setClasses(cls);
    setSections(sec);
    setLoading(false);
  }
  useEffect(() => { reload(); }, []);

  const withoutAccount = useMemo(
    () => students.filter((s: any) => !s.user_id && (`${s.full_name} ${s.roll_number}`.toLowerCase().includes(search.toLowerCase()))),
    [students, search]
  );
  const filteredVault = useMemo(
    () => vault.filter((v) => `${v.students?.full_name} ${v.students?.roll_number} ${v.student_uid}`.toLowerCase().includes(search.toLowerCase())),
    [vault, search]
  );

  const sectionOptions = useMemo(
    () => (bulkClassFilter ? sections.filter((sec) => sec.class_id === bulkClassFilter) : sections),
    [sections, bulkClassFilter]
  );

  // Numeric roll-number range compare — falls back to leaving a row in if
  // its roll number isn't purely numeric, so odd formats don't get silently dropped.
  function rollInRange(rollNumber: string): boolean {
    if (!rollFrom && !rollTo) return true;
    const n = parseInt(rollNumber, 10);
    if (Number.isNaN(n)) return true;
    if (rollFrom && n < parseInt(rollFrom, 10)) return false;
    if (rollTo && n > parseInt(rollTo, 10)) return false;
    return true;
  }

  const bulkCandidates = useMemo(
    () => withoutAccount.filter((s: any) => {
      if (bulkClassFilter && s.class_id !== bulkClassFilter) return false;
      if (bulkSectionFilter && s.section_id !== bulkSectionFilter) return false;
      if (!rollInRange(s.roll_number)) return false;
      return true;
    }),
    [withoutAccount, bulkClassFilter, bulkSectionFilter, rollFrom, rollTo]
  );

  const allCandidatesSelected = bulkCandidates.length > 0 && bulkCandidates.every((s: any) => selectedIds.has(s.id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllCandidates() {
    setSelectedIds((prev) => {
      if (allCandidatesSelected) {
        const next = new Set(prev);
        bulkCandidates.forEach((s: any) => next.delete(s.id));
        return next;
      }
      const next = new Set(prev);
      bulkCandidates.forEach((s: any) => next.add(s.id));
      return next;
    });
  }

  async function handleBulkCreate() {
    const targets = withoutAccount.filter((s: any) => selectedIds.has(s.id));
    if (!targets.length) return;
    if (!confirm(`Create ${targets.length} Student Portal account${targets.length === 1 ? '' : 's'}? Each student gets their own Student ID, username, and temporary password.`)) return;

    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length });
    const results = await bulkCreateStudentLogins(
      targets.map((s: any) => ({ id: s.id, full_name: s.full_name, roll_number: s.roll_number })),
      (done, total) => setBulkProgress({ done, total })
    );
    setBulkRunning(false);
    setBulkResults(results);
    setSelectedIds(new Set());

    const created = results.filter((r) => r.success).length;
    const failed = results.length - created;
    await logActivity({
      adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
      action: 'Bulk Student Accounts Created', target: `${created} student${created === 1 ? '' : 's'}`,
      description: `Created ${created} Student Portal account${created === 1 ? '' : 's'} in bulk${failed ? ` (${failed} failed)` : ''}.`,
    });
    reload();
  }

  async function handleCreate(student: any) {
    setCreating(student.id);
    try {
      const result = await createStudentLogin(student.id);
      await logActivity({
        adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
        action: 'Student Account Created', target: result.user.full_name,
        description: `Created Student Portal account ${result.user.student_uid} for ${result.user.full_name}.`,
      });
      setCreatedCreds({ username: result.user.username, password: result.password, full_name: result.user.full_name, student_uid: result.user.student_uid });
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create the student account.');
    } finally {
      setCreating(null);
    }
  }

  async function handleReset(row: any) {
    if (!confirm(`Generate a new temporary password for ${row.students?.full_name}? Their old password will stop working immediately.`)) return;
    setBusyRow(row.id);
    try {
      const result = await resetStudentPassword(row.user_id);
      await logActivity({
        adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
        action: 'Student Password Reset', target: row.students?.full_name,
        description: `Issued a new temporary password for ${row.students?.full_name}.`,
      });
      setCreatedCreds({ username: row.username, password: result.password, full_name: row.students?.full_name, student_uid: row.student_uid });
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to reset password.');
    } finally {
      setBusyRow(null);
    }
  }

  async function handleToggleActive(row: any) {
    const nextActive = row.profiles?.is_active === false;
    setBusyRow(row.id);
    try {
      await setStudentAccountActive(row.user_id, nextActive);
      await logActivity({
        adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
        action: nextActive ? 'Student Account Enabled' : 'Student Account Disabled', target: row.students?.full_name,
        description: `${nextActive ? 'Enabled' : 'Disabled'} the Student Portal account for ${row.students?.full_name}.`,
      });
      toast.success(`Account ${nextActive ? 'enabled' : 'disabled'}.`);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update account status.');
    } finally {
      setBusyRow(null);
    }
  }

  async function handleDelete(row: any) {
    const name = row.students?.full_name ?? 'this student';
    if (!confirm(`Permanently delete ${name}'s Student Portal login?\n\nThe student's academic record and attendance history are NOT affected — only their login is removed. This cannot be undone.`)) return;
    setBusyRow(row.id);
    try {
      await deleteStudentAccount(row.user_id);
      await logActivity({
        adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
        action: 'Student Account Deleted', target: name, description: `Deleted the Student Portal login for ${name} (roster record kept).`,
      });
      toast.success(`${name}'s account has been deleted.`);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to delete this account.');
    } finally {
      setBusyRow(null);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied.`);
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink-900">Student Accounts</h1>
        <p className="text-sm text-slate-500">Create and manage Student Portal logins. Every student keeps their roster record whether or not they have an account.</p>
      </div>

      <Card className="mb-4 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => setTab('no-account')} className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${tab === 'no-account' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            Without Account ({students.filter((s: any) => !s.user_id).length})
          </button>
          <button onClick={() => setTab('accounts')} className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${tab === 'accounts' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            Existing Accounts ({vault.length})
          </button>
        </div>
        <div className="relative max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name or roll number…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : tab === 'no-account' ? (
        <>
          <Card className="mb-4 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users size={15} className="text-brand-600" />
              <p className="text-sm font-bold text-ink-900">Bulk Create Accounts</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label>Class</Label>
                <Select value={bulkClassFilter} onChange={(e) => { setBulkClassFilter(e.target.value); setBulkSectionFilter(''); }}>
                  <option value="">All classes</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div>
                <Label>Section</Label>
                <Select value={bulkSectionFilter} onChange={(e) => setBulkSectionFilter(e.target.value)}>
                  <option value="">All sections</option>
                  {sectionOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
              <div>
                <Label>Roll # From</Label>
                <Input type="number" placeholder="e.g. 101" value={rollFrom} onChange={(e) => setRollFrom(e.target.value)} />
              </div>
              <div>
                <Label>Roll # To</Label>
                <Input type="number" placeholder="e.g. 150" value={rollTo} onChange={(e) => setRollTo(e.target.value)} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <button onClick={toggleSelectAllCandidates} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-ink-900">
                {allCandidatesSelected ? <CheckSquare size={15} className="text-brand-600" /> : <Square size={15} />}
                Select all matching ({bulkCandidates.length})
              </button>
              <Button
                onClick={handleBulkCreate}
                disabled={!selectedIds.size || bulkRunning}
                className="!py-1.5 !px-3.5 text-xs"
              >
                <UserPlus size={14} className="mr-1 inline" />
                {bulkRunning ? `Creating ${bulkProgress.done}/${bulkProgress.total}…` : `Create ${selectedIds.size || ''} Selected Account${selectedIds.size === 1 ? '' : 's'}`}
              </Button>
            </div>
          </Card>

          <Card className="divide-y divide-slate-100">
            {withoutAccount.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleSelected(s.id)} className="shrink-0 text-slate-400 hover:text-brand-600">
                    {selectedIds.has(s.id) ? <CheckSquare size={17} className="text-brand-600" /> : <Square size={17} />}
                  </button>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{s.full_name}</p>
                    <p className="text-xs text-slate-400">Roll #{s.roll_number} — {s.classes?.name ?? ''} {s.sections?.name ?? ''}</p>
                  </div>
                </div>
                <Button onClick={() => handleCreate(s)} disabled={creating === s.id} className="!py-1.5 !px-3 text-xs">
                  <UserPlus size={14} className="mr-1 inline" /> {creating === s.id ? 'Creating…' : 'Create Account'}
                </Button>
              </div>
            ))}
            {!withoutAccount.length && <div className="px-4 py-14 text-center text-slate-400">Every active student already has an account, or none match your search.</div>}
          </Card>
        </>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Temp Password</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVault.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {row.students?.full_name}
                    <p className="text-xs font-normal text-slate-400">Roll #{row.students?.roll_number} — {row.students?.classes?.name} {row.students?.sections?.name}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.student_uid}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-700">{row.username}</span>
                      <button onClick={() => copy(row.username, 'Username')} className="rounded p-1 text-slate-400 hover:bg-slate-100"><Copy size={13} /></button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-mono">
                      <span>{revealed[row.id] ? row.temp_password : '••••••••••'}</span>
                      <button onClick={() => setRevealed((r) => ({ ...r, [row.id]: !r[row.id] }))} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                        {revealed[row.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button onClick={() => copy(row.temp_password, 'Password')} className="rounded p-1 text-slate-400 hover:bg-slate-100"><Copy size={13} /></button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {row.profiles?.is_active === false ? <Badge tone="red">Disabled</Badge> : <Badge tone="green">Active</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        disabled={busyRow === row.id}
                        onClick={() => handleReset(row)}
                        className="flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                      >
                        <RefreshCcw size={13} /> Reset
                      </button>
                      <button
                        disabled={busyRow === row.id}
                        onClick={() => handleToggleActive(row)}
                        className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                      >
                        {row.profiles?.is_active === false ? <Power size={13} /> : <PowerOff size={13} />}
                        {row.profiles?.is_active === false ? 'Enable' : 'Disable'}
                      </button>
                      <button
                        disabled={busyRow === row.id}
                        onClick={() => handleDelete(row)}
                        className="flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredVault.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No accounts match.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={!!createdCreds} onClose={() => setCreatedCreds(null)} title="Credentials Ready">
        {createdCreds && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Share these with <strong>{createdCreds.full_name}</strong>. They're also saved permanently in the vault above.</p>
            <div className="space-y-2 rounded-xl bg-slate-50 p-3 font-mono text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Student ID</p>
                <div className="flex items-center justify-between"><span>{createdCreds.student_uid}</span><button onClick={() => copy(createdCreds.student_uid, 'Student ID')} className="rounded p-1 text-slate-400 hover:bg-slate-200"><Copy size={14} /></button></div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Username</p>
                <div className="flex items-center justify-between"><span>{createdCreds.username}</span><button onClick={() => copy(createdCreds.username, 'Username')} className="rounded p-1 text-slate-400 hover:bg-slate-200"><Copy size={14} /></button></div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Temporary Password</p>
                <div className="flex items-center justify-between"><span>{createdCreds.password}</span><button onClick={() => copy(createdCreds.password, 'Temporary Password')} className="rounded p-1 text-slate-400 hover:bg-slate-200"><Copy size={14} /></button></div>
              </div>
            </div>
            <p className="text-xs text-slate-400">The student will be asked to change this password after their first login.</p>
            <Button className="w-full" onClick={() => setCreatedCreds(null)}>Done</Button>
          </div>
        )}
      </Modal>

      <Modal open={bulkRunning} onClose={() => {}} title="Creating Accounts…">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Creating {bulkProgress.done} of {bulkProgress.total} accounts. Please don't close this tab.</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${bulkProgress.total ? Math.round((bulkProgress.done / bulkProgress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      </Modal>

      <Modal open={!!bulkResults} onClose={() => setBulkResults(null)} title="Bulk Account Creation Complete" wide>
        {bulkResults && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              <strong className="text-emerald-600">{bulkResults.filter((r) => r.success).length} created</strong>
              {bulkResults.some((r) => !r.success) && <>, <strong className="text-red-600">{bulkResults.filter((r) => !r.success).length} failed</strong></>}.
              {' '}All new credentials are saved permanently in the vault above.
            </p>
            <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Student ID</th>
                    <th className="px-3 py-2">Username</th>
                    <th className="px-3 py-2">Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bulkResults.map((r) => (
                    <tr key={r.studentId} className={r.success ? '' : 'bg-red-50/60'}>
                      <td className="px-3 py-2 font-medium text-ink-900">{r.full_name}<span className="ml-1 font-normal text-slate-400">#{r.roll_number}</span></td>
                      {r.success ? (
                        <>
                          <td className="px-3 py-2 font-mono">{r.student_uid}</td>
                          <td className="px-3 py-2 font-mono">{r.username}</td>
                          <td className="px-3 py-2 font-mono">{r.password}</td>
                        </>
                      ) : (
                        <td className="px-3 py-2 text-red-600" colSpan={3}>{r.error}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => exportCredentialsToCsv(
                  bulkResults.filter((r) => r.success).map((r) => ({
                    full_name: r.full_name, roll_number: r.roll_number,
                    student_uid: r.student_uid!, username: r.username!, temp_password: r.password!,
                  }))
                )}
                disabled={!bulkResults.some((r) => r.success)}
              >
                <Download size={14} className="mr-1 inline" /> Export CSV
              </Button>
              <Button className="flex-1" onClick={() => setBulkResults(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
