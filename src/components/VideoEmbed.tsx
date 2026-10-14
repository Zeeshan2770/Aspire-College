import { useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { parseVideo } from '@/lib/video';

/**
 * A 16:9 video that loads the real player only after the visitor presses play,
 * so pages stay light on slow connections. Falls back to a plain link if the address is not a supported video.
 */
export function VideoEmbed({ url, title = 'Video', className = '' }: { url: string; title?: string; className?: string }) {
  const [playing, setPlaying] = useState(false);
  const v = parseVideo(url);
  if (!v) return <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4">Watch video <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>;
  // Size adapts to the screen: never wider than its column, never taller than ~70% of the window (so it cannot fill two screens),
  // and vertical videos (reels, TikToks) stay a sensible phone-like width.
  const style = {
    aspectRatio: String(v.ratio),
    width: `min(100%, calc(70vh * ${v.ratio.toFixed(4)}), ${v.ratio < 1 ? '22rem' : '48rem'})`,
  };
  return (
    <div style={style} className={`relative mx-auto overflow-hidden rounded-xl bg-[rgb(16_29_53)] shadow-card ${className}`}>
      {playing ? (
        <iframe src={v.embed} title={title} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label={`Play video: ${title}`} className="group absolute inset-0 flex h-full w-full items-center justify-center">
          {v.thumb ? (
            <img src={v.thumb} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          ) : (
            <span className="absolute inset-0" style={{ background: 'linear-gradient(145deg, rgb(var(--c-secondary)), rgb(var(--ink-950)))' }} aria-hidden="true" />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-black/10" aria-hidden="true" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-[rgb(16_29_53)] shadow-pop transition-transform duration-200 group-hover:scale-110">
            <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden="true" />
          </span>
          <span className="absolute bottom-2 right-3 text-[11px] font-semibold capitalize text-white/90">{v.provider}</span>
        </button>
      )}
    </div>
  );
}

/** Embeds for any video links found in a block of text. */
export function TextVideos({ text, className = '' }: { text?: string | null; className?: string }) {
  const urls = extractUrls(text);
  if (!urls.length) return null;
  return <div className={`grid items-start gap-3 ${urls.length > 1 ? 'sm:grid-cols-2' : ''} ${className}`}>{urls.map((u) => <VideoEmbed key={u} url={u} />)}</div>;
}
import { extractVideoUrls } from '@/lib/video';
const extractUrls = (t?: string | null) => extractVideoUrls(t);
