import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchAlbum } from '../api';
import { useAsync } from '../useAsync';
import { StateBox, Txt, fmtDate } from '../components';
import { PhotoGallery } from '../PhotoGallery';

export default function GalleryAlbum() {
  const { id = '' } = useParams();
  const { data, loading, error, retry } = useAsync(() => fetchAlbum(id), [id]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link to="/gallery" className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-college-primary hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All albums</Link>
      {loading ? <StateBox kind="loading" /> : error ? <StateBox kind="error" message={error} onRetry={retry} /> : !data ? (
        <StateBox kind="empty" message="This album could not be found. It may have been removed." />
      ) : (
        <div>
          {data.album.event_date && <p className="text-sm text-slate-500">{fmtDate(data.album.event_date)}</p>}
          <h1 className="mt-1 font-display text-3xl font-semibold text-college-primary">{data.album.title}</h1>
          {data.album.description && <div className="mt-3 max-w-3xl text-slate-700"><Txt value={data.album.description} multiline /></div>}
          <div className="mt-8">{data.images.length ? <PhotoGallery images={data.images} /> : <StateBox kind="empty" message="This album has no photographs yet." />}</div>
        </div>
      )}
    </div>
  );
}
