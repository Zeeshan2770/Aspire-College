import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Calendar, Users, Award, GraduationCap, FileText, SearchCheck, UserSquare2, Quote, MapPin } from 'lucide-react';
import { useSite, TBP } from '../SiteProvider';
import { Photo, Section, StateBox, Txt, fmtDate } from '../components';
import { fetchEvents, fetchNews, fetchPrograms } from '../api';
import { useAsync } from '../useAsync';

const DEFAULT_STRENGTHS = [
  { title: 'Qualified Faculty', icon: Users },
  { title: 'Academic Support', icon: BookOpen },
  { title: 'Student Development', icon: GraduationCap },
  { title: 'Co-curricular Opportunities', icon: Award },
];

/** Restrained abstract artwork, used only when no campus photograph has been uploaded. */
function HeroArt() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[var(--r-2xl)] border border-white/10" style={{ background: 'linear-gradient(155deg, rgb(var(--c-secondary)), rgb(var(--ink-950)))' }} aria-hidden="true">
      <svg viewBox="0 0 400 480" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="ha" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgb(var(--c-accent))" stopOpacity=".9" />
            <stop offset="1" stopColor="rgb(var(--c-accent))" stopOpacity=".1" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#ha)" strokeWidth="1.2">
          {[60, 100, 140, 180, 220, 260].map((r) => (<circle key={r} cx="320" cy="400" r={r} />))}
        </g>
        <g fill="none" stroke="#fff" strokeOpacity=".08">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (<line key={i} x1={i * 60} y1="0" x2={i * 60} y2="480" />))}
        </g>
        <circle cx="90" cy="110" r="46" fill="rgb(var(--c-accent))" fillOpacity=".22" />
      </svg>
    </div>
  );
}

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
  const nextEvent = upcoming[0];
  const open = settings?.admissions_open !== false;
  const [lead, ...restNews] = news.data ?? [];

  const quick = [
    { to: '/academics', label: 'Programs', text: 'Explore what we teach', icon: BookOpen },
    { to: '/admissions', label: 'Admissions', text: 'Eligibility and procedure', icon: FileText },
    { to: '/faculty', label: 'Faculty', text: 'Meet our teaching staff', icon: UserSquare2 },
    { to: '/admissions/status', label: 'Track application', text: 'Check your status', icon: SearchCheck },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-college-primary text-white">
        <div className="bg-grid-dark absolute inset-0 -z-10" aria-hidden="true" />
        <div className="absolute -left-32 top-1/3 -z-10 h-96 w-96 rounded-full opacity-30 blur-3xl" style={{ background: 'rgb(var(--c-accent))' }} aria-hidden="true" />
        <div className="mx-auto grid max-w-content items-center gap-12 px-4 pb-28 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-32 lg:pt-20">
          <div>
            <p className="eyebrow-light flex items-center gap-2"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{settings?.campus_name ?? 'Taunsa Sharif'}</p>
            <h1 className="mt-5 font-display text-display">{settings?.college_name ?? 'Aspire Group of Colleges'}</h1>
            <p className="mt-6 max-w-xl text-lead text-white/80">{statement}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              {open && (
                <Link to="/admissions/apply" className="btn btn-light">
                  Apply for Admission <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
              <Link to="/academics" className="btn btn-ghost-light">Explore Academics</Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative aspect-[4/3.6] w-full shadow-hero sm:aspect-[4/3.2] lg:aspect-[4/3.9]" style={{ borderRadius: 'var(--r-2xl)' }}>
              {settings?.hero_image_url ? (
                <Photo priority src={settings.hero_image_url} alt="The college campus" className="h-full w-full rounded-[var(--r-2xl)]" label="Campus photograph" />
              ) : (
                <HeroArt />
              )}
              {settings?.hero_image_url && <div className="pointer-events-none absolute inset-0 rounded-[var(--r-2xl)] bg-gradient-to-t from-[rgb(var(--ink-950)/.55)] via-transparent to-transparent" aria-hidden="true" />}

              <div className="glass-dark glass-hairline absolute -bottom-6 left-4 right-4 rounded-xl p-4 sm:-left-6 sm:right-auto sm:w-72">
                <p className="eyebrow-light">Admissions</p>
                <p className="mt-1 font-display text-lg font-bold">{open ? 'Applications are open' : 'Applications are closed'}</p>
                <Link to={open ? '/admissions/apply' : '/admissions'} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:underline">
                  {open ? 'Start your application' : 'Admissions information'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              {nextEvent && (
                <div className="glass-dark glass-hairline absolute right-4 top-4 hidden max-w-[16rem] rounded-xl p-4 sm:block lg:-right-5">
                  <p className="eyebrow-light flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" aria-hidden="true" /> Next event</p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold">{nextEvent.title}</p>
                  <p className="mt-0.5 text-xs text-white/70">{fmtDate(nextEvent.starts_at)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Quick paths */}
      <section className="relative z-10 -mt-12 px-4 sm:px-6" aria-label="Quick links">
        <ul className="mx-auto grid max-w-content gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quick.map((q, i) => (
            <li key={q.to} className="reveal" style={{ '--d': `${i * 60}ms` } as React.CSSProperties}>
              <Link to={q.to} className="glass surface-hover flex h-full items-center gap-4 rounded-xl p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--soft-blue)] text-[rgb(var(--c-accent))]"><q.icon className="h-5 w-5" aria-hidden="true" /></span>
                <span className="min-w-0">
                  <span className="block font-display text-base font-bold text-college-primary">{q.label}</span>
                  <span className="block text-sm text-[var(--text-2)]">{q.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* About preview */}
      <Section eyebrow="About" title={`About ${settings?.college_name ?? 'Aspire'}`}>
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div className="reveal">
            <div className="prose-body"><Txt value={text('about_intro')} multiline /></div>
            <Link to="/about" className="link-arrow mt-7">Learn more about us <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
          <div className="reveal">
            <h3 className="eyebrow">Our values</h3>
            {values.length ? (
              <ol className="mt-5 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {values.slice(0, 4).map((v, i) => (
                  <li key={i} className="flex gap-4 py-4">
                    <span className="font-display text-sm font-bold tabular-nums text-[rgb(var(--c-accent))]">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <p className="font-display font-bold text-college-primary">{v.title}</p>
                      {v.text && <p className="mt-0.5 text-sm text-[var(--text-2)]">{v.text}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm"><Txt /></p>
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
            {programs.data.slice(0, 6).map((p, i) => (
              <article key={p.id} className="surface surface-hover reveal p-6" style={{ '--d': `${(i % 3) * 60}ms` } as React.CSSProperties}>
                {p.level && <span className="chip">{p.level}</span>}
                <h3 className="mt-3 font-display text-h3 text-college-primary">{p.name}</h3>
                {p.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--text-2)]">{p.description}</p>}
                {p.duration && <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs font-medium text-[var(--text-2)]">Duration · <span className="text-[var(--text)]">{p.duration}</span></p>}
              </article>
            ))}
          </div>
        )}
        <Link to="/academics" className="link-arrow mt-8">View all academics <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </Section>

      {/* Why Aspire */}
      <Section eyebrow="Why Aspire" title="Our Strengths">
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {(strengths.length ? strengths.map((s) => ({ title: s.title, text: s.text, icon: Award })) : DEFAULT_STRENGTHS.map((s) => ({ title: s.title, text: undefined as string | undefined, icon: s.icon }))).map((s, i) => (
            <div key={i} className="reveal" style={{ '--d': `${i * 60}ms` } as React.CSSProperties}>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--soft-blue)] text-[rgb(var(--c-accent))]"><s.icon className="h-6 w-6" aria-hidden="true" /></span>
              <h3 className="mt-4 font-display text-lg font-bold text-college-primary">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-2)]">{s.text ?? <span className="italic text-[#7A8AA3]">{TBP}</span>}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Principal's message */}
      <section className="relative isolate overflow-hidden bg-college-primary text-white">
        <div className="bg-grid-dark absolute inset-0 -z-10 opacity-70" aria-hidden="true" />
        <div className="mx-auto grid max-w-content items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-[190px_1fr] md:gap-14">
          <div className="reveal relative mx-auto w-full max-w-[190px]">
            <Photo src={settings?.principal_photo_url} alt={settings?.principal_name ? `${settings.principal_name}, Principal` : 'Principal'} className="aspect-[3/4] w-full rounded-[var(--r-xl)] shadow-hero" label="Principal's photograph to be provided" />
          </div>
          <div className="reveal">
            <Quote className="h-8 w-8 text-[#9DBBFF]" aria-hidden="true" />
            <p className="eyebrow-light mt-4">A message from the Principal</p>
            <div className="mt-5 max-w-prose text-lg leading-[1.75] text-white/90"><Txt value={settings?.principal_message} multiline /></div>
            <p className="mt-7 font-display text-xl font-bold"><Txt value={settings?.principal_name} /></p>
            <p className="text-sm text-white/65">Principal, {settings?.college_name ?? 'Aspire Group of Colleges'}</p>
          </div>
        </div>
      </section>

      {/* News & events */}
      <Section eyebrow="Latest" title="News & Events">
        <div className="grid gap-12 lg:grid-cols-[1.7fr_1fr]">
          <div>
            {news.loading ? (
              <StateBox kind="loading" />
            ) : news.error ? (
              <StateBox kind="error" message={news.error} onRetry={news.retry} />
            ) : !lead ? (
              <StateBox kind="empty" message="No news has been published yet." />
            ) : (
              <div className="grid gap-5">
                <Link to={`/news/${lead.id}`} className="surface surface-hover reveal group grid overflow-hidden md:grid-cols-[1.1fr_1fr]">
                  <Photo src={lead.image_url} alt="" className="aspect-[16/8] h-full w-full md:aspect-auto md:min-h-[12rem]" label="Image" />
                  <div className="flex flex-col justify-center p-6 sm:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[.1em] text-[rgb(var(--c-accent))]">{lead.category}</p>
                    <h3 className="mt-2 font-display text-h3 text-college-primary group-hover:underline decoration-[rgb(var(--c-accent))] underline-offset-4">{lead.title}</h3>
                    {lead.summary && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--text-2)]">{lead.summary}</p>}
                    <p className="mt-4 text-xs text-[var(--text-2)]">{fmtDate(lead.published_at)}</p>
                  </div>
                </Link>
                {!!restNews.length && (
                  <div className="grid gap-5 sm:grid-cols-3">
                    {restNews.map((n) => (
                      <Link key={n.id} to={`/news/${n.id}`} className="surface surface-hover reveal group flex flex-col overflow-hidden">
                        <Photo src={n.image_url} alt="" className="aspect-[16/8] w-full" label="Image" />
                        <div className="flex flex-1 flex-col p-4">
                          <p className="text-xs text-[var(--text-2)]">{fmtDate(n.published_at)} · {n.category}</p>
                          <h4 className="mt-1.5 font-display text-[0.95rem] font-bold leading-snug text-college-primary group-hover:underline underline-offset-4">{n.title}</h4>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <h3 className="eyebrow mb-4">Upcoming events</h3>
            {events.loading ? (
              <StateBox kind="loading" />
            ) : events.error ? (
              <StateBox kind="error" message={events.error} onRetry={events.retry} />
            ) : !shownEvents.length ? (
              <StateBox kind="empty" message="No events have been published yet." />
            ) : (
              <ul className="space-y-3">
                {shownEvents.map((e) => {
                  const d = new Date(e.starts_at);
                  return (
                    <li key={e.id} className="surface reveal flex gap-4 p-4">
                      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-college-primary text-white" aria-hidden="true">
                        <span className="font-display text-xl font-bold leading-none">{d.getDate()}</span>
                        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/75">{d.toLocaleString('en-GB', { month: 'short' })}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-display font-bold leading-snug text-college-primary">{e.title}</p>
                        <p className="mt-0.5 text-sm text-[var(--text-2)]">{fmtDate(e.starts_at)}{e.location ? ` · ${e.location}` : ''}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link to="/news" className="link-arrow mt-6">All news and events <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
      </Section>

      {/* CTA */}
      {open && (
        <section className="bg-[var(--bg)] px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="reveal relative isolate mx-auto flex max-w-content flex-col items-start justify-between gap-6 overflow-hidden bg-college-primary px-6 py-10 text-white sm:flex-row sm:items-center sm:px-12 sm:py-14" style={{ borderRadius: 'var(--r-2xl)' }}>
            <div className="bg-grid-dark absolute inset-0 -z-10" aria-hidden="true" />
            <div className="absolute -right-16 -top-16 -z-10 h-64 w-64 rounded-full opacity-50 blur-3xl" style={{ background: 'rgb(var(--c-accent))' }} aria-hidden="true" />
            <div className="max-w-xl">
              <h2 className="font-display text-h2">Begin Your Academic Journey</h2>
              <p className="mt-3 text-white/80">Submit your application online. Our admissions office will review it and contact you.</p>
            </div>
            <Link to="/admissions/apply" className="btn btn-light shrink-0">Apply for Admission <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </section>
      )}
    </>
  );
}
