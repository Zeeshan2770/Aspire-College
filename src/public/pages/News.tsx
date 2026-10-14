import { useEffect, useState } from 'react';
import { loadOptions } from '@/services/options';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { EventItem, NewsItem, fetchEvents, fetchNews, fetchSiteImages } from '../api';
import { PhotoGallery } from '../PhotoGallery';
import { TextVideos } from '@/components/VideoEmbed';
import { useAsync } from '../useAsync';
import { PageHeader, Photo, Section, StateBox, fmtDate } from '../components';

const PAGE = 9;
const CATS = ['Announcement', 'Achievement', 'Academic', 'General'];

function NewsList() {
  const [cat, setCat] = useState('');
  const [cats, setCats] = useState<string[]>(CATS);
  useEffect(() => { loadOptions('news_category').then((o) => o.length && setCats(o.map((x) => x.label))).catch(() => {}); }, []);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(offset: number, replace: boolean) {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchNews(PAGE, offset, cat || undefined);
      setItems((p) => (replace ? rows : [...p, ...rows]));
      setMore(rows.length === PAGE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(0, true); /* eslint-disable-next-line */ }, [cat]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {['', ...cats].map((c) => (
          <button key={c || 'all'} onClick={() => setCat(c)} aria-pressed={cat === c} className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${cat === c ? 'border-transparent bg-college-primary text-white' : 'border-[#CBD5E4] bg-white text-[#41516B] hover:border-[#AEBBD0]'}`}>
            {c || 'All'}
          </button>
        ))}
      </div>
      {error ? <StateBox kind="error" message={error} onRetry={() => load(0, true)} /> : !items.length && !loading ? (
        <StateBox kind="empty" message="No news has been published yet." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((n) => (
            <Link key={n.id} to={`/news/${n.id}`} className="surface surface-hover reveal group flex flex-col overflow-hidden">
              <div className="overflow-hidden"><Photo src={n.image_url} alt="" className="aspect-[16/8] w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]" label="Image" /></div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-semibold uppercase tracking-[.1em] text-[rgb(var(--c-accent))]">{n.category}</p>
                <h3 className="mt-2 font-display text-lg font-bold leading-snug text-college-primary group-hover:underline underline-offset-4">{n.title}</h3>
                {n.summary && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--text-2)]">{n.summary}</p>}
                <p className="mt-auto pt-4 text-xs text-[var(--text-2)]">{fmtDate(n.published_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      {loading && <StateBox kind="loading" />}
      {more && !loading && <div className="mt-8 text-center"><button onClick={() => load(items.length, false)} className="btn btn-secondary">Load more</button></div>}
    </div>
  );
}

function EventRow({ e }: { e: EventItem }) {
  const [show, setShow] = useState(false);
  const photos = useAsync(() => (show ? fetchSiteImages('event', e.id) : Promise.resolve([])), [show, e.id]);
  const all = [...(e.image_url ? [{ url: e.image_url, caption: null }] : []), ...(photos.data ?? []).filter((p) => p.url !== e.image_url)];
  return (
    <li className="surface flex gap-4 p-5">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-college-primary text-white" aria-hidden="true">
        <span className="font-display text-xl font-bold leading-none">{new Date(e.starts_at).getDate()}</span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/75">{new Date(e.starts_at).toLocaleString('en-GB', { month: 'short' })}</span>
      </div>
      <div className="min-w-0">
        <p className="font-display font-bold text-college-primary">{e.title}</p>
        <p className="text-sm text-[var(--text-2)]">{fmtDate(e.starts_at)}{e.ends_at ? ` – ${fmtDate(e.ends_at)}` : ''}{e.location ? ` · ${e.location}` : ''}</p>
        {e.description && <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-2)]">{e.description}</p>}
        <TextVideos text={e.description} className="mt-3 max-w-xl" />
        <button type="button" aria-expanded={show} onClick={() => setShow((v) => !v)} className="mt-3 text-sm font-semibold text-college-primary underline-offset-4 hover:underline">{show ? 'Hide photographs & videos' : 'View photographs & videos'}</button>
        {show && <div className="mt-3">{photos.loading ? <StateBox kind="loading" /> : all.length ? <PhotoGallery images={all} /> : <p className="text-sm text-[var(--text-2)]">No photographs or videos have been added for this event.</p>}</div>}
      </div>
    </li>
  );
}

function Events() {
  const { data, loading, error, retry } = useAsync(fetchEvents);
  if (loading) return <StateBox kind="loading" />;
  if (error) return <StateBox kind="error" message={error} onRetry={retry} />;
  if (!data?.length) return <StateBox kind="empty" message="No events have been published yet." />;
  const today = new Date(new Date().toDateString()).getTime();
  const upcoming = data.filter((e) => +new Date(e.starts_at) >= today).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const past = data.filter((e) => +new Date(e.starts_at) < today);
  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (<div><h3 className="eyebrow mb-4">Upcoming</h3><ul className="space-y-3">{upcoming.map((e) => <EventRow key={e.id} e={e} />)}</ul></div>)}
      {past.length > 0 && (<div><h3 className="eyebrow mb-4">Past events</h3><ul className="space-y-3">{past.map((e) => <EventRow key={e.id} e={e} />)}</ul></div>)}
    </div>
  );
}

export default function News() {
  const [tab, setTab] = useState<'news' | 'events'>('news');
  return (
    <>
      <PageHeader title="News & Events" subtitle="Announcements and activities from the college." eyebrow="Stay informed" />
      <Section>
        <div className="mb-10 flex gap-8 border-b border-[var(--border)]" role="tablist">
          {(['news', 'events'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px min-h-[2.75rem] border-b-2 px-1 pb-3 text-[0.95rem] font-semibold transition-colors ${tab === t ? 'border-[rgb(var(--c-accent))] text-college-primary' : 'border-transparent text-[var(--text-2)] hover:text-college-primary'}`}>
              {t === 'news' ? 'News' : 'Events'}
            </button>
          ))}
        </div>
        {tab === 'news' ? <NewsList /> : <Events />}
      </Section>
    </>
  );
}
