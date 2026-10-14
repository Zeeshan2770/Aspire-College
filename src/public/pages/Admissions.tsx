import { Link } from 'react-router-dom';
import { useSite } from '../SiteProvider';
import { fetchPrograms } from '../api';
import { useAsync } from '../useAsync';
import { Block, PageHeader, Section, StateBox, btnPrimary } from '../components';

export default function Admissions() {
  const { settings, content } = useSite();
  const programs = useAsync(fetchPrograms);
  const open = settings?.admissions_open !== false;
  const blocks: [string, string][] = [
    ['Eligibility', 'admission_eligibility'],
    ['Admission Procedure', 'admission_procedure'],
    ['Required Information and Documents', 'admission_documents'],
    ['Important Dates', 'admission_dates'],
    ['Fee Information', 'admission_fees'],
  ];
  return (
    <>
      <PageHeader title="Admissions" subtitle="How to apply to the college." eyebrow="Join us" />
      <Section>
        <div className="glass-hairline flex flex-col items-start justify-between gap-5 rounded-xl border border-[var(--border)] bg-[var(--soft-blue)] p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-start gap-4">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${open ? 'bg-[var(--ok)]' : 'bg-[var(--warn)]'}`} aria-hidden="true" />
            <div>
              <p className="font-display text-xl font-bold text-college-primary">{open ? 'Applications are open' : 'Applications are currently closed'}</p>
              <p className="mt-1 text-sm text-[var(--text-2)]">{open ? 'You can submit your application online at any time.' : 'Please check back later or contact the admissions office.'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {open && <Link to="/admissions/apply" className={btnPrimary}>Apply Online</Link>}
            <Link to="/admissions/status" className="btn btn-secondary">Check application status</Link>
          </div>
        </div>
      </Section>
      <Section title="Available Programs" muted>
        {programs.loading ? <StateBox kind="loading" /> : programs.error ? <StateBox kind="error" message={programs.error} onRetry={programs.retry} /> : !programs.data?.length ? (
          <StateBox kind="empty" message="Programs will be listed here once they have been added." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {programs.data.map((p) => (<li key={p.id} className="surface px-5 py-4 text-sm"><span className="font-display font-bold text-college-primary">{p.name}</span>{p.level && <span className="text-[var(--text-2)]"> · {p.level}</span>}</li>))}
          </ul>
        )}
      </Section>
      {blocks.map(([title, key], i) => (
        <Section key={key} title={title} muted={i % 2 === 1}>
          <div className="prose-body"><Block value={content[key]} /></div>
        </Section>
      ))}
    </>
  );
}
