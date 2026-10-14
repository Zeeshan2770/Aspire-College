import { ChangeEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Label, Select } from '@/components/ui';
import { CreditBox } from '@/components/CreditBox';
import { useAuth } from '@/hooks/useAuth';
import { SystemSettings } from '@/types';
import { getSettings, updateSettings } from '@/services/settings';
import { uploadReportImage } from '@/services/reportBranding';
import { logActivity } from '@/services/activityLog';
import { refreshSystemSettingsCache } from '@/hooks/useSystemSettings';

export default function SettingsPage() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [uploading, setUploading] = useState<'header' | 'footer' | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setCategories(s.concern_categories ?? []);
    });
  }, []);

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>, kind: 'header' | 'footer') {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB.'); return; }
    setUploading(kind);
    try {
      const url = await uploadReportImage(file, 'global', kind);
      setSettings({ ...settings, [kind === 'header' ? 'header_image_url' : 'footer_image_url']: url });
      toast.success('Image uploaded. Click Save to apply it.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to upload image.');
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  }

  async function save() {
    if (!settings) return;
    const patch = {
      college_name: settings.college_name,
      campus_name: settings.campus_name,
      system_name: settings.system_name,
      header_text: settings.header_text || null,
      footer_text: settings.footer_text || null,
      header_image_url: settings.header_image_url,
      footer_image_url: settings.footer_image_url,
      concern_categories: categories.map((c) => c.trim()).filter(Boolean),
      coordinator_name: settings.coordinator_name || null,
      coordinator_whatsapp: settings.coordinator_whatsapp || null,
      coordinator_secondary_name: settings.coordinator_secondary_name || null,
      coordinator_secondary_whatsapp: settings.coordinator_secondary_whatsapp || null,
      default_report_signature: settings.default_report_signature || 'Aspire Group of Colleges, Taunsa Sharif',
      credit_enabled: settings.credit_enabled,
      credit_text: settings.credit_text || 'Muhammad Zeeshan Haider',
      credit_logo_url: settings.credit_logo_url,
      default_attendance_behavior: settings.default_attendance_behavior,
      allow_ocr_scanning: settings.allow_ocr_scanning,
      ocr_review_required: settings.ocr_review_required,
    };
    const updated = await updateSettings(patch);
    refreshSystemSettingsCache(updated);
    await logActivity({
      adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
      action: 'Settings Changed', description: 'Updated system settings.',
    });
    toast.success('Settings saved.');
  }

  if (!settings) return <DashboardLayout><Card className="p-8 text-center text-slate-500">Loading…</Card></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">System Settings</h1>
        <p className="mt-1 text-sm text-[var(--text-2)]">Branding and configuration used across reports and dashboards.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">General Settings</h2>
          <div className="space-y-4">
            <div><Label>College Name</Label><Input value={settings.college_name} onChange={(e) => setSettings({ ...settings, college_name: e.target.value })} /></div>
            <div><Label>Campus Name</Label><Input value={settings.campus_name} onChange={(e) => setSettings({ ...settings, campus_name: e.target.value })} /></div>
            <div><Label>System Name</Label><Input value={settings.system_name} onChange={(e) => setSettings({ ...settings, system_name: e.target.value })} /></div>

            <div className="border-t border-slate-100 pt-4">
              <Label>Default Report Header</Label>
              <p className="mb-1.5 text-xs text-slate-500">
                Used when a class/section has no override. Use text, or upload a banner image instead — the image takes priority if set.
              </p>
              <Input
                value={settings.header_text ?? ''}
                onChange={(e) => setSettings({ ...settings, header_text: e.target.value })}
                placeholder="e.g. Aspire Group of Colleges"
                disabled={!!settings.header_image_url}
              />
              <div className="mt-2 flex items-center gap-3">
                {settings.header_image_url ? (
                  <img src={settings.header_image_url} alt="Header banner" className="h-12 w-24 rounded-lg border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-12 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300">
                    <ImageIcon size={16} />
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-slate-50">
                  {uploading === 'header' ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
                  {uploading === 'header' ? 'Uploading…' : 'Upload Header Image'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'header')} disabled={uploading !== null} />
                </label>
                {settings.header_image_url && (
                  <button className="text-xs text-red-500 hover:underline" onClick={() => setSettings({ ...settings, header_image_url: null })}>
                    Use text instead
                  </button>
                )}
              </div>
            </div>

            <div>
              <Label>Default Report Footer</Label>
              <p className="mb-1.5 text-xs text-slate-500">
                Used when a class/section has no override. Use text, or upload a banner image instead — the image takes priority if set.
              </p>
              <Input
                value={settings.footer_text ?? ''}
                onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })}
                placeholder="e.g. Aspire Group of Colleges, Taunsa Sharif"
                disabled={!!settings.footer_image_url}
              />
              <div className="mt-2 flex items-center gap-3">
                {settings.footer_image_url ? (
                  <img src={settings.footer_image_url} alt="Footer banner" className="h-12 w-24 rounded-lg border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-12 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300">
                    <ImageIcon size={16} />
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-slate-50">
                  {uploading === 'footer' ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
                  {uploading === 'footer' ? 'Uploading…' : 'Upload Footer Image'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'footer')} disabled={uploading !== null} />
                </label>
                {settings.footer_image_url && (
                  <button className="text-xs text-red-500 hover:underline" onClick={() => setSettings({ ...settings, footer_image_url: null })}>
                    Use text instead
                  </button>
                )}
              </div>
            </div>

            <div>
              <Label>Concern Categories</Label>
              <ul className="mb-2 space-y-1.5">
                {categories.map((c, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <Input aria-label={`Category ${i + 1}`} value={c} onChange={(e) => setCategories((p) => p.map((x, k) => (k === i ? e.target.value : x)))} />
                    <Button type="button" size="sm" variant="ghost" disabled={i === 0} aria-label="Move up" onClick={() => setCategories((p) => { const n = [...p]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}>↑</Button>
                    <Button type="button" size="sm" variant="ghost" disabled={i === categories.length - 1} aria-label="Move down" onClick={() => setCategories((p) => { const n = [...p]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}>↓</Button>
                    <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${c}`} onClick={() => setCategories((p) => p.filter((_, k) => k !== i))}>✕</Button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input placeholder="Add a category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newCategory.trim()) { e.preventDefault(); setCategories((p) => [...p, newCategory.trim()]); setNewCategory(''); } }} />
                <Button type="button" variant="secondary" disabled={!newCategory.trim()} onClick={() => { setCategories((p) => [...p, newCategory.trim()]); setNewCategory(''); }}>Add</Button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Press Save All Settings to apply changes.</p>
            </div>
          </div>
        </Card>
        <CreditBox />

        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">Communication Settings</h2>
          <p className="mb-4 text-xs text-slate-500">
            Used by Quick Reports &amp; Messages so CRs never have to type a phone number by hand.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Coordinator Name</Label><Input value={settings.coordinator_name ?? ''} onChange={(e) => setSettings({ ...settings, coordinator_name: e.target.value })} placeholder="e.g. Sir Ahmed" /></div>
            <div><Label>Coordinator WhatsApp Number</Label><Input value={settings.coordinator_whatsapp ?? ''} onChange={(e) => setSettings({ ...settings, coordinator_whatsapp: e.target.value })} placeholder="e.g. +92 300 1234567" /></div>
            <div><Label>Secondary Coordinator (optional)</Label><Input value={settings.coordinator_secondary_name ?? ''} onChange={(e) => setSettings({ ...settings, coordinator_secondary_name: e.target.value })} /></div>
            <div><Label>Secondary WhatsApp Number (optional)</Label><Input value={settings.coordinator_secondary_whatsapp ?? ''} onChange={(e) => setSettings({ ...settings, coordinator_secondary_whatsapp: e.target.value })} placeholder="e.g. +92 300 7654321" /></div>
            <div className="sm:col-span-2"><Label>Default Report Signature</Label><Input value={settings.default_report_signature} onChange={(e) => setSettings({ ...settings, default_report_signature: e.target.value })} /></div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">Developer Credit</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input
                type="checkbox"
                checked={settings.credit_enabled}
                onChange={(e) => setSettings({ ...settings, credit_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              Show developer credit
            </label>
            <div><Label>Credit Text</Label><Input value={settings.credit_text} onChange={(e) => setSettings({ ...settings, credit_text: e.target.value })} disabled={!settings.credit_enabled} /></div>
            <div><Label>Developer Logo URL (optional)</Label><Input value={settings.credit_logo_url ?? ''} onChange={(e) => setSettings({ ...settings, credit_logo_url: e.target.value })} disabled={!settings.credit_enabled} /></div>
            <CreditBox variant="mini" collapsible={false} />
          </div>
        </Card>

        <Card className="p-6 lg:col-span-3">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">Attendance Settings</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Default Attendance Behavior</Label>
              <Select value={settings.default_attendance_behavior} onChange={(e) => setSettings({ ...settings, default_attendance_behavior: e.target.value as SystemSettings['default_attendance_behavior'] })}>
                <option value="ALL_PRESENT">Start every student as Present</option>
                <option value="ALL_UNMARKED">Start every student unmarked</option>
              </Select>
            </div>
            <label className="flex items-end gap-2 pb-2.5 text-sm text-ink-800">
              <input
                type="checkbox"
                checked={settings.allow_ocr_scanning}
                onChange={(e) => setSettings({ ...settings, allow_ocr_scanning: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              Allow OCR attendance scanning
            </label>
            <label className="flex items-end gap-2 pb-2.5 text-sm text-ink-800">
              <input
                type="checkbox"
                checked={settings.ocr_review_required}
                onChange={(e) => setSettings({ ...settings, ocr_review_required: e.target.checked })}
                disabled={!settings.allow_ocr_scanning}
                className="h-4 w-4 rounded border-slate-300"
              />
              Require CR review before saving scanned attendance
            </label>
          </div>
        </Card>

        <div className="lg:col-span-3">
          <Button onClick={save}>Save All Settings</Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
