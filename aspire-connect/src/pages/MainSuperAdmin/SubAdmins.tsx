import { useEffect, useState } from 'react';
import { Plus, ShieldOff, ShieldCheck as ShieldCheckIcon, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Label, Modal, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { AdminPermissions } from '@/types';
import { createSubSuperAdmin, listSubSuperAdmins, updateAdminPermissions, setAdminActive } from '@/services/admins';
import { logActivity } from '@/services/activityLog';

const PERMISSION_FIELDS: { key: keyof AdminPermissions; label: string }[] = [
  { key: 'manage_students', label: 'Manage Students' },
  { key: 'manage_classes', label: 'Manage Classes' },
  { key: 'manage_sections', label: 'Manage Sections' },
  { key: 'manage_crs', label: 'Manage CRs' },
  { key: 'view_attendance', label: 'View Attendance' },
  { key: 'manage_attendance', label: 'Manage Attendance' },
  { key: 'view_concerns', label: 'View Concerns' },
  { key: 'manage_concerns', label: 'Manage Concerns (assign/resolve/close)' },
  { key: 'raise_concerns', label: 'Raise Concerns' },
  { key: 'generate_reports', label: 'Generate Reports' },
  { key: 'import_students', label: 'Import Students' },
  { key: 'export_students', label: 'Export Students' },
  { key: 'manage_admissions', label: 'Manage Admissions & Inquiries' },
  { key: 'manage_faculty', label: 'Manage Faculty' },
  { key: 'manage_content', label: 'Manage Website Content (news, events, programs, pages)' },
];

export default function SubAdminsPage() {
  const { profile } = useAuth();
  const [admins, setAdmins] = useState<any[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });

  const [permModal, setPermModal] = useState<{ open: boolean; admin: any | null }>({ open: false, admin: null });
  const [perms, setPerms] = useState<Partial<AdminPermissions>>({});

  async function reload() {
    setAdmins(await listSubSuperAdmins());
  }
  useEffect(() => { reload(); }, []);

  async function handleCreate() {
    if (!form.fullName || !form.email || !form.phone || !form.password) {
      toast.error('Please fill all fields — full name, email, and mobile number are all required.');
      return;
    }
    try {
      await createSubSuperAdmin({ ...form, permissions: { view_attendance: true, view_concerns: true, raise_concerns: true, generate_reports: true, export_students: true } });
      await logActivity({ adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role, action: 'Admin Created', target: form.fullName, description: `Created Sub Super Admin: ${form.fullName}.` });
      toast.success('Sub Super Admin created successfully.');
      setCreateOpen(false);
      setForm({ fullName: '', email: '', phone: '', password: '' });
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create admin. Ensure the "create-user" Edge Function is deployed.');
    }
  }

  function openPermissions(admin: any) {
    setPerms(admin.admin_permissions?.[0] ?? {});
    setPermModal({ open: true, admin });
  }

  async function savePermissions() {
    const admin = permModal.admin;
    await updateAdminPermissions(admin.id, perms);
    await logActivity({ adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role, action: 'Admin Edited', target: admin.full_name, description: `Updated permissions for ${admin.full_name}.` });
    toast.success('Permissions updated.');
    setPermModal({ open: false, admin: null });
    reload();
  }

  async function toggleActive(admin: any) {
    const newStatus = !admin.is_active;
    await setAdminActive(admin.id, newStatus);
    await logActivity({
      adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
      action: newStatus ? 'Admin Reactivated' : 'Admin Deactivated', target: admin.full_name,
      description: `${newStatus ? 'Reactivated' : 'Deactivated'} Sub Super Admin ${admin.full_name}.`,
    });
    toast.success(newStatus ? 'Admin reactivated.' : 'Admin deactivated.');
    reload();
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Sub Super Admins</h1>
          <p className="text-sm text-slate-500">Delegate administrative work with fine-grained permissions.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus size={16} /> Create Sub Super Admin</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {admins.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-ink-900">{a.full_name}</p>
                <p className="text-xs text-slate-400">{a.email}{a.phone ? ` · ${a.phone}` : ''}</p>
              </div>
              <Badge tone={a.is_active ? 'green' : 'red'}>{a.is_active ? 'Active' : 'Deactivated'}</Badge>
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => openPermissions(a)}><Settings2 size={14} /> Permissions</Button>
              <Button size="sm" variant={a.is_active ? 'danger' : 'secondary'} onClick={() => toggleActive(a)}>
                {a.is_active ? <ShieldOff size={14} /> : <ShieldCheckIcon size={14} />}
                {a.is_active ? 'Deactivate' : 'Reactivate'}
              </Button>
            </div>
          </Card>
        ))}
        {!admins.length && <Card className="p-8 text-center text-slate-400 md:col-span-2">No Sub Super Admins yet.</Card>}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Sub Super Admin">
        <div className="space-y-3">
          <div><Label>Full Name</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="This becomes their profile name" /></div>
          <div><Label>Email</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Mobile Number</Label><Input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="03xx-xxxxxxx" /></div>
          <div><Label>Temporary Password</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 characters" /></div>
          <Button className="w-full" onClick={handleCreate}>Create Admin</Button>
        </div>
      </Modal>

      <Modal open={permModal.open} onClose={() => setPermModal({ open: false, admin: null })} title={`Permissions — ${permModal.admin?.full_name ?? ''}`} wide>
        <div className="grid grid-cols-2 gap-3">
          {PERMISSION_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={!!perms[f.key]}
                onChange={(e) => setPerms({ ...perms, [f.key]: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              {f.label}
            </label>
          ))}
        </div>
        <Button className="mt-5 w-full" onClick={savePermissions}>Save Permissions</Button>
      </Modal>
    </DashboardLayout>
  );
}
