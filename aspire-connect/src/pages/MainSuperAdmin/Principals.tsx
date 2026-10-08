import { useEffect, useState } from 'react';
import { Plus, ShieldOff, ShieldCheck as ShieldCheckIcon, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Label, Modal, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { createPrincipal, listPrincipals, setAdminActive } from '@/services/admins';
import { logActivity } from '@/services/activityLog';

export default function PrincipalsPage() {
  const { profile } = useAuth();
  const [principals, setPrincipals] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);

  async function reload() {
    setPrincipals(await listPrincipals());
  }
  useEffect(() => { reload(); }, []);

  async function handleCreate() {
    if (!form.fullName || !form.email || !form.phone || !form.password) {
      toast.error('Please fill all fields — full name, email, and mobile number are all required.');
      return;
    }
    setSaving(true);
    try {
      await createPrincipal(form);
      await logActivity({
        adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
        action: 'Principal Created', target: form.fullName, description: `Created Principal account: ${form.fullName}.`,
      });
      toast.success('Principal account created successfully.');
      setCreateOpen(false);
      setForm({ fullName: '', email: '', phone: '', password: '' });
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create account. Ensure the "create-user" Edge Function is deployed.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: any) {
    const newStatus = !p.is_active;
    await setAdminActive(p.id, newStatus);
    await logActivity({
      adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
      action: newStatus ? 'Principal Reactivated' : 'Principal Deactivated', target: p.full_name,
      description: `${newStatus ? 'Reactivated' : 'Deactivated'} Principal ${p.full_name}.`,
    });
    toast.success(newStatus ? 'Account reactivated.' : 'Account deactivated.');
    reload();
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Principal Accounts</h1>
          <p className="text-sm text-slate-500">
            Principals get full read-only visibility &mdash; students, attendance, concerns, reports and statistics
            &mdash; with no management access and no visibility into activity logs.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus size={16} /> Add Principal</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {principals.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <Landmark size={18} />
                </div>
                <div>
                  <p className="font-bold text-ink-900">{p.full_name}</p>
                  <p className="text-xs text-slate-400">{p.email}{p.phone ? ` · ${p.phone}` : ''}</p>
                </div>
              </div>
              <Badge tone={p.is_active ? 'green' : 'red'}>{p.is_active ? 'Active' : 'Deactivated'}</Badge>
            </div>
            <div className="mt-4">
              <Button size="sm" variant={p.is_active ? 'danger' : 'secondary'} onClick={() => toggleActive(p)}>
                {p.is_active ? <ShieldOff size={14} /> : <ShieldCheckIcon size={14} />}
                {p.is_active ? 'Deactivate' : 'Reactivate'}
              </Button>
            </div>
          </Card>
        ))}
        {!principals.length && <Card className="p-8 text-center text-slate-400 md:col-span-2">No Principal accounts yet.</Card>}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Principal">
        <div className="space-y-3">
          <div><Label>Full Name</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="This becomes their profile name" /></div>
          <div><Label>Email</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Mobile Number</Label><Input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="03xx-xxxxxxx" /></div>
          <div><Label>Temporary Password</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 characters" /></div>
          <Button className="w-full" onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create Account'}</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
