import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TrackedQuery, statusLabel, trackQuery } from '@/services/queries';
import { PageHeader, Section, StateBox, btnPrimary, fmtDate } from '../components';

export default function TrackQuery() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackedQuery | null | undefined>(undefined);

  async function look(c: string) {
    if (!c.trim()) { setError('Enter your tracking code.'); return; }
    setBusy(true); setError(null); setResult(undefined);
    try { setResult(await trackQuery(c.trim())); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function onSubmit(e: FormEvent) { e.preventDefault(); look(code); }
  useEffect(() => { const c = params.get('code'); if (c) look(c); /* eslint-disable-next-line */ }, []);

  return (
    <>
      <PageHeader title="Check Your Answer" subtitle="Enter the tracking code you received when you asked your question." />
      <Section>
        <div className="mx-auto max-w-xl">
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="t-code" className="field-label">Tracking code</label>
              <input id="t-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Q-XXXXX-XXXXX" autoComplete="off" className="field font-mono" />
            </div>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Looking…' : 'Check'}</button>
          </form>
          {error && <div className="mt-4"><StateBox kind="error" message={error} /></div>}
          {result === null && <div className="mt-6"><StateBox kind="empty" message="No question was found with this code. Please check it and try again." /></div>}
          {result && (
            <div className="mt-8 space-y-5" aria-live="polite">
              <div className="surface p-5 shadow-card">
                <p className="text-xs text-[var(--text-2)]">{result.category} · {fmtDate(result.created_at)} · <span className="font-medium text-college-primary">{statusLabel(result.status)}</span></p>
                <h2 className="mt-1 font-medium text-college-primary">{result.subject}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text)]">{result.message}</p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-2)]">Reply from the college</h3>
                {result.replies.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#CBD5E4] px-4 py-6 text-center text-sm text-[var(--text-2)]">There is no reply yet. Please check again later.</p>
                ) : (
                  <ul className="space-y-3">
                    {result.replies.map((r, i) => (
                      <li key={i} className="rounded-lg bg-[var(--soft-blue)] p-4 text-sm">
                        <p className="whitespace-pre-wrap text-[var(--text)]">{r.body}</p>
                        <p className="mt-2 text-xs text-[var(--text-2)]">{fmtDate(r.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <p className="mt-8 text-sm text-[var(--text-2)]">Have another question? <Link to="/ask" className="font-medium text-college-primary hover:underline underline-offset-4">Ask a question</Link></p>
        </div>
      </Section>
    </>
  );
}
