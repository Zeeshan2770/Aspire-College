import { FormEvent, ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useSite } from '../SiteProvider';
import { fetchPrograms, submitRpc } from '../api';
import { useAsync } from '../useAsync';
import { saveTracking } from '../myTracking';
import { PageHeader, Section, StateBox, btnPrimary, btnSecondary } from '../components';

type Form = Record<string, string>;
const PHONE = /^[0-9+\-\s]{10,16}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const input = (_bad: boolean) => 'field';

function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label} {required && <span className="text-[var(--err)]" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-xs text-[var(--text-2)]">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="field-error">{error}</p>}
    </div>
  );
}

function validate(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  const req = (k: string, m: string) => { if (!f[k]?.trim()) e[k] = m; };
  req('full_name', 'Enter the applicant\'s full name.');
  req('father_name', 'Enter the father\'s or guardian\'s name.');
  req('gender', 'Select a gender.');
  req('address', 'Enter the address.');
  req('program_applied', 'Select the program you are applying for.');
  req('guardian_name', 'Enter the guardian\'s name.');
  req('guardian_relationship', 'Enter the relationship to the applicant.');
  if (!f.date_of_birth) e.date_of_birth = 'Enter the date of birth.';
  else {
    const d = new Date(f.date_of_birth);
    const now = new Date();
    const age = (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (isNaN(d.getTime()) || age < 5 || age > 45) e.date_of_birth = 'Enter a valid date of birth.';
  }
  if (!PHONE.test(f.phone?.trim() ?? '')) e.phone = 'Enter a valid phone number (10 to 16 digits).';
  if (!PHONE.test(f.guardian_phone?.trim() ?? '')) e.guardian_phone = 'Enter a valid phone number (10 to 16 digits).';
  if (f.email?.trim() && !EMAIL.test(f.email.trim())) e.email = 'Enter a valid email address.';
  if (f.percentage?.trim()) {
    const n = Number(f.percentage);
    if (isNaN(n) || n < 0 || n > 100) e.percentage = 'Percentage must be between 0 and 100.';
  }
  if (f.passing_year?.trim()) {
    const y = Number(f.passing_year);
    if (!Number.isInteger(y) || y < 1990 || y > new Date().getFullYear() + 1) e.passing_year = 'Enter a valid year.';
  }
  return e;
}

export default function Apply() {
  const { settings } = useSite();
  const programs = useAsync(fetchPrograms);
  const [f, setF] = useState<Form>({ website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [appNo, setAppNo] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const p = (k: string) => ({ id: k, value: f[k] ?? '', onChange: set(k), className: input(!!errors[k]), 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined });

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitError(null);
    const v = validate(f);
    setErrors(v);
    if (Object.keys(v).length) {
      document.getElementById(Object.keys(v)[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await submitRpc('submit_admission', f);
      setAppNo(res.application_no ?? null);
      if (res.application_no) saveTracking('app', res.application_no);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (settings && settings.admissions_open === false) {
    return (<><PageHeader title="Apply for Admission" /><Section><StateBox kind="empty" message="Applications are currently closed. Please contact the admissions office." /></Section></>);
  }

  if (appNo) {
    return (
      <>
        <PageHeader title="Application Submitted" />
        <Section>
          <div className="surface mx-auto max-w-xl p-8 text-center shadow-card sm:p-10">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--ok)]" aria-hidden="true" />
            <p className="mt-4 text-lg font-medium text-[var(--text)]">Thank you. Your application has been received.</p>
            <p className="eyebrow mt-6">Your application number</p>
            <p className="mt-1 select-all font-display text-3xl font-bold tabular-nums text-college-primary">{appNo}</p>
            <p className="mt-4 text-sm text-[var(--text-2)]">Please keep this number for reference. The admissions office will contact you using the phone number you provided.</p>
            <p className="mt-3 text-sm text-[var(--text-2)]">You can check your decision at any time on the <Link to={`/admissions/status?no=${encodeURIComponent(appNo)}`} className="font-medium text-college-primary hover:underline underline-offset-4">application status page</Link> using this number and your phone number.</p>
            <div className="mt-6 flex justify-center gap-3 print:hidden">
              <button onClick={() => window.print()} className={btnSecondary}>Print</button>
              <Link to="/" className={btnPrimary}>Back to Home</Link>
            </div>
          </div>
        </Section>
      </>
    );
  }

  const fieldset = 'surface p-5 sm:p-8';
  const legend = 'px-1 font-display text-h3 text-college-primary';

  return (
    <>
      <PageHeader title="Apply for Admission" subtitle="Fields marked * are required." parent={{ label: 'Admissions', to: '/admissions' }} />
      <Section>
        <form onSubmit={onSubmit} noValidate className="mx-auto max-w-3xl space-y-6">
          {/* honeypot: hidden from people, left empty */}
          <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label></div>

          <fieldset className={fieldset}>
            <legend className={legend}>Applicant Information</legend>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field id="full_name" label="Full name" required error={errors.full_name}><input {...p('full_name')} autoComplete="name" /></Field>
              <Field id="father_name" label="Father's / guardian's name" required error={errors.father_name}><input {...p('father_name')} /></Field>
              <Field id="date_of_birth" label="Date of birth" required error={errors.date_of_birth}><input type="date" {...p('date_of_birth')} autoComplete="bday" /></Field>
              <Field id="gender" label="Gender" required error={errors.gender}>
                <select {...p('gender')}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select>
              </Field>
              <Field id="phone" label="Phone number" required error={errors.phone}><input type="tel" {...p('phone')} autoComplete="tel" /></Field>
              <Field id="email" label="Email address" error={errors.email}><input type="email" {...p('email')} autoComplete="email" /></Field>
              <div className="sm:col-span-2"><Field id="address" label="Address" required error={errors.address}><textarea rows={2} {...p('address')} autoComplete="street-address" /></Field></div>
            </div>
          </fieldset>

          <fieldset className={fieldset}>
            <legend className={legend}>Academic Information</legend>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field id="previous_institution" label="Previous institution"><input {...p('previous_institution')} /></Field>
              <Field id="previous_class" label="Previous class / qualification"><input {...p('previous_class')} /></Field>
              <Field id="percentage" label="Marks (percentage)" error={errors.percentage} hint="Between 0 and 100"><input type="number" step="0.01" min="0" max="100" {...p('percentage')} /></Field>
              <Field id="board" label="Board"><input {...p('board')} /></Field>
              <Field id="passing_year" label="Passing year" error={errors.passing_year}><input type="number" {...p('passing_year')} /></Field>
            </div>
          </fieldset>

          <fieldset className={fieldset}>
            <legend className={legend}>Program</legend>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field id="program_applied" label="Applying for" required error={errors.program_applied}>
                {programs.data?.length ? (
                  <select {...p('program_applied')}><option value="">Select a program</option>{programs.data.map((x) => <option key={x.id}>{x.name}</option>)}</select>
                ) : (
                  <input {...p('program_applied')} placeholder="Program or class" />
                )}
              </Field>
              <Field id="preferred_class" label="Preferred class / group"><input {...p('preferred_class')} /></Field>
            </div>
          </fieldset>

          <fieldset className={fieldset}>
            <legend className={legend}>Guardian Information</legend>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field id="guardian_name" label="Guardian name" required error={errors.guardian_name}><input {...p('guardian_name')} /></Field>
              <Field id="guardian_relationship" label="Relationship" required error={errors.guardian_relationship}><input {...p('guardian_relationship')} /></Field>
              <Field id="guardian_phone" label="Guardian contact number" required error={errors.guardian_phone}><input type="tel" {...p('guardian_phone')} /></Field>
            </div>
          </fieldset>

          {submitError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{submitError}</div>}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link to="/admissions" className={btnSecondary}>Cancel</Link>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Submitting…' : 'Submit Application'}</button>
          </div>
        </form>
      </Section>
    </>
  );
}
