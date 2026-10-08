import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, CheckCircle2 } from 'lucide-react';
import { useSite } from '../SiteProvider';
import { submitRpc } from '../api';
import { PageHeader, Placeholder, Section, btnPrimary } from '../components';

const PHONE = /^[0-9+\-\s]{10,16}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function Contact() {
  const { settings } = useSite();
  const [f, setF] = useState({ name: '', email: '', phone: '', subject: '', message: '', website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const cls = (bad: boolean) => `w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${bad ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-college-primary focus:ring-college-primary'}`;

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitError(null);
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Enter your name.';
    if (!f.message.trim()) e.message = 'Enter your message.';
    if (!f.email.trim() && !f.phone.trim()) e.email = 'Provide an email address or phone number.';
    if (f.email.trim() && !EMAIL.test(f.email.trim())) e.email = 'Enter a valid email address.';
    if (f.phone.trim() && !PHONE.test(f.phone.trim())) e.phone = 'Enter a valid phone number (10 to 16 digits).';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await submitRpc('submit_contact', f);
      setSent(true);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const embed = settings?.map_url && settings.map_url.includes('google.com/maps/embed') ? settings.map_url : null;

  return (
    <>
      <PageHeader title="Contact" subtitle="Get in touch with the college." />
      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-semibold text-college-primary">{settings?.college_name}, {settings?.campus_name}</h2>
            <ul className="mt-5 space-y-4 text-sm text-slate-700">
              <li className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-college-accent" aria-hidden="true" />{settings?.address ?? <Placeholder label="[ADDRESS TO BE PROVIDED]" />}</li>
              <li className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-college-accent" aria-hidden="true" />{settings?.phone ?? <Placeholder label="[PHONE TO BE PROVIDED]" />}</li>
              <li className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-college-accent" aria-hidden="true" />{settings?.email ?? <Placeholder label="[EMAIL TO BE PROVIDED]" />}</li>
            </ul>
            <p className="mt-6 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Have a question or a concern? You can <Link to="/ask" className="font-medium text-college-primary hover:underline">ask it here</Link>, anonymously if you prefer, and attach files.
            </p>
            {embed ? (
              <iframe title="Map showing the college location" src={embed} loading="lazy" className="mt-6 h-64 w-full rounded border border-slate-200" />
            ) : settings?.map_url ? (
              <a href={settings.map_url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block text-sm font-medium text-college-primary hover:underline">View on map</a>
            ) : (
              <div className="mt-6 flex h-40 items-center justify-center rounded border border-dashed border-slate-300 text-sm text-slate-400">Map location to be provided</div>
            )}
          </div>

          <div>
            {sent ? (
              <div className="rounded border border-slate-200 p-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" aria-hidden="true" />
                <p className="mt-3 font-medium text-college-primary">Message sent</p>
                <p className="mt-1 text-sm text-slate-600">Thank you. We will get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="space-y-4">
                <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label></div>
                <div>
                  <label htmlFor="c-name" className="mb-1 block text-sm font-medium text-slate-700">Name <span className="text-red-600" aria-hidden="true">*</span></label>
                  <input id="c-name" value={f.name} onChange={set('name')} className={cls(!!errors.name)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'c-name-err' : undefined} autoComplete="name" />
                  {errors.name && <p id="c-name-err" role="alert" className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="c-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                    <input id="c-email" type="email" value={f.email} onChange={set('email')} className={cls(!!errors.email)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'c-email-err' : undefined} autoComplete="email" />
                    {errors.email && <p id="c-email-err" role="alert" className="mt-1 text-xs text-red-600">{errors.email}</p>}
                  </div>
                  <div>
                    <label htmlFor="c-phone" className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                    <input id="c-phone" type="tel" value={f.phone} onChange={set('phone')} className={cls(!!errors.phone)} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'c-phone-err' : undefined} autoComplete="tel" />
                    {errors.phone && <p id="c-phone-err" role="alert" className="mt-1 text-xs text-red-600">{errors.phone}</p>}
                  </div>
                </div>
                <div>
                  <label htmlFor="c-subject" className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
                  <input id="c-subject" value={f.subject} onChange={set('subject')} className={cls(false)} />
                </div>
                <div>
                  <label htmlFor="c-message" className="mb-1 block text-sm font-medium text-slate-700">Message <span className="text-red-600" aria-hidden="true">*</span></label>
                  <textarea id="c-message" rows={5} value={f.message} onChange={set('message')} className={cls(!!errors.message)} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'c-message-err' : undefined} />
                  {errors.message && <p id="c-message-err" role="alert" className="mt-1 text-xs text-red-600">{errors.message}</p>}
                </div>
                {submitError && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}
                <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Sending…' : 'Send Message'}</button>
              </form>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
