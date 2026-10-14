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
  const cls = (_bad: boolean) => 'field';

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
      <PageHeader title="Contact" subtitle="Get in touch with the college." eyebrow="Reach us" />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <h2 className="font-display text-h3 text-college-primary">{settings?.college_name}, {settings?.campus_name}</h2>
            <ul className="mt-6 space-y-4 text-[0.95rem]">
              <li className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-college-accent" aria-hidden="true" />{settings?.address ?? <Placeholder label="Address coming soon" />}</li>
              <li className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-college-accent" aria-hidden="true" />{settings?.phone ?? <Placeholder label="Phone coming soon" />}</li>
              <li className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-college-accent" aria-hidden="true" />{settings?.email ?? <Placeholder label="Email coming soon" />}</li>
            </ul>
            <p className="mt-7 rounded-xl border border-[var(--border)] bg-[var(--soft-blue)] px-5 py-4 text-sm">
              Have a question or a concern? You can <Link to="/ask" className="font-medium text-college-primary hover:underline">ask it here</Link>, anonymously if you prefer, and attach files.
            </p>
            {embed ? (
              <iframe title="Map showing the college location" src={embed} loading="lazy" className="mt-6 h-72 w-full rounded-xl border border-[var(--border)] shadow-soft" />
            ) : settings?.map_url ? (
              <a href={settings.map_url} target="_blank" rel="noopener noreferrer" className="link-arrow mt-6">View on map</a>
            ) : (
              <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-[#CBD5E4] text-sm text-[var(--text-2)]">Map location to be provided</div>
            )}
          </div>

          <div>
            {sent ? (
              <div className="surface p-10 text-center shadow-card">
                <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--ok)]" aria-hidden="true" />
                <p className="mt-4 font-display text-xl font-bold text-college-primary">Message sent</p>
                <p className="mt-1 text-sm text-[var(--text-2)]">Thank you. We will get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="surface space-y-5 p-6 shadow-card sm:p-8">
                <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label></div>
                <div>
                  <label htmlFor="c-name" className="field-label">Name <span className="text-[var(--err)]" aria-hidden="true">*</span></label>
                  <input id="c-name" value={f.name} onChange={set('name')} className={cls(!!errors.name)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'c-name-err' : undefined} autoComplete="name" />
                  {errors.name && <p id="c-name-err" role="alert" className="field-error">{errors.name}</p>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="c-email" className="field-label">Email</label>
                    <input id="c-email" type="email" value={f.email} onChange={set('email')} className={cls(!!errors.email)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'c-email-err' : undefined} autoComplete="email" />
                    {errors.email && <p id="c-email-err" role="alert" className="field-error">{errors.email}</p>}
                  </div>
                  <div>
                    <label htmlFor="c-phone" className="field-label">Phone</label>
                    <input id="c-phone" type="tel" value={f.phone} onChange={set('phone')} className={cls(!!errors.phone)} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'c-phone-err' : undefined} autoComplete="tel" />
                    {errors.phone && <p id="c-phone-err" role="alert" className="field-error">{errors.phone}</p>}
                  </div>
                </div>
                <div>
                  <label htmlFor="c-subject" className="field-label">Subject</label>
                  <input id="c-subject" value={f.subject} onChange={set('subject')} className={cls(false)} />
                </div>
                <div>
                  <label htmlFor="c-message" className="field-label">Message <span className="text-[var(--err)]" aria-hidden="true">*</span></label>
                  <textarea id="c-message" rows={5} value={f.message} onChange={set('message')} className={cls(!!errors.message)} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'c-message-err' : undefined} />
                  {errors.message && <p id="c-message-err" role="alert" className="field-error">{errors.message}</p>}
                </div>
                {submitError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{submitError}</div>}
                <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Sending…' : 'Send Message'}</button>
              </form>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
