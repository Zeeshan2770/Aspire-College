import { ChangeEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Label, Select } from '@/components/ui';
import { ClassRow, SectionRow, ReportBranding as ReportBrandingType } from '@/types';
import { listClasses, listSections } from '@/services/academics';
import {
  listBranding, upsertClassBranding, upsertSectionBranding, deleteBranding, uploadReportImage,
} from '@/services/reportBranding';

type Scope = 'class' | 'section';

export default function ReportBrandingPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [existing, setExisting] = useState<ReportBrandingType[]>([]);

  const [scope, setScope] = useState<Scope>('class');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [footerImageUrl, setFooterImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'logo' | 'header' | 'footer' | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setClasses(await listClasses());
    setSections(await listSections());
    setExisting(await listBranding());
  }
  useEffect(() => { reload(); }, []);

  const formSections = sections.filter((s) => s.class_id === classId);

  // Load any existing override into the form when the selection changes.
  useEffect(() => {
    const row =
      scope === 'class'
        ? existing.find((b) => b.class_id === classId)
        : existing.find((b) => b.section_id === sectionId);
    setHeaderText(row?.header_text ?? '');
    setFooterText(row?.footer_text ?? '');
    setLogoUrl(row?.logo_url ?? null);
    setHeaderImageUrl(row?.header_image_url ?? null);
    setFooterImageUrl(row?.footer_image_url ?? null);
  }, [scope, classId, sectionId, existing]);

  async function handleImageUpload(
    e: ChangeEvent<HTMLInputElement>,
    kind: 'logo' | 'header' | 'footer',
    maxMb: number,
    setUrl: (url: string) => void
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); return; }
    if (file.size > maxMb * 1024 * 1024) { toast.error(`Image must be under ${maxMb} MB.`); return; }
    const scopeKey = scope === 'class' ? `class-${classId}` : `section-${sectionId}`;
    setUploading(kind);
    try {
      const url = await uploadReportImage(file, scopeKey, kind);
      setUrl(url);
      toast.success('Image uploaded. Click Save to apply it.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to upload image.');
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  }

  async function handleSave() {
    if (scope === 'class' && !classId) { toast.error('Select a class first.'); return; }
    if (scope === 'section' && !sectionId) { toast.error('Select a class and section first.'); return; }
    setSaving(true);
    try {
      const patch = {
        header_text: headerText || null,
        footer_text: footerText || null,
        logo_url: logoUrl,
        header_image_url: headerImageUrl,
        footer_image_url: footerImageUrl,
      };
      if (scope === 'class') await upsertClassBranding(classId, patch);
      else await upsertSectionBranding(sectionId, patch);
      toast.success('Report branding saved.');
      reload();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save branding.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(row: ReportBrandingType) {
    if (!confirm('Remove this override? Reports will fall back to the global college branding.')) return;
    await deleteBranding(row.id);
    toast.success('Override removed.');
    reload();
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">Report Branding</h1>
        <p className="text-sm text-slate-500">
          Set a custom header, footer, and logo for a specific class or section's reports. Anything left blank falls
          back to the global settings in <span className="font-semibold">System Settings</span>.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Apply To</Label>
              <Select value={scope} onChange={(e) => { setScope(e.target.value as Scope); setSectionId(''); }}>
                <option value="class">Whole Class (all its sections)</option>
                <option value="section">A Specific Section</option>
              </Select>
            </div>
            <div>
              <Label>Class</Label>
              <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            {scope === 'section' && (
              <div>
                <Label>Section</Label>
                <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                  <option value="">Select section</option>
                  {formSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <Label>Header</Label>
              <p className="mb-1.5 text-xs text-slate-400">Use text, or upload a banner image instead — the image takes priority if set.</p>
              <Input value={headerText} onChange={(e) => setHeaderText(e.target.value)} placeholder="e.g. Department of Computer Science" disabled={!!headerImageUrl} />
              <div className="mt-2 flex items-center gap-3">
                {headerImageUrl ? (
                  <img src={headerImageUrl} alt="Header banner" className="h-12 w-24 rounded-lg border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-12 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300">
                    <ImageIcon size={16} />
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-slate-50">
                  {uploading === 'header' ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
                  {uploading === 'header' ? 'Uploading…' : 'Upload Header Image'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'header', 3, setHeaderImageUrl)} disabled={uploading !== null} />
                </label>
                {headerImageUrl && <button className="text-xs text-red-500 hover:underline" onClick={() => setHeaderImageUrl(null)}>Use text instead</button>}
              </div>
            </div>
            <div>
              <Label>Footer</Label>
              <p className="mb-1.5 text-xs text-slate-400">Use text, or upload a banner image instead — the image takes priority if set.</p>
              <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="e.g. Attested copy — for internal use only" disabled={!!footerImageUrl} />
              <div className="mt-2 flex items-center gap-3">
                {footerImageUrl ? (
                  <img src={footerImageUrl} alt="Footer banner" className="h-12 w-24 rounded-lg border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-12 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300">
                    <ImageIcon size={16} />
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-slate-50">
                  {uploading === 'footer' ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
                  {uploading === 'footer' ? 'Uploading…' : 'Upload Footer Image'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'footer', 3, setFooterImageUrl)} disabled={uploading !== null} />
                </label>
                {footerImageUrl && <button className="text-xs text-red-500 hover:underline" onClick={() => setFooterImageUrl(null)}>Use text instead</button>}
              </div>
            </div>
            <div>
              <Label>Logo</Label>
              <p className="mb-1.5 text-xs text-slate-400">Small mark shown next to the header text (ignored when a header image is set).</p>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded-xl border border-slate-200 object-contain p-1" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-300">
                    <ImageIcon size={20} />
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-slate-50">
                  {uploading === 'logo' ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
                  {uploading === 'logo' ? 'Uploading…' : 'Upload Logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logo', 2, setLogoUrl)} disabled={uploading !== null} />
                </label>
                {logoUrl && <button className="text-xs text-red-500 hover:underline" onClick={() => setLogoUrl(null)}>Remove</button>}
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Branding'}</Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-3 font-bold text-ink-900">Existing Overrides</h3>
          <div className="space-y-2">
            {existing.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-ink-900">
                    {row.class_id ? classes.find((c) => c.id === row.class_id)?.name ?? 'Class' : sections.find((s) => s.id === row.section_id)?.name ?? 'Section'}
                  </p>
                  <p className="text-xs text-slate-400">{row.class_id ? 'Class-wide' : 'Section-specific'}</p>
                </div>
                <button onClick={() => handleRemove(row)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            ))}
            {!existing.length && <p className="py-6 text-center text-sm text-slate-400">No overrides yet — all reports use the global branding.</p>}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
