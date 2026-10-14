import { useSite } from '../SiteProvider';
import { PageHeader, Section, StateBox } from '../components';

export default function StudentLife() {
  const { items, text } = useSite();
  const sections = items<{ title: string; text?: string }>('student_life');
  return (
    <>
      <PageHeader title="Student Life" subtitle="Activities, societies, competitions and achievements." eyebrow="Beyond the classroom" />
      <Section>
        {text('student_life_intro') && <p className="prose-body mb-10">{text('student_life_intro')}</p>}
        {!sections.length ? (
          <StateBox kind="empty" message="Student life information will be published here once it has been provided." />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {sections.map((s, i) => (
              <article key={i} className="surface surface-hover reveal p-6 sm:p-7">
                <h3 className="font-display text-h3 text-college-primary">{s.title}</h3>
                {s.text && <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{s.text}</p>}
              </article>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
