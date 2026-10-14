import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchNewsItem, fetchSiteImages } from '../api';
import { PhotoGallery } from '../PhotoGallery';
import { TextVideos } from '@/components/VideoEmbed';
import { useAsync } from '../useAsync';
import { useSeo } from '../seo';
import { Photo, StateBox, Txt, fmtDate } from '../components';

export default function NewsDetail() {
  const { id = '' } = useParams();
  const { data, loading, error, retry } = useAsync(() => fetchNewsItem(id), [id]);
  const photos = useAsync(() => fetchSiteImages('news', id), [id]);
  useSeo(
    data ? { title: `${data.title} | Aspire Group of Colleges`, description: data.summary || data.body || data.title, image: data.image_url, type: 'article' } : null,
    data ? { id: 'article', data: { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: data.title, ...(data.image_url ? { image: [data.image_url] } : {}), ...(data.published_at ? { datePublished: data.published_at } : {}), description: data.summary || undefined, publisher: { '@type': 'Organization', name: 'Aspire Group of Colleges, Taunsa Sharif' } } } : null,
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <Link to="/news" className="link-arrow mb-8"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All news and events</Link>
      {loading ? <StateBox kind="loading" /> : error ? <StateBox kind="error" message={error} onRetry={retry} /> : !data ? (
        <StateBox kind="empty" message="This article could not be found. It may have been removed." />
      ) : (
        <article>
          <p className="eyebrow">{data.category} <span className="text-[var(--text-2)]">· {fmtDate(data.published_at)}</span></p>
          <h1 className="mt-3 font-display text-h1 text-college-primary">{data.title}</h1>
          {data.image_url && <Photo src={data.image_url} alt="" className="mt-8 aspect-[16/9] w-full rounded-xl shadow-card" />}
          <div className="prose-body mt-8 max-w-none"><Txt value={data.body ?? data.summary} multiline /></div>
          <TextVideos text={data.body} className="mt-6" />
          {!!photos.data?.length && <div className="mt-10"><h2 className="mb-4 font-display text-h3 text-college-primary">Photographs &amp; videos</h2><PhotoGallery images={photos.data} /></div>}
        </article>
      )}
    </div>
  );
}
