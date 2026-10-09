import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { PublicImage } from './api';
import { Photo } from './components';

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
  const nav = 'absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-30';
  return (
    <div role="dialog" aria-modal="true" aria-label="Photograph viewer" className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white">
        <span aria-live="polite">{i + 1} of {images.length}</span>
        <button ref={closeRef} onClick={onClose} aria-label="Close" className="rounded p-1.5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"><X className="h-5 w-5" /></button>
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
export function PhotoGallery({ images }: { images: PublicImage[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const close = useCallback(() => {
    setOpen(null);
    opener.current?.focus();
  }, []);
  if (!images.length) return null;
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((im, n) => (
          <li key={im.url}>
            <button
              type="button"
              onClick={(e) => { opener.current = e.currentTarget; setOpen(n); }}
              aria-label={im.caption ? `Open photograph: ${im.caption}` : `Open photograph ${n + 1} of ${images.length}`}
              className="block w-full overflow-hidden rounded border border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-college-accent"
            >
              <Photo src={im.url} alt="" className="aspect-[4/3] w-full transition hover:opacity-90" label="Photograph" />
            </button>
            {im.caption && <p className="mt-1 text-xs text-slate-600">{im.caption}</p>}
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox images={images} start={open} onClose={close} />}
    </>
  );
}
