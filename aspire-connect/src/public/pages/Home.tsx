import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Calendar, Users, Award, GraduationCap } from 'lucide-react';
import { useSite, TBP } from '../SiteProvider';
import { Photo, Section, StateBox, Txt, btnPrimary, btnSecondary, fmtDate } from '../components';
import { fetchEvents, fetchNews, fetchPrograms } from '../api';
import { useAsync } from '../useAsync';

const DEFAULT_STRENGTHS = [
  { title: 'Qualified Faculty', icon: Users },
  { title: 'Academic Support', icon: BookOpen },
  { title: 'Student Development', icon: GraduationCap },
  { title: 'Co-curricular Opportunities', icon: Award },
];

export default function Home() {
  const { settings, text, items } = useSite();
  const programs = useAsync(fetchPrograms);
  const news = useAsync(() => fetchNews(4));
  const events = useAsync(fetchEvents);

  const statement = text('hero_statement') ?? settings?.tagline ?? 'Empowering students through quality education, discipline and opportunity.';
  const strengths = items<{ title: string; text?: string }>('why_aspire');
  const values = items<{ title: string; text?: string }>('core_values');
  const today = new Date(new Date().toDateString()).getTime();
  const upcoming = (events.data ?? [])
    .filter((e) => new Date(e.starts_at).getTime() >= today)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
    .slice(0, 3);
  const shownEvents = upcoming.length ? upcoming : (events.data ?? []).slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="bg-college-primary text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{settings?.campus_name ?? 'Taunsa Sharif'}</p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">{settings?.college_name ?? 'Aspire Group of Colleges'}</h1>
            <p className="mt-5 max-w-xl text-lg text-white/85">{statement}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {settings?.admissions_open !== false && (
                <Link to="/admissions/apply" className="inline-flex items-center justify-center rounded bg-white px-5 py-2.5 text-sm font-semibold text-college-primary hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-college-accent focus-visible:ring-offset-2 focus-visible:ring-offset-college-primary">
                  Apply for Admission
                </Link>
              )}
              <Link to="/academics" className="inline-flex items-center justify-center rounded border border-white/60 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                Explore Academics
              </Link>
            </div>
          </div>
          <Photo src={settings?.hero_image_url} alt="Campus" className="aspect-[4/3] w-full rounded" label="Campus photograph to be provided" />
        </div>
      </section>

      {/* About preview */}
      <Section eyebrow="About" title={`About ${settings?.college_name ?? 'Aspire'}`}>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="text-slate-700">
            <Txt value={text('about_intro')} multiline />
            <Link to="/about" className={`${btnSecondary} mt-6`}>
              Learn More
            </Link>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Our values</h3>
            {values.length ? (
              <ul className="mt-3 space-y-3">
                {values.slice(0, 4).map((v, i) => (
                  <li key={i} className="border-l-2 border-college-accent pl-4">
                    <p className="font-medium text-college-primary">{v.title}</p>
                    {v.text && <p className="text-sm text-slate-600">{v.text}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm"><Txt /></p>
            )}
          </div>
        </div>
      </Section>

      {/* Programs */}
      <Section eyebrow="Academics" title="Programs Offered" muted>
        {programs.loading ? (
          <StateBox kind="loading" />
        ) : programs.error ? (
          <StateBox kind="error" message={programs.error} onRetry={programs.retry} />
        ) : !programs.data?.length ? (
          <StateBox kind="empty" message="Programs will be listed here once they have been added." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {programs.data.slice(0, 6).map((p) => (
              <div key={p.id} className="rounded border border-slate-200 bg-white p-5">
                {p.level && <p className="text-xs font-semibold uppercase tracking-wider text-college-accent">{p.level}</p>}
                <h3 className="mt-1 font-display text-lg font-semibold text-college-primary">{p.name}</h3>
                {p.description && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{p.description}</p>}
              </div>
            ))}
          </div>
        )}
        <Link to="/academics" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-college-primary hover:underline">
          View academics <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Section>

      {/* Why Aspire */}
      <Section eyebrow="Why Aspire" title="Our Strengths">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(strengths.length ? strengths.map((s) => ({ title: s.title, text: s.text, icon: Award })) : DEFAULT_STRENGTHS.map((s) => ({ title: s.title, text: undefined as string | undefined, icon: s.icon }))).map((s, i) => (
            <div key={i}>
              <s.icon className="h-6 w-6 text-college-accent" aria-hidden="true" />
              <h3 className="mt-3 font-medium text-college-primary">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.text ?? <span className="italic text-slate-400">{TBP}</span>}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Principal's message */}
      <Section muted>
        <div className="grid items-start gap-8 md:grid-cols-[220px_1fr]">
          <Photo src={settings?.principal_photo_url} alt="Principal" className="aspect-[3/4] w-full max-w-[220px] rounded" label="Principal's photograph to be provided" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-college-accent">A message from the Principal</p>
            <div className="mt-4 text-slate-700">
              <Txt value={settings?.principal_message} multiline />
            </div>
            <p className="mt-5 font-display text-lg font-semibold text-college-primary">
              <Txt value={settings?.principal_name} />
            </p>
            <p className="text-sm text-slate-500">Principal, {settings?.college_name ?? 'Aspire Group of Colleges'}</p>
          </div>
        </div>
      </Section>

      {/* News & events */}
      <Section eyebrow="Latest" title="News & Events">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">News</h3>
            {news.loading ? (
              <StateBox kind="loading" />
            ) : news.error ? (
              <StateBox kind="error" message={news.error} onRetry={news.retry} />
            ) : !news.data?.length ? (
              <StateBox kind="empty" message="No news has been published yet." />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {news.data.map((n) => (
                  <Link key={n.id} to={`/news/${n.id}`} className="group block overflow-hidden rounded border border-slate-200 bg-white hover:border-slate-300">
                    <Photo src={n.image_url} alt="" className="aspect-[16/9] w-full" label="Image" />
                    <div className="p-4">
                      <p className="text-xs text-slate-500">{fmtDate(n.published_at)} · {n.category}</p>
                      <h4 className="mt-1 font-medium text-college-primary group-hover:underline">{n.title}</h4>
                      {n.summary && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{n.summary}</p>}
                      <span className="mt-2 inline-block text-sm font-medium text-college-primary">Read more</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Events</h3>
            {events.loading ? (
              <StateBox kind="loading" />
            ) : events.error ? (
              <StateBox kind="error" message={events.error} onRetry={events.retry} />
            ) : !shownEvents.length ? (
              <StateBox kind="empty" message="No events have been published yet." />
            ) : (
              <ul className="space-y-4">
                {shownEvents.map((e) => (
                  <li key={e.id} className="flex gap-3 border-b border-slate-200 pb-4">
                    <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-college-accent" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-college-primary">{e.title}</p>
                      <p className="text-sm text-slate-500">{fmtDate(e.starts_at)}{e.location ? ` · ${e.location}` : ''}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/news" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-college-primary hover:underline">
              All news and events <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Section>

      {/* CTA */}
      {settings?.admissions_open !== false && (
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 px-4 py-12 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="font-display text-2xl font-semibold text-college-primary">Begin Your Academic Journey</h2>
              <p className="mt-1 text-slate-600">Submit your application online. Our admissions office will review it and contact you.</p>
            </div>
            <Link to="/admissions/apply" className={btnPrimary}>
              Apply for Admission
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
