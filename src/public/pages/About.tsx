import { useSite } from '../SiteProvider';
import { PageHeader, Section, Txt } from '../components';

export default function About() {
  const { settings, text, items } = useSite();
  const values = items<{ title: string; text?: string }>('core_values');
  return (
    <>
      <PageHeader title={`About ${settings?.college_name ?? 'Aspire'}`} subtitle={settings?.campus_name} />
      <Section title="Introduction">
        <div className="max-w-3xl text-slate-700"><Txt value={text('about_intro')} multiline /></div>
      </Section>
      <Section muted>
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-semibold text-college-primary">Vision</h2>
            <div className="mt-3 text-slate-700"><Txt value={text('vision')} multiline /></div>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold text-college-primary">Mission</h2>
            <div className="mt-3 text-slate-700"><Txt value={text('mission')} multiline /></div>
          </div>
        </div>
      </Section>
      <Section title="Core Values">
        {values.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((v, i) => (
              <div key={i} className="border-l-2 border-college-accent pl-4">
                <h3 className="font-medium text-college-primary">{v.title}</h3>
                {v.text && <p className="mt-1 text-sm text-slate-600">{v.text}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm"><Txt /></p>
        )}
      </Section>
      <Section title="Educational Philosophy" muted>
        <div className="max-w-3xl text-slate-700"><Txt value={text('philosophy')} multiline /></div>
      </Section>
    </>
  );
}
