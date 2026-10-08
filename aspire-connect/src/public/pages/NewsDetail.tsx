import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchNewsItem, fetchSiteImages } from '../api';
import { PhotoGallery } from '../PhotoGallery';
import { useAsync } from '../useAsync';
import { Photo, StateBox, Txt, fmtDate } from '../components';

export default function NewsDetail() {
  const { id = '' } = useParams();
  const { data, loading, error, retry } = useAsync(() => fetchNewsItem(id), [id]);
  const photos = useAsync(() => fetchSiteImages('news', id), [id]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link to="/news" className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-college-primary hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All news and events</Link>
      {loading ? <StateBox kind="loading" /> : error ? <StateBox kind="error" message={error} onRetry={retry} /> : !data ? (
        <StateBox kind="empty" message="This article could not be found. It may have been removed." />
      ) : (
        <article>
          <p className="text-sm text-slate-500">{fmtDate(data.published_at)} · {data.category}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-college-primary">{data.title}</h1>
          {data.image_url && <Photo src={data.image_url} alt="" className="mt-6 aspect-[16/9] w-full rounded" />}
          <div className="mt-6 text-slate-700"><Txt value={data.body ?? data.summary} multiline /></div>
          {!!photos.data?.length && <div className="mt-10"><h2 className="mb-3 font-display text-xl font-semibold text-college-primary">Photographs</h2><PhotoGallery images={photos.data} /></div>}
        </article>
      )}
    </div>
  );
}
