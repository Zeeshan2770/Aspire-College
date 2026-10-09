import { useEffect, useState } from 'react';
import { loadOptions } from '@/services/options';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { EventItem, NewsItem, fetchEvents, fetchNews, fetchSiteImages } from '../api';
import { PhotoGallery } from '../PhotoGallery';
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
          <button key={c || 'all'} onClick={() => setCat(c)} aria-pressed={cat === c} className={`rounded border px-3 py-1.5 text-sm ${cat === c ? 'border-college-primary bg-college-primary text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            {c || 'All'}
          </button>
        ))}
      </div>
      {error ? <StateBox kind="error" message={error} onRetry={() => load(0, true)} /> : !items.length && !loading ? (
        <StateBox kind="empty" message="No news has been published yet." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((n) => (
            <Link key={n.id} to={`/news/${n.id}`} className="group block overflow-hidden rounded border border-slate-200 hover:border-slate-300">
              <Photo src={n.image_url} alt="" className="aspect-[16/9] w-full" label="Image" />
              <div className="p-4">
                <p className="text-xs text-slate-500">{fmtDate(n.published_at)} · {n.category}</p>
                <h3 className="mt-1 font-medium text-college-primary group-hover:underline">{n.title}</h3>
                {n.summary && <p className="mt-1 line-clamp-3 text-sm text-slate-600">{n.summary}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
      {loading && <StateBox kind="loading" />}
      {more && !loading && <div className="mt-8 text-center"><button onClick={() => load(items.length, false)} className="rounded border border-college-primary px-5 py-2 text-sm font-semibold text-college-primary hover:bg-college-primary/5">Load more</button></div>}
    </div>
  );
}

function EventRow({ e }: { e: EventItem }) {
  const [show, setShow] = useState(false);
  const photos = useAsync(() => (show ? fetchSiteImages('event', e.id) : Promise.resolve([])), [show, e.id]);
  const all = [...(e.image_url ? [{ url: e.image_url, caption: null }] : []), ...(photos.data ?? []).filter((p) => p.url !== e.image_url)];
  return (
    <li className="flex gap-4 rounded border border-slate-200 p-4">
      <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-college-accent" aria-hidden="true" />
      <div>
        <p className="font-medium text-college-primary">{e.title}</p>
        <p className="text-sm text-slate-500">{fmtDate(e.starts_at)}{e.ends_at ? ` – ${fmtDate(e.ends_at)}` : ''}{e.location ? ` · ${e.location}` : ''}</p>
        {e.description && <p className="mt-1 text-sm text-slate-600">{e.description}</p>}
        <button type="button" aria-expanded={show} onClick={() => setShow((v) => !v)} className="mt-2 text-sm font-medium text-college-primary hover:underline">{show ? 'Hide photographs' : 'View photographs'}</button>
        {show && <div className="mt-3">{photos.loading ? <StateBox kind="loading" /> : all.length ? <PhotoGallery images={all} /> : <p className="text-sm text-slate-500">No photographs have been added for this event.</p>}</div>}
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
      {upcoming.length > 0 && (<div><h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Upcoming</h3><ul className="space-y-3">{upcoming.map((e) => <EventRow key={e.id} e={e} />)}</ul></div>)}
      {past.length > 0 && (<div><h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Past events</h3><ul className="space-y-3">{past.map((e) => <EventRow key={e.id} e={e} />)}</ul></div>)}
    </div>
  );
}

export default function News() {
  const [tab, setTab] = useState<'news' | 'events'>('news');
  return (
    <>
      <PageHeader title="News & Events" subtitle="Announcements and activities from the college." />
      <Section>
        <div className="mb-8 flex gap-6 border-b border-slate-200" role="tablist">
          {(['news', 'events'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-1 pb-3 text-sm font-semibold ${tab === t ? 'border-college-accent text-college-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t === 'news' ? 'News' : 'Events'}
            </button>
          ))}
        </div>
        {tab === 'news' ? <NewsList /> : <Events />}
      </Section>
    </>
  );
}
