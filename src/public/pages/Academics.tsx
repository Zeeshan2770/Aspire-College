import { useMemo } from 'react';
import { useSite } from '../SiteProvider';
import { fetchFaculty, fetchPrograms } from '../api';
import { useAsync } from '../useAsync';
import { PageHeader, Section, StateBox, Txt } from '../components';

export default function Academics() {
  const { text } = useSite();
  const programs = useAsync(fetchPrograms);
  const faculty = useAsync(fetchFaculty);
  const departments = useMemo(
    () => Array.from(new Set((faculty.data ?? []).map((f) => f.department?.trim()).filter(Boolean) as string[])).sort(),
    [faculty.data]
  );

  return (
    <>
      <PageHeader title="Academics" subtitle="Programs, departments and academic support." />
      <Section title="Programs">
        {programs.loading ? <StateBox kind="loading" /> : programs.error ? <StateBox kind="error" message={programs.error} onRetry={programs.retry} /> : !programs.data?.length ? (
          <StateBox kind="empty" message="Programs will be listed here once they have been added." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {programs.data.map((p) => (
              <article key={p.id} className="rounded border border-slate-200 p-5">
                {p.level && <p className="text-xs font-semibold uppercase tracking-wider text-college-accent">{p.level}</p>}
                <h3 className="mt-1 font-display text-xl font-semibold text-college-primary">{p.name}</h3>
                {p.description && <p className="mt-2 text-sm text-slate-600">{p.description}</p>}
                <dl className="mt-3 space-y-1 text-sm">
                  {p.duration && (<div className="flex gap-2"><dt className="font-medium text-slate-700">Duration:</dt><dd className="text-slate-600">{p.duration}</dd></div>)}
                  {p.eligibility && (<div className="flex gap-2"><dt className="font-medium text-slate-700">Eligibility:</dt><dd className="text-slate-600">{p.eligibility}</dd></div>)}
                </dl>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section title="Departments and Subject Areas" muted>
        {faculty.loading ? <StateBox kind="loading" /> : !departments.length ? (
          <StateBox kind="empty" message="Departments will appear here as faculty records are added." />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {departments.map((d) => (<li key={d} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">{d}</li>))}
          </ul>
        )}
      </Section>

      <Section title="Academic Structure">
        <div className="max-w-3xl text-slate-700"><Txt value={text('academic_structure')} multiline /></div>
      </Section>
      <Section title="Academic Support" muted>
        <div className="max-w-3xl text-slate-700"><Txt value={text('academic_support')} multiline /></div>
      </Section>
      <Section title="Examinations">
        <div className="max-w-3xl text-slate-700"><Txt value={text('exam_info')} multiline /></div>
      </Section>
    </>
  );
}
