import { Link } from 'react-router-dom';
import { fetchAlbums } from '../api';
import { useAsync } from '../useAsync';
import { PageHeader, Photo, Section, StateBox, fmtDate } from '../components';

export default function Gallery() {
  const { data, loading, error, retry } = useAsync(fetchAlbums);
  return (
    <>
      <PageHeader title="Gallery" subtitle="Memories from events, activities and campus life." eyebrow="Campus life" />
      <Section>
        {loading ? <StateBox kind="loading" /> : error ? <StateBox kind="error" message={error} onRetry={retry} /> : !data?.length ? (
          <StateBox kind="empty" message="No photo albums have been published yet." />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((a) => (
              <Link key={a.id} to={`/gallery/${a.id}`} className="surface surface-hover reveal group block overflow-hidden">
                <div className="overflow-hidden"><Photo src={a.cover} alt="" className="aspect-[16/10] w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]" label="Photograph" /></div>
                <div className="p-4">
                  <h3 className="font-display font-bold text-college-primary">{a.title}</h3>
                  <p className="mt-1 text-xs text-[var(--text-2)]">{a.event_date ? `${fmtDate(a.event_date)} · ` : ''}{a.count} {a.count === 1 ? 'item' : 'items'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
