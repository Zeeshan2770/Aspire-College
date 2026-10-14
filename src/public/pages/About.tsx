import { useSite } from '../SiteProvider';
import { PageHeader, Section, Txt } from '../components';

export default function About() {
  const { settings, text, items } = useSite();
  const values = items<{ title: string; text?: string }>('core_values');
  return (
    <>
      <PageHeader title={`About ${settings?.college_name ?? 'Aspire'}`} subtitle={settings?.campus_name} eyebrow="Who we are" />
      <Section title="Introduction">
        <div className="prose-body"><Txt value={text('about_intro')} multiline /></div>
      </Section>
      <Section muted>
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="eyebrow">Vision</p>
            <div className="prose-body mt-3"><Txt value={text('vision')} multiline /></div>
          </div>
          <div>
            <p className="eyebrow">Mission</p>
            <div className="prose-body mt-3"><Txt value={text('mission')} multiline /></div>
          </div>
        </div>
      </Section>
      <Section title="Core Values">
        {values.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((v, i) => (
              <div key={i} className="surface reveal p-6">
                <span className="font-display text-sm font-bold tabular-nums text-[rgb(var(--c-accent))]">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-2 font-display text-h3 text-college-primary">{v.title}</h3>
                {v.text && <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{v.text}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm"><Txt /></p>
        )}
      </Section>
      <Section title="Educational Philosophy" muted>
        <div className="prose-body"><Txt value={text('philosophy')} multiline /></div>
      </Section>
    </>
  );
}
