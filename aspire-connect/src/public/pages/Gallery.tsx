import { Link } from 'react-router-dom';
import { fetchAlbums } from '../api';
import { useAsync } from '../useAsync';
import { PageHeader, Photo, Section, StateBox, fmtDate } from '../components';

export default function Gallery() {
  const { data, loading, error, retry } = useAsync(fetchAlbums);
  return (
    <>
      <PageHeader title="Gallery" subtitle="Memories from events, activities and campus life." />
      <Section>
        {loading ? <StateBox kind="loading" /> : error ? <StateBox kind="error" message={error} onRetry={retry} /> : !data?.length ? (
          <StateBox kind="empty" message="No photo albums have been published yet." />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((a) => (
              <Link key={a.id} to={`/gallery/${a.id}`} className="group block overflow-hidden rounded border border-slate-200 hover:border-slate-300">
                <Photo src={a.cover} alt="" className="aspect-[4/3] w-full" label="Photograph" />
                <div className="p-4">
                  <h3 className="font-medium text-college-primary group-hover:underline">{a.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{a.event_date ? `${fmtDate(a.event_date)} · ` : ''}{a.count} {a.count === 1 ? 'photograph' : 'photographs'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
