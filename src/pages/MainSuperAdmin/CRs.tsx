import { useEffect, useState } from 'react';
import { Plus, UserMinus, ShieldAlert, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Label, Modal, Select, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { ClassRow, SectionRow, CrWarning, WarningSeverity } from '@/types';
import { listClasses, listSections } from '@/services/academics';
import { listCrAssignments, assignCr, removeCr } from '@/services/crAssignments';
import { createCrUser, listCrUsers } from '@/services/admins';
import { logActivity } from '@/services/activityLog';
import { issueWarning, listWarnings, deleteCrAccount } from '@/services/crAccounts';

export default function CRsPage() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [crUsers, setCrUsers] = useState<any[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [newCr, setNewCr] = useState({ fullName: '', email: '', phone: '', password: '' });

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ crUserId: '', classId: '', sectionId: '' });

  const [warnModal, setWarnModal] = useState<{ open: boolean; row?: any }>({ open: false });
  const [warnForm, setWarnForm] = useState<{ severity: WarningSeverity; message: string }>({ severity: 'MEDIUM', message: '' });
  const [historyModal, setHistoryModal] = useState<{ open: boolean; row?: any; warnings: CrWarning[] }>({ open: false, warnings: [] });

  async function reload() {
    setClasses(await listClasses());
    setSections(await listSections());
    setAssignments(await listCrAssignments());
    setCrUsers(await listCrUsers());
  }
  useEffect(() => { reload(); }, []);

  async function handleCreateCr() {
    if (!newCr.fullName || !newCr.email || !newCr.phone || !newCr.password) {
      toast.error('Please fill all fields — full name, email, and mobile number are all required.');
      return;
    }
    try {
      await createCrUser(newCr);
      await logActivity({ adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role, action: 'CR Account Created', target: newCr.fullName, description: `Created CR account for ${newCr.fullName}.` });
      toast.success('CR account created. You can now assign them to a section.');
      setCreateOpen(false);
      setNewCr({ fullName: '', email: '', phone: '', password: '' });
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create CR account. Ensure the "create-user" Edge Function is deployed.');
    }
  }

  async function handleAssign() {
    if (!assignForm.crUserId || !assignForm.classId || !assignForm.sectionId) {
      toast.error('Please select CR, class, and section.');
      return;
    }
    try {
      await assignCr({ ...assignForm, assignedBy: profile!.id });
      const cr = crUsers.find((c) => c.id === assignForm.crUserId);
      const sec = sections.find((s) => s.id === assignForm.sectionId);
      await logActivity({ adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role, action: 'CR Assigned', target: cr?.full_name, description: `Assigned ${cr?.full_name} as CR of ${sec?.name}.` });
      toast.success('CR assigned successfully.');
      setAssignOpen(false);
      setAssignForm({ crUserId: '', classId: '', sectionId: '' });
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to assign CR. (Only one active CR is allowed per section.)');
    }
  }

  async function handleRemove(a: any) {
    if (!confirm(`Remove ${a.profiles?.full_name} as CR of ${a.sections?.name}? Their account stays — this only unassigns them from this section.`)) return;
    await removeCr(a.id);
    await logActivity({ adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role, action: 'CR Removed', target: a.profiles?.full_name, description: `Removed ${a.profiles?.full_name} as CR of ${a.sections?.name}.` });
    toast.success('CR unassigned from this section.');
    reload();
  }

  async function handleDeleteAccount(a: any) {
    const name = a.profiles?.full_name ?? 'this CR';
    if (!confirm(`Permanently delete ${name}'s entire account?\n\nThis removes their login, every section assignment, saved credentials, and history. This cannot be undone.`)) return;
    try {
      await deleteCrAccount(a.cr_user_id);
      await logActivity({ adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role, action: 'CR Account Deleted', target: name, description: `Permanently deleted the CR account for ${name}.` });
      toast.success(`${name}'s account has been deleted.`);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to delete this account.');
    }
  }

  const formSections = sections.filter((s) => s.class_id === assignForm.classId);

  async function handleWarn() {
    if (!warnModal.row || !warnForm.message.trim()) { toast.error('Please describe the issue.'); return; }
    try {
      await issueWarning({
        crUserId: warnModal.row.cr_user_id,
        issuedBy: profile!.id,
        issuedByName: profile!.full_name,
        severity: warnForm.severity,
        message: warnForm.message.trim(),
      });
      await logActivity({ adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role, action: 'CR Warned', target: warnModal.row.profiles?.full_name, description: `Issued a ${warnForm.severity} warning: ${warnForm.message.trim()}` });
      toast.success('Warning issued. The CR will see it on their dashboard.');
      setWarnModal({ open: false });
      setWarnForm({ severity: 'MEDIUM', message: '' });
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to issue warning.');
    }
  }

  async function openHistory(a: any) {
    const warnings = await listWarnings(a.cr_user_id);
    setHistoryModal({ open: true, row: a, warnings: warnings as CrWarning[] });
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Class Representatives</h1>
          <p className="text-sm text-slate-500">Create CR accounts and assign them to a class & section.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCreateOpen(true)}><Plus size={16} /> New CR Account</Button>
          <Button onClick={() => setAssignOpen(true)}><Plus size={16} /> Assign CR</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">CR Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assignments.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium">{a.profiles?.full_name}</td>
                <td className="px-4 py-3 text-slate-500">{a.profiles?.email}</td>
                <td className="px-4 py-3 text-slate-500">{a.profiles?.phone || '—'}</td>
                <td className="px-4 py-3">{a.classes?.name}</td>
                <td className="px-4 py-3"><Badge tone="blue">{a.sections?.name}</Badge></td>
                <td className="px-4 py-3 text-slate-500">{new Date(a.assigned_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setWarnModal({ open: true, row: a })} title="Issue warning" className="rounded-lg p-1.5 text-amber-500 hover:bg-amber-50"><ShieldAlert size={15} /></button>
                    <button onClick={() => openHistory(a)} title="Warning history" className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">History</button>
                    <button onClick={() => handleRemove(a)} title="Unassign from this section" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><UserMinus size={15} /></button>
                    <button onClick={() => handleDeleteAccount(a)} title="Permanently delete this CR's account" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!assignments.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No CRs assigned yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New CR Account">
        <div className="space-y-3">
          <div><Label>Full Name</Label><Input value={newCr.fullName} onChange={(e) => setNewCr({ ...newCr, fullName: e.target.value })} placeholder="This becomes their profile name" /></div>
          <div><Label>Email</Label><Input type="email" required value={newCr.email} onChange={(e) => setNewCr({ ...newCr, email: e.target.value })} /></div>
          <div><Label>Mobile Number</Label><Input type="tel" required value={newCr.phone} onChange={(e) => setNewCr({ ...newCr, phone: e.target.value })} placeholder="03xx-xxxxxxx" /></div>
          <div><Label>Temporary Password</Label><Input type="text" value={newCr.password} onChange={(e) => setNewCr({ ...newCr, password: e.target.value })} placeholder="min 6 characters" /></div>
          <Button className="w-full" onClick={handleCreateCr}>Create Account</Button>
        </div>
      </Modal>

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign CR to Section">
        <div className="space-y-3">
          <div>
            <Label>CR</Label>
            <Select value={assignForm.crUserId} onChange={(e) => setAssignForm({ ...assignForm, crUserId: e.target.value })}>
              <option value="">Select CR</option>
              {crUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
            </Select>
          </div>
          <div>
            <Label>Class</Label>
            <Select value={assignForm.classId} onChange={(e) => setAssignForm({ ...assignForm, classId: e.target.value, sectionId: '' })}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Section</Label>
            <Select value={assignForm.sectionId} onChange={(e) => setAssignForm({ ...assignForm, sectionId: e.target.value })}>
              <option value="">Select section</option>
              {formSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <p className="text-xs text-slate-400">
            Assigning a new CR replaces the previous CR of that section. A single CR can now be assigned to more than
            one section &mdash; assign them again here for a second section and they&rsquo;ll get a switcher to move
            between their sections.
          </p>
          <Button className="w-full" onClick={handleAssign}>Assign CR</Button>
        </div>
      </Modal>

      <Modal open={warnModal.open} onClose={() => setWarnModal({ open: false })} title={`Warn ${warnModal.row?.profiles?.full_name ?? 'CR'}`}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">This will appear on {warnModal.row?.profiles?.full_name}&rsquo;s dashboard until they acknowledge it.</p>
          <div>
            <Label>Severity</Label>
            <Select value={warnForm.severity} onChange={(e) => setWarnForm({ ...warnForm, severity: e.target.value as WarningSeverity })}>
              <option value="LOW">Low — minor reminder</option>
              <option value="MEDIUM">Medium — clear policy violation</option>
              <option value="HIGH">High — serious misconduct</option>
            </Select>
          </div>
          <div>
            <Label>What happened?</Label>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              rows={4}
              value={warnForm.message}
              onChange={(e) => setWarnForm({ ...warnForm, message: e.target.value })}
              placeholder="Describe the wrongdoing clearly and factually…"
            />
          </div>
          <Button className="w-full" onClick={handleWarn}><ShieldAlert size={16} /> Issue Warning</Button>
        </div>
      </Modal>

      <Modal open={historyModal.open} onClose={() => setHistoryModal({ open: false, warnings: [] })} title={`Warning History — ${historyModal.row?.profiles?.full_name ?? ''}`} wide>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {historyModal.warnings.map((w) => (
            <div key={w.id} className="rounded-xl border border-slate-100 p-3">
              <div className="mb-1 flex items-center justify-between">
                <Badge tone={w.severity === 'HIGH' ? 'red' : w.severity === 'MEDIUM' ? 'amber' : 'slate'}>{w.severity}</Badge>
                <span className="text-xs text-slate-400">{new Date(w.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-ink-800">{w.message}</p>
              <p className="mt-1 text-xs text-slate-400">
                Issued by {w.issued_by_name} · {w.acknowledged_at ? `Acknowledged ${new Date(w.acknowledged_at).toLocaleDateString()}` : 'Not yet acknowledged'}
              </p>
            </div>
          ))}
          {!historyModal.warnings.length && <p className="py-8 text-center text-sm text-slate-400">No warnings issued to this CR.</p>}
        </div>
      </Modal>
    </DashboardLayout>
  );
}
