import { ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Link2, Play, Trash2 } from 'lucide-react';
import { parseVideo } from '@/lib/video';
import toast from 'react-hot-toast';
import { Button, Label, Spinner } from '@/components/ui';
import { MAX_PHOTOS, SiteImage, listSiteImages, uploadSiteImage, ImageOwner } from '@/services/website';

export const PAGE_SIZE = 15;

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export const textareaCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100';

export function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function ReadOnlyNote() {
  return <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">You have read-only access to this section.</p>;
}

export function NoAccess() {
  return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">You do not have permission to view this section. Please contact the Super Admin.</div>;
}

export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>Page {page} of {Math.ceil(total / PAGE_SIZE)} · {total} total</span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button size="sm" variant="secondary" disabled={page * PAGE_SIZE >= total} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

/** Image picker: shows the current image, uploads a new one to the site-media bucket. */
export function ImageField({ label, value, folder, onChange, disabled, hint }: {
  label: string; value: string | null; folder: string; onChange: (url: string | null) => void; disabled?: boolean; hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadSiteImage(file, folder));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return (
    <Field label={label} hint={hint ?? 'JPG, PNG or WebP, up to 2 MB.'}>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500">None</div>
        )}
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id={`img-${folder}-${label}`} disabled={disabled || busy} onChange={(e) => pick(e.target.files?.[0])} />
        <label htmlFor={`img-${folder}-${label}`} className={`cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${disabled || busy ? 'pointer-events-none opacity-50' : ''}`}>
          {busy ? <Spinner className="inline-block h-4 w-4" /> : value ? 'Replace' : 'Upload'}
        </label>
        {value && !disabled && <button type="button" className="text-sm text-slate-500 hover:text-red-600" onClick={() => onChange(null)}>Remove</button>}
      </div>
    </Field>
  );
}

/**
 * Several photographs for one item: pick many files at once, add a caption, reorder, remove.
 * `images` is the whole list; the parent saves it together with the item.
 */
export function MultiImageField({ label, images, onChange, folder, disabled, hint }: {
  label: string; images: SiteImage[]; onChange: (next: SiteImage[]) => void; folder: string; disabled?: boolean; hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const room = MAX_PHOTOS - images.length;

  function addVideo() {
    const u = videoUrl.trim();
    if (!parseVideo(u)) { setVideoErr('Paste the full video link (YouTube, Vimeo, Facebook, Instagram or TikTok). For TikTok, open the video and copy the address from the browser, not a short share link.'); return; }
    if (images.some((x) => x.url === u)) { setVideoErr('This video is already added.'); return; }
    if (room <= 0) { setVideoErr(`Up to ${MAX_PHOTOS} items are allowed.`); return; }
    onChange([...images, { url: u, caption: '' }]);
    setVideoUrl(''); setVideoErr(null);
  }

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    const chosen = Array.from(files).slice(0, Math.max(room, 0));
    if (files.length > chosen.length) toast.error(`Only ${MAX_PHOTOS} photographs are allowed. Extra files were skipped.`);
    const added: SiteImage[] = [];
    for (let i = 0; i < chosen.length; i++) {
      setBusy(`Uploading ${i + 1} of ${chosen.length}…`);
      try {
        added.push({ url: await uploadSiteImage(chosen[i], folder), caption: '' });
      } catch (e) {
        toast.error(`${chosen[i].name}: ${(e as Error).message}`);
      }
    }
    setBusy(null);
    if (ref.current) ref.current.value = '';
    if (added.length) onChange([...images, ...added]);
  }
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= images.length) return;
    const n = [...images];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };

  return (
    <Field label={label} hint={hint ?? `JPG, PNG or WebP, up to 2 MB each. Up to ${MAX_PHOTOS} photographs and videos in total; you can select several files at once.`}>
      {images.length > 0 && (
        <ul className="mb-3 grid gap-3 sm:grid-cols-2">
          {images.map((im, i) => (
            <li key={im.url} className="flex gap-3 rounded-xl border border-slate-200 p-2">
              {parseVideo(im.url) ? (
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-900 text-white">
                  {parseVideo(im.url)!.thumb && <img src={parseVideo(im.url)!.thumb!} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
                  <Play size={20} className="relative fill-current" aria-label="Video" />
                </div>
              ) : (
                <img src={im.url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <input aria-label={`Caption for photograph ${i + 1}`} placeholder="Caption (optional)" maxLength={200} disabled={disabled}
                  value={im.caption} onChange={(e) => onChange(images.map((x, k) => (k === i ? { ...x, caption: e.target.value } : x)))}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500" />
                {!disabled && (
                  <div className="mt-1.5 flex items-center gap-1 text-slate-500">
                    <button type="button" aria-label={`Move photograph ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button type="button" aria-label={`Move photograph ${i + 1} later`} disabled={i === images.length - 1} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"><ArrowDown size={14} /></button>
                    <button type="button" aria-label={`Remove photograph ${i + 1}`} onClick={() => onChange(images.filter((_, k) => k !== i))} className="rounded p-1 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    <span className="ml-auto text-xs text-slate-500">#{i + 1}</span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <input ref={ref} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" id={`imgs-${folder}-${label}`} disabled={disabled || !!busy || room <= 0} onChange={(e) => pick(e.target.files)} />
      <label htmlFor={`imgs-${folder}-${label}`} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${disabled || busy || room <= 0 ? 'pointer-events-none opacity-50' : ''}`}>
        {busy ? <><Spinner className="inline-block h-4 w-4" /> {busy}</> : <><ImagePlus size={16} /> {images.length ? 'Add more photographs' : 'Add photographs'}</>}
      </label>
      {!disabled && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-3">
          <label htmlFor={`vid-${folder}-${label}`} className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-2)]"><Link2 size={14} /> Add a video link</label>
          <div className="flex flex-wrap gap-2">
            <input id={`vid-${folder}-${label}`} value={videoUrl} onChange={(e) => { setVideoUrl(e.target.value); setVideoErr(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVideo(); } }}
              placeholder="https://www.youtube.com/watch?v=…" maxLength={500} aria-invalid={!!videoErr}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20" />
            <Button type="button" variant="secondary" size="sm" onClick={addVideo}>Add video</Button>
          </div>
          {videoErr ? <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">{videoErr}</p> : <p className="mt-1.5 text-xs text-slate-500">YouTube, Vimeo, Facebook, Instagram or TikTok. The video plays on the website; nothing is uploaded.</p>}
        </div>
      )}
    </Field>
  );
}

/** Loads the extra photographs of an item. `available` is false when the photo tables have not been created yet. */
export function useSiteImages(owner: ImageOwner, ownerId: string | null | undefined) {
  const [images, setImages] = useState<SiteImage[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>(ownerId ? 'loading' : 'ready');
  useEffect(() => {
    if (!ownerId) { setImages([]); setState('ready'); return; }
    let alive = true;
    setState('loading');
    listSiteImages(owner, ownerId).then((r) => { if (alive) { setImages(r); setState('ready'); } }).catch(() => { if (alive) setState('unavailable'); });
    return () => { alive = false; };
  }, [owner, ownerId]);
  return { images, setImages, state };
}
