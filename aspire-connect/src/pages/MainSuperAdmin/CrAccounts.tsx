import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Copy, Eye, EyeOff, Pencil, RefreshCcw, Wand2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Label, Modal, Select, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { ClassRow, SectionRow } from '@/types';
import { listClasses, listSections } from '@/services/academics';
import { generateCrAccount, listCrCredentials, updateCrEmail, resetCrPassword, deleteCrAccount } from '@/services/crAccounts';
import { assignCr } from '@/services/crAssignments';
import { logActivity } from '@/services/activityLog';

function slugPreview(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export default function CrAccountsPage() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [vault, setVault] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [genOpen, setGenOpen] = useState(false);
  const [gen, setGen] = useState({ fullName: '', phone: '', classId: '', sectionId: '' });
  const [creating, setCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; full_name: string } | null>(null);

  const [emailModal, setEmailModal] = useState<{ open: boolean; row?: any; value: string }>({ open: false, value: '' });
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busyRow, setBusyRow] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    const [cls, sec, creds] = await Promise.all([listClasses(), listSections(), listCrCredentials()]);
    setClasses(cls); setSections(sec); setVault(creds);
    setLoading(false);
  }
  useEffect(() => { reload(); }, []);

  const genSections = useMemo(() => sections.filter((s) => s.class_id === gen.classId), [sections, gen.classId]);
  const genClassName = classes.find((c) => c.id === gen.classId)?.name ?? '';
  const genSectionName = sections.find((s) => s.id === gen.sectionId)?.name ?? '';
  const emailPreview = gen.classId && gen.sectionId
    ? `cr${slugPreview(genSectionName)}${slugPreview(genClassName)}@aspiretaunsa.com`
    : '—';

  async function handleGenerate() {
    if (!gen.fullName.trim()) { toast.error("The CR's real name is required — only the email and password are auto-generated."); return; }
    if (!gen.classId || !gen.sectionId) { toast.error('Please select a class and section.'); return; }
    setCreating(true);
    try {
      const result = await generateCrAccount({ fullName: gen.fullName.trim(), phone: gen.phone.trim() || undefined, classId: gen.classId, sectionId: gen.sectionId });
      // Immediately assign them to the section they were generated for.
      await assignCr({ crUserId: result.user.id, classId: gen.classId, sectionId: gen.sectionId, assignedBy: profile!.id });
      await logActivity({ adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role, action: 'CR Account Generated', target: result.user.full_name, description: `Auto-generated CR account (${result.user.email}) for ${genSectionName} — ${genClassName}.` });
      setCreatedCreds({ email: result.user.email, password: result.password, full_name: result.user.full_name });
      setGen({ fullName: '', phone: '', classId: '', sectionId: '' });
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to generate the CR account.');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateEmail() {
    if (!emailModal.row || !emailModal.value.trim()) return;
    setBusyRow(emailModal.row.cr_user_id);
    try {
      await updateCrEmail(emailModal.row.cr_user_id, emailModal.value.trim());
      await logActivity({ adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role, action: 'CR Email Changed', target: emailModal.row.profiles?.full_name, description: `Changed login email to ${emailModal.value.trim()}.` });
      toast.success('Email updated. The CR must use the new email next time they log in.');
      setEmailModal({ open: false, value: '' });
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update email.');
    } finally {
      setBusyRow(null);
    }
  }

  async function handleResetPassword(row: any) {
    if (!confirm(`Generate a new password for ${row.profiles?.full_name}? Their old password will stop working.`)) return;
    setBusyRow(row.cr_user_id);
    try {
      const result = await resetCrPassword(row.cr_user_id);
      await logActivity({ adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role, action: 'CR Password Reset', target: row.profiles?.full_name, description: `Issued a new password for ${row.profiles?.full_name}.` });
      setCreatedCreds({ email: row.email, password: result.password, full_name: row.profiles?.full_name });
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to reset password.');
    } finally {
      setBusyRow(null);
    }
  }

  async function handleDelete(row: any) {
    const name = row.profiles?.full_name ?? 'this CR';
    if (!confirm(`Permanently delete ${name}'s account?\n\nThis removes their login, section assignment, saved credentials, and history. This cannot be undone.`)) return;
    setBusyRow(row.cr_user_id);
    try {
      await deleteCrAccount(row.cr_user_id);
      await logActivity({ adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role, action: 'CR Account Deleted', target: name, description: `Permanently deleted the CR account for ${name}.` });
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">CR Accounts &amp; Credentials</h1>
          <p className="text-sm text-slate-500">Auto-generate CR logins from class &amp; section, and keep every credential on file.</p>
        </div>
        <Button onClick={() => { setGen({ fullName: '', phone: '', classId: '', sectionId: '' }); setGenOpen(true); }}>
          <Wand2 size={16} /> Generate CR Account
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">CR Name</th>
              <th className="px-4 py-3">Class / Section</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Password</th>
              <th className="px-4 py-3">Last Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vault.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-ink-900">
                  {row.profiles?.full_name}
                  {row.profiles?.is_active === false && <Badge tone="red">Disabled</Badge>}
                </td>
                <td className="px-4 py-3 text-slate-500">{row.classes?.name} — {row.sections?.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-700">{row.email}</span>
                    <button onClick={() => copy(row.email, 'Email')} className="rounded p-1 text-slate-400 hover:bg-slate-100"><Copy size={13} /></button>
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
                <td className="px-4 py-3 text-slate-400">{new Date(row.updated_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      disabled={busyRow === row.cr_user_id}
                      onClick={() => setEmailModal({ open: true, row, value: row.email })}
                      className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                    >
                      <Pencil size={13} /> Change Email
                    </button>
                    <button
                      disabled={busyRow === row.cr_user_id}
                      onClick={() => handleResetPassword(row)}
                      className="flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                    >
                      <RefreshCcw size={13} /> Reset Password
                    </button>
                    <button
                      disabled={busyRow === row.cr_user_id}
                      onClick={() => handleDelete(row)}
                      className="flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !vault.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No CR accounts generated yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      {/* Generate account */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate CR Account">
        <div className="space-y-3">
          <div><Label>CR's Full Name (not auto-generated)</Label><Input value={gen.fullName} onChange={(e) => setGen({ ...gen, fullName: e.target.value })} placeholder="e.g. Ahmed Raza" /></div>
          <div><Label>Mobile Number (optional)</Label><Input value={gen.phone} onChange={(e) => setGen({ ...gen, phone: e.target.value })} placeholder="03xx-xxxxxxx" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Class</Label>
              <Select value={gen.classId} onChange={(e) => setGen({ ...gen, classId: e.target.value, sectionId: '' })}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Section</Label>
              <Select value={gen.sectionId} onChange={(e) => setGen({ ...gen, sectionId: e.target.value })}>
                <option value="">Select section</option>
                {genSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
            <span className="text-slate-400">Auto-generated email: </span>
            <span className="font-mono font-semibold text-ink-900">{emailPreview}</span>
          </div>
          <p className="text-xs text-slate-400">A secure random password will be generated automatically and saved to the credentials vault below.</p>
          <Button className="w-full" onClick={handleGenerate} disabled={creating}><KeyRound size={16} /> {creating ? 'Generating…' : 'Generate & Assign'}</Button>
        </div>
      </Modal>

      {/* Show credentials once, right after creation / reset */}
      <Modal open={!!createdCreds} onClose={() => setCreatedCreds(null)} title="Credentials Ready">
        {createdCreds && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Share these with <strong>{createdCreds.full_name}</strong>. They're also saved permanently in the vault below.</p>
            <div className="space-y-2 rounded-xl bg-slate-50 p-3 font-mono text-sm">
              <div className="flex items-center justify-between"><span>{createdCreds.email}</span><button onClick={() => copy(createdCreds.email, 'Email')} className="rounded p-1 text-slate-400 hover:bg-slate-200"><Copy size={14} /></button></div>
              <div className="flex items-center justify-between"><span>{createdCreds.password}</span><button onClick={() => copy(createdCreds.password, 'Password')} className="rounded p-1 text-slate-400 hover:bg-slate-200"><Copy size={14} /></button></div>
            </div>
            <Button className="w-full" onClick={() => setCreatedCreds(null)}>Done</Button>
          </div>
        )}
      </Modal>

      {/* Change email */}
      <Modal open={emailModal.open} onClose={() => setEmailModal({ open: false, value: '' })} title="Change Login Email">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Updating this changes the email {emailModal.row?.profiles?.full_name} uses to log in — effective immediately.</p>
          <div><Label>New Email</Label><Input type="email" value={emailModal.value} onChange={(e) => setEmailModal((m) => ({ ...m, value: e.target.value }))} /></div>
          <Button className="w-full" onClick={handleUpdateEmail} disabled={busyRow === emailModal.row?.cr_user_id}>Save New Email</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
