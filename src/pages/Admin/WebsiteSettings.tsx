import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Spinner } from '@/components/ui';
import { SiteSettingsRow, loadSiteSettings, saveSiteSettings } from '@/services/website';
import AiAssist from '@/components/AiAssist';
import { Checkbox, Field, ImageField, textareaCls } from './shared';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const URLISH = /^https?:\/\/\S+$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^[0-9+\-\s]{7,20}$/;
// Neutral placeholder palette used until official colors are supplied (matches the public site defaults).
const PLACEHOLDER_COLORS = { primary_color: '#1F3A5F', secondary_color: '#3B4A5C', accent_color: '#A67C2E' };

function ColorField({ label, value, onChange, fallback }: { label: string; value: string | null; onChange: (v: string | null) => void; fallback: string }) {
  const shown = value && HEX.test(value) ? value : fallback;
  return (
    <Field label={label} hint={value ? undefined : 'Using the placeholder color until set.'}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} value={shown} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded border border-slate-200 bg-white p-1" />
        <Input aria-label={`${label} hex`} value={value ?? ''} placeholder={fallback} maxLength={7} onChange={(e) => onChange(e.target.value.trim() || null)} />
        {value && <button type="button" className="text-sm text-slate-500 hover:text-red-600" onClick={() => onChange(null)}>Reset</button>}
      </div>
    </Field>
  );
}

export default function WebsiteSettingsPage() {
  const [s, setS] = useState<SiteSettingsRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<string[]>([]);

  useEffect(() => { loadSiteSettings().then(setS).catch((e) => setError(e.message)); }, []);
  if (error) return <DashboardLayout><p role="alert" className="text-sm text-red-700">{error}</p></DashboardLayout>;
  if (!s) return <DashboardLayout><div className="flex justify-center py-16"><Spinner /></div></DashboardLayout>;

  const set = <K extends keyof SiteSettingsRow>(k: K, v: SiteSettingsRow[K]) => setS((p) => (p ? { ...p, [k]: v } : p));
  const txt = (k: keyof SiteSettingsRow) => ({ value: (s[k] as string | null) ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, (e.target.value || null) as never) });

  async function save() {
    if (!s) return;
    const problems: string[] = [];
    if (!s.college_name.trim()) problems.push('College name is required.');
    if (!s.campus_name.trim()) problems.push('Campus name is required.');
    (['primary_color', 'secondary_color', 'accent_color'] as const).forEach((k) => { if (s[k] && !HEX.test(s[k]!)) problems.push(`${k.replace('_color', '')} color must look like #1F3A5F.`); });
    (['map_url', 'facebook_url', 'instagram_url', 'youtube_url'] as const).forEach((k) => { if (s[k] && !URLISH.test(s[k]!)) problems.push(`${k.replace('_url', '').replace('_', ' ')} link must start with http:// or https://.`); });
    if (s.email && !EMAIL.test(s.email)) problems.push('Enter a valid email address.');
    if (s.phone && !PHONE.test(s.phone)) problems.push('Enter a valid phone number.');
    setErrs(problems);
    if (problems.length) return;
    setBusy(true);
    try { await saveSiteSettings(s); toast.success('Website settings saved. Changes are live on the public site.'); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">Website & Branding</h1>
          <p className="text-sm text-slate-500">Institution details, logos, colors and the principal's message shown on the public website.</p>
        </div>
        <Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</Button>
      </div>

      {errs.length > 0 && <ul role="alert" className="mb-4 list-disc rounded-lg bg-red-50 px-8 py-3 text-sm text-red-700">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}

      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-ink-900">Institution</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="College name *"><Input {...txt('college_name')} /></Field>
            <Field label="Campus *"><Input {...txt('campus_name')} /></Field>
            <Field label="Website title" hint="Shown in the browser tab."><Input {...txt('website_title')} /></Field>
            <Field label="Tagline">
              <Input {...txt('tagline')} />
              <AiAssist kind="site_tagline" context={{ college: s.college_name ?? '' }} value={s.tagline ?? ''} maxChars={80} onApply={(t) => set('tagline', t)} notesHint="What the tagline should express, in a few words." />
            </Field>
            <Field label="Address"><Input {...txt('address')} /></Field>
            <Field label="Phone"><Input type="tel" {...txt('phone')} /></Field>
            <Field label="Email"><Input type="email" {...txt('email')} /></Field>
            <Field label="Map link" hint="A Google Maps link, or a Maps 'embed' link to show the map on the Contact page."><Input {...txt('map_url')} /></Field>
            <Field label="Facebook link"><Input {...txt('facebook_url')} /></Field>
            <Field label="Instagram link"><Input {...txt('instagram_url')} /></Field>
            <Field label="YouTube link"><Input {...txt('youtube_url')} /></Field>
            <Field label="Footer text">
              <Input {...txt('footer_text')} />
              <AiAssist kind="site_footer" context={{ college: s.college_name ?? '' }} value={s.footer_text ?? ''} maxChars={160} onApply={(t) => set('footer_text', t)} notesHint="What the footer line should say, for example affiliation or a short note." />
            </Field>
          </div>
          <div className="mt-4"><Checkbox label="Admissions are open (shows the Apply buttons and accepts online applications)" checked={s.admissions_open} onChange={(v) => set('admissions_open', v)} /></div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-ink-900">Branding</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <ImageField label="Official logo" value={s.logo_url} folder="branding" onChange={(u) => set('logo_url', u)} />
            <ImageField label="Secondary logo" value={s.secondary_logo_url} folder="branding" onChange={(u) => set('secondary_logo_url', u)} />
            <ImageField label="Favicon" value={s.favicon_url} folder="branding" onChange={(u) => set('favicon_url', u)} hint="Small square PNG works best." />
            <ImageField label="Homepage campus photograph" value={s.hero_image_url} folder="branding" onChange={(u) => set('hero_image_url', u)} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <ColorField label="Primary color" value={s.primary_color} fallback={PLACEHOLDER_COLORS.primary_color} onChange={(v) => set('primary_color', v)} />
            <ColorField label="Secondary color" value={s.secondary_color} fallback={PLACEHOLDER_COLORS.secondary_color} onChange={(v) => set('secondary_color', v)} />
            <ColorField label="Accent color" value={s.accent_color} fallback={PLACEHOLDER_COLORS.accent_color} onChange={(v) => set('accent_color', v)} />
          </div>
          <p className="mt-3 text-xs text-slate-500">Keep strong contrast between the primary color and white text, since it is used for buttons and the footer.</p>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-ink-900">Principal</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Principal's name"><Input {...txt('principal_name')} /></Field>
            <ImageField label="Principal's photograph" value={s.principal_photo_url} folder="branding" onChange={(u) => set('principal_photo_url', u)} />
          </div>
          <div className="mt-4">
            <Field label="Message">
              <textarea rows={6} className={textareaCls} value={s.principal_message ?? ''} onChange={(e) => set('principal_message', e.target.value || null)} />
              <AiAssist
                kind="principal_message"
                context={{ name: s.principal_name }}
                value={s.principal_message ?? ''}
                onApply={(t) => set('principal_message', t)}
                notesHint="The main points the Principal wants to make to students and parents. The Principal should read and approve the final message."
              />
            </Field>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
