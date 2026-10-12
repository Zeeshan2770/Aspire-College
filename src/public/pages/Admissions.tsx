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
      <PageHeader title="Admissions" subtitle="How to apply to the college." />
      <Section>
        <div className="flex flex-col items-start justify-between gap-4 rounded border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium text-college-primary">{open ? 'Applications are open' : 'Applications are currently closed'}</p>
            <p className="text-sm text-slate-600">{open ? 'You can submit your application online at any time.' : 'Please check back later or contact the admissions office.'}</p>
          </div>
          {open && <Link to="/admissions/apply" className={btnPrimary}>Apply Online</Link>}
          <Link to="/admissions/status" className="ml-3 text-sm font-medium text-college-primary hover:underline">Check application status</Link>
        </div>
      </Section>
      <Section title="Available Programs" muted>
        {programs.loading ? <StateBox kind="loading" /> : programs.error ? <StateBox kind="error" message={programs.error} onRetry={programs.retry} /> : !programs.data?.length ? (
          <StateBox kind="empty" message="Programs will be listed here once they have been added." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {programs.data.map((p) => (<li key={p.id} className="rounded border border-slate-200 bg-white px-4 py-3 text-sm"><span className="font-medium text-college-primary">{p.name}</span>{p.level && <span className="text-slate-500"> · {p.level}</span>}</li>))}
          </ul>
        )}
      </Section>
      {blocks.map(([title, key], i) => (
        <Section key={key} title={title} muted={i % 2 === 1}>
          <div className="max-w-3xl text-slate-700"><Block value={content[key]} /></div>
        </Section>
      ))}
    </>
  );
}
