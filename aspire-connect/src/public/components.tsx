import { ReactNode, useEffect, useState } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { TBP } from './SiteProvider';

export function Placeholder({ label }: { label?: string }) {
  return <span className="italic text-slate-400">{label ?? TBP}</span>;
}

/** Renders text, or a clearly marked placeholder when nothing has been provided. */
export function Txt({ value, multiline = false }: { value?: string | null; multiline?: boolean }) {
  if (!value?.trim()) return <Placeholder />;
  if (!multiline) return <>{value}</>;
  return (
    <>
      {value.split(/\n{2,}/).map((p, i) => (
        <p key={i} className={i ? 'mt-4' : ''}>
          {p}
        </p>
      ))}
    </>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-display text-3xl font-semibold text-college-primary sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-slate-600">{subtitle}</p>}
        <div className="mt-5 h-0.5 w-14 bg-college-accent" aria-hidden="true" />
      </div>
    </div>
  );
}

export function Section({
  title,
  eyebrow,
  children,
  muted = false,
  id,
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  muted?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={muted ? 'bg-slate-50' : 'bg-white'}>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {(title || eyebrow) && (
          <div className="mb-8">
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-widest text-college-accent">{eyebrow}</p>}
            {title && <h2 className="mt-1 font-display text-2xl font-semibold text-college-primary sm:text-3xl">{title}</h2>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function Photo({ src, alt, className = '', label = 'Photograph to be provided' }: { src?: string | null; alt: string; className?: string; label?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  if (src && !broken) {
    return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className={`object-cover ${className}`} />;
  }
  return (
    <div role="img" aria-label={label} className={`flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400 ${className}`}>
      <ImageIcon className="h-7 w-7" aria-hidden="true" />
      <span className="px-2 text-center text-xs">{label}</span>
    </div>
  );
}

export function StateBox({ kind, message, onRetry }: { kind: 'loading' | 'empty' | 'error'; message?: string; onRetry?: () => void }) {
  if (kind === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {message ?? 'Loading…'}
      </div>
    );
  }
  return (
    <div className={`rounded border px-4 py-10 text-center text-sm ${kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-dashed border-slate-300 text-slate-500'}`} role={kind === 'error' ? 'alert' : undefined}>
      <p>{message}</p>
      {kind === 'error' && onRetry && (
        <button onClick={onRetry} className="mt-3 rounded border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 hover:bg-red-50">
          Try again
        </button>
      )}
    </div>
  );
}

export const btnPrimary =
  'inline-flex whitespace-nowrap items-center justify-center rounded bg-college-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-college-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-college-accent focus-visible:ring-offset-2 disabled:opacity-60';
export const btnSecondary =
  'inline-flex whitespace-nowrap items-center justify-center rounded border border-college-primary px-5 py-2.5 text-sm font-semibold text-college-primary hover:bg-college-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-college-accent focus-visible:ring-offset-2';

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Renders a content block that is either free text or a bullet list of strings. */
export function Block({ value }: { value?: { text?: string; items?: unknown[] } }) {
  const items = (value?.items ?? []).filter((i): i is string => typeof i === 'string' && i.trim() !== '');
  if (items.length) {
    return (
      <ul className="list-disc space-y-1.5 pl-5">
        {items.map((i, n) => (
          <li key={n}>{i}</li>
        ))}
      </ul>
    );
  }
  return <Txt value={value?.text} multiline />;
}
