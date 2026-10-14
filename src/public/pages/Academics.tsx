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
      <PageHeader title="Academics" subtitle="Programs, departments and academic support." eyebrow="Learn" />
      <Section title="Programs">
        {programs.loading ? <StateBox kind="loading" /> : programs.error ? <StateBox kind="error" message={programs.error} onRetry={programs.retry} /> : !programs.data?.length ? (
          <StateBox kind="empty" message="Programs will be listed here once they have been added." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {programs.data.map((p) => (
              <article key={p.id} className="surface surface-hover reveal p-6 sm:p-7">
                {p.level && <span className="chip">{p.level}</span>}
                <h3 className="mt-3 font-display text-h3 text-college-primary">{p.name}</h3>
                {p.description && <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{p.description}</p>}
                <dl className="mt-5 grid gap-3 border-t border-[var(--border)] pt-4 text-sm sm:grid-cols-2">
                  {p.duration && (<div><dt className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-2)]">Duration</dt><dd className="mt-0.5 font-medium">{p.duration}</dd></div>)}
                  {p.eligibility && (<div><dt className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-2)]">Eligibility</dt><dd className="mt-0.5 font-medium">{p.eligibility}</dd></div>)}
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
            {departments.map((d) => (<li key={d} className="rounded-full border border-[#CBD5E4] bg-white px-4 py-2 text-sm font-medium text-college-primary">{d}</li>))}
          </ul>
        )}
      </Section>

      <Section title="Academic Structure">
        <div className="prose-body"><Txt value={text('academic_structure')} multiline /></div>
      </Section>
      <Section title="Academic Support" muted>
        <div className="prose-body"><Txt value={text('academic_support')} multiline /></div>
      </Section>
      <Section title="Examinations">
        <div className="prose-body"><Txt value={text('exam_info')} multiline /></div>
      </Section>
    </>
  );
}
