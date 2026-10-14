import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { PublicImage } from './api';
import { Photo } from './components';
import { VideoEmbed } from '@/components/VideoEmbed';
import { isVideoUrl } from '@/lib/video';

/** Full-screen viewer: Esc closes, arrow keys move, focus returns to the thumbnail that opened it. */
function Lightbox({ images, start, onClose }: { images: PublicImage[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const closeRef = useRef<HTMLButtonElement>(null);
  const last = images.length - 1;
  const go = useCallback((d: number) => setI((n) => Math.min(last, Math.max(0, n + d))), [last]);

  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  const cur = images[i];
  if (!cur) return null;
  const nav = 'glass-dark absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white hover:bg-white/20 disabled:opacity-30';
  return (
    <div role="dialog" aria-modal="true" aria-label="Photograph viewer" className="fixed inset-0 z-50 flex flex-col bg-[rgb(var(--ink-950)/.94)]" style={{ animation: 'sheetIn var(--dur-2) var(--ease)' }} onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white">
        <span aria-live="polite">{i + 1} of {images.length}</span>
        <button ref={closeRef} onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-12" onClick={(e) => e.stopPropagation()}>
        <img src={cur.url} alt={cur.caption ?? `Photograph ${i + 1}`} className="max-h-full max-w-full object-contain" />
        <button className={`${nav} left-2`} aria-label="Previous photograph" disabled={i === 0} onClick={() => go(-1)}><ChevronLeft className="h-6 w-6" /></button>
        <button className={`${nav} right-2`} aria-label="Next photograph" disabled={i === last} onClick={() => go(1)}><ChevronRight className="h-6 w-6" /></button>
      </div>
      <p className="min-h-[3rem] px-4 py-3 text-center text-sm text-white/90">{cur.caption}</p>
    </div>
  );
}

/** A responsive grid of photographs; clicking one opens the viewer. */
export function PhotoGallery({ images: all }: { images: PublicImage[] }) {
  const images = all.filter((i) => !isVideoUrl(i.url));
  const videos = all.filter((i) => isVideoUrl(i.url));
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const close = useCallback(() => {
    setOpen(null);
    opener.current?.focus();
  }, []);
  if (!images.length && !videos.length) return null;
  return (
    <>
      {videos.length > 0 && (
        <div className={images.length ? 'mb-8' : ''}>
          {images.length > 0 && <h3 className="eyebrow mb-3">Videos</h3>}
          <ul className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((v, n) => (
              <li key={v.url}><VideoEmbed url={v.url} title={v.caption ?? `Video ${n + 1}`} />{v.caption && <p className="mt-1.5 text-xs text-[var(--text-2)]">{v.caption}</p>}</li>
            ))}
          </ul>
        </div>
      )}
      {images.length > 0 && videos.length > 0 && <h3 className="eyebrow mb-3">Photographs</h3>}
      {images.length > 0 && <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((im, n) => (
          <li key={im.url}>
            <button
              type="button"
              onClick={(e) => { opener.current = e.currentTarget; setOpen(n); }}
              aria-label={im.caption ? `Open photograph: ${im.caption}` : `Open photograph ${n + 1} of ${images.length}`}
              className="group block w-full overflow-hidden rounded-xl border border-[var(--border)] shadow-soft"
            >
              <Photo src={im.url} alt="" className="aspect-[5/3] w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]" label="Photograph" />
            </button>
            {im.caption && <p className="mt-1.5 text-xs text-[var(--text-2)]">{im.caption}</p>}
          </li>
        ))}
      </ul>}
      {open !== null && <Lightbox images={images} start={open} onClose={close} />}
    </>
  );
}
