import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TrackedApplication, trackApplication } from '@/services/admissions';
import { PageHeader, Section, StateBox, btnPrimary, fmtDate } from '../components';

const STEPS = [
  { key: 'SUBMITTED', label: 'Received' },
  { key: 'UNDER_REVIEW', label: 'Under review' },
  { key: 'DECISION', label: 'Decision' },
];

const inputCls = 'field';

export default function TrackApplication() {
  const [params] = useSearchParams();
  const [no, setNo] = useState(params.get('no') ?? '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackedApplication | null | undefined>(undefined);

  useEffect(() => { document.title = 'Check Application Status'; }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!no.trim() || !phone.trim()) { setError('Enter your application number and phone number.'); return; }
    setBusy(true); setError(null); setResult(undefined);
    try { setResult(await trackApplication(no.trim(), phone.trim())); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  const stepIndex = result ? (result.status === 'SUBMITTED' ? 0 : result.status === 'UNDER_REVIEW' ? 1 : 2) : 0;

  return (
    <>
      <PageHeader title="Check Application Status" subtitle="Enter your application number and the phone number you used on the form." />
      <Section>
        <div className="mx-auto max-w-xl">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="ta-no" className="field-label">Application number</label>
              <input id="ta-no" value={no} onChange={(e) => setNo(e.target.value)} placeholder="ADM-2026-00001" autoComplete="off" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label htmlFor="ta-phone" className="field-label">Phone number</label>
              <input id="ta-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="The applicant's or guardian's phone" autoComplete="tel" className={inputCls} />
            </div>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Checking…' : 'Check status'}</button>
          </form>

          {error && <div className="mt-4"><StateBox kind="error" message={error} /></div>}
          {result === null && <div className="mt-6"><StateBox kind="empty" message="No application matches these details. Please check the number and phone, or contact the admissions office." /></div>}

          {result && (
            <div className="mt-8 space-y-5" aria-live="polite">
              <div className="surface p-5 shadow-card sm:p-6">
                <p className="text-xs text-[var(--text-2)]">Application {result.application_no} · submitted {fmtDate(result.submitted_at)}</p>
                <h2 className="mt-1 font-medium text-college-primary">{result.first_name}, applying for {result.program}</h2>

                <ol className="mt-5 flex items-center gap-2 text-xs sm:text-sm" aria-label="Progress">
                  {STEPS.map((st, i) => {
                    const done = i <= stepIndex;
                    const text = i === 2 && result.status === 'ACCEPTED' ? 'Accepted' : i === 2 && result.status === 'REJECTED' ? 'Not accepted' : st.label;
                    return (
                      <li key={st.key} className={`flex-1 rounded-lg px-2 py-2.5 text-center font-semibold ${done ? (i === 2 && result.status === 'REJECTED' ? 'bg-red-50 text-red-800' : 'bg-college-primary text-white') : 'bg-[#EEF2F9] text-[var(--text-2)]'}`}>{text}</li>
                    );
                  })}
                </ol>

                <p className="mt-5 text-sm leading-relaxed">
                  {result.status === 'SUBMITTED' && 'Your application has been received and is waiting for review.'}
                  {result.status === 'UNDER_REVIEW' && 'Your application is being reviewed by the admissions office.'}
                  {result.status === 'ACCEPTED' && `Congratulations. Your application was accepted${result.decided_at ? ` on ${fmtDate(result.decided_at)}` : ''}. The admissions office will contact you about the next steps.`}
                  {result.status === 'REJECTED' && `We are sorry. Your application was not accepted${result.decided_at ? ` on ${fmtDate(result.decided_at)}` : ''}. You may contact the admissions office for more information.`}
                </p>
              </div>

              {result.message && (
                <div className="rounded-xl bg-[var(--soft-blue)] p-5 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-2)]">Message from admissions</p>
                  <p className="mt-2 whitespace-pre-wrap text-[var(--text)]">{result.message}</p>
                  {result.message_at && <p className="mt-2 text-xs text-[var(--text-2)]">{fmtDate(result.message_at)}</p>}
                </div>
              )}
            </div>
          )}
          <p className="mt-8 text-sm text-[var(--text-2)]">Not applied yet? <Link to="/admissions/apply" className="font-medium text-college-primary hover:underline">Apply online</Link></p>
        </div>
      </Section>
    </>
  );
}
