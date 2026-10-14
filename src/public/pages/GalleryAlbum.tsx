import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchAlbum } from '../api';
import { useAsync } from '../useAsync';
import { StateBox, Txt, fmtDate } from '../components';
import { useSeo } from '../seo';
import { PhotoGallery } from '../PhotoGallery';

export default function GalleryAlbum() {
  const { id = '' } = useParams();
  const { data, loading, error, retry } = useAsync(() => fetchAlbum(id), [id]);
  useSeo(data ? { title: `${data.album.title} | Gallery | Aspire Group of Colleges`, description: data.album.description || `Photos: ${data.album.title}, Aspire Group of Colleges, Taunsa Sharif.`, image: data.images[0]?.url } : null);
  return (
    <div className="mx-auto max-w-content px-4 py-10 sm:px-6 sm:py-16">
      <Link to="/gallery" className="link-arrow mb-8"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All albums</Link>
      {loading ? <StateBox kind="loading" /> : error ? <StateBox kind="error" message={error} onRetry={retry} /> : !data ? (
        <StateBox kind="empty" message="This album could not be found. It may have been removed." />
      ) : (
        <div>
          {data.album.event_date && <p className="eyebrow">{fmtDate(data.album.event_date)}</p>}
          <h1 className="mt-2 font-display text-h1 text-college-primary">{data.album.title}</h1>
          {data.album.description && <div className="prose-body mt-4"><Txt value={data.album.description} multiline /></div>}
          <div className="mt-8">{data.images.length ? <PhotoGallery images={data.images} /> : <StateBox kind="empty" message="This album has no photographs yet." />}</div>
        </div>
      )}
    </div>
  );
}
