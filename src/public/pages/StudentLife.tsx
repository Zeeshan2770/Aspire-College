import { useSite } from '../SiteProvider';
import { PageHeader, Section, StateBox } from '../components';

export default function StudentLife() {
  const { items, text } = useSite();
  const sections = items<{ title: string; text?: string }>('student_life');
  return (
    <>
      <PageHeader title="Student Life" subtitle="Activities, societies, competitions and achievements." />
      <Section>
        {text('student_life_intro') && <p className="mb-8 max-w-3xl text-slate-700">{text('student_life_intro')}</p>}
        {!sections.length ? (
          <StateBox kind="empty" message="Student life information will be published here once it has been provided." />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {sections.map((s, i) => (
              <article key={i} className="rounded border border-slate-200 p-5">
                <h3 className="font-display text-lg font-semibold text-college-primary">{s.title}</h3>
                {s.text && <p className="mt-2 text-sm text-slate-600">{s.text}</p>}
              </article>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
