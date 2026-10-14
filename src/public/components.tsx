import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ImageIcon, Inbox, AlertCircle } from 'lucide-react';
import { TBP } from './SiteProvider';

export function Placeholder({ label }: { label?: string }) {
  return <span className="inline-flex items-center rounded-full bg-[#EEF2F9] px-2.5 py-0.5 text-[0.8em] font-medium not-italic text-[#5B6B83]">{label ?? TBP}</span>;
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

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  parent,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  parent?: { label: string; to: string };
}) {
  return (
    <div className="relative isolate overflow-hidden bg-college-primary text-white">
      <div className="bg-grid-dark absolute inset-0 -z-10" aria-hidden="true" />
      <div className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: 'rgb(var(--c-accent) / .55)' }} aria-hidden="true" />
      <div className="mx-auto max-w-content px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-white/70">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link to="/" className="rounded hover:text-white hover:underline">Home</Link></li>
            {parent && (<><li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li><li><Link to={parent.to} className="rounded hover:text-white hover:underline">{parent.label}</Link></li></>)}
            <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
            <li aria-current="page" className="text-white">{title}</li>
          </ol>
        </nav>
        {eyebrow && <p className="eyebrow-light mb-3">{eyebrow}</p>}
        <h1 className="max-w-3xl font-display text-h1">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-lead text-white/80">{subtitle}</p>}
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
  intro,
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  muted?: boolean;
  id?: string;
  intro?: string;
}) {
  return (
    <section id={id} className={muted ? 'bg-[var(--bg)]' : 'bg-white'}>
      <div className="mx-auto max-w-content px-4 py-14 sm:px-6 sm:py-20">
        {(title || eyebrow) && (
          <div className="reveal mb-10 max-w-2xl">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2 className="mt-2 font-display text-h2 text-college-primary">{title}</h2>}
            {intro && <p className="mt-3 text-lead text-[var(--text-2)]">{intro}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function Photo({ src, alt, className = '', label = 'Photograph to be provided', priority = false }: { src?: string | null; alt: string; className?: string; label?: string; priority?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  if (src && !broken) {
    return <img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" {...(priority ? { fetchpriority: 'high' } : {})} onError={() => setBroken(true)} className={`object-cover ${className}`} />;
  }
  return (
    <div role="img" aria-label={label} className={`flex flex-col items-center justify-center gap-2 text-[var(--text-2)] ${className}`} style={{ background: 'linear-gradient(135deg, #E9EFFA, #DCE5F4)' }}>
      <ImageIcon className="h-5 w-5 opacity-50" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function StateBox({ kind, message, onRetry }: { kind: 'loading' | 'empty' | 'error'; message?: string; onRetry?: () => void }) {
  if (kind === 'loading') {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">{message ?? 'Loading…'}</span>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface overflow-hidden">
              <div className="skeleton aspect-[16/10] w-full rounded-none" />
              <div className="space-y-3 p-5">
                <div className="skeleton h-3 w-1/3" />
                <div className="skeleton h-5 w-4/5" />
                <div className="skeleton h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  const err = kind === 'error';
  return (
    <div className={`rounded-xl border px-5 py-12 text-center text-sm ${err ? 'border-red-200 bg-red-50 text-red-800' : 'border-dashed border-[#CBD5E4] bg-white/60 text-[var(--text-2)]'}`} role={err ? 'alert' : undefined}>
      {err ? <AlertCircle className="mx-auto mb-3 h-6 w-6" aria-hidden="true" /> : <Inbox className="mx-auto mb-3 h-6 w-6 opacity-60" aria-hidden="true" />}
      <p className="mx-auto max-w-md">{message}</p>
      {err && onRetry && (
        <button onClick={onRetry} className="btn btn-secondary btn-sm mt-4">Try again</button>
      )}
    </div>
  );
}

export const btnPrimary = 'btn btn-primary';
export const btnSecondary = 'btn btn-secondary';

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Renders a content block that is either free text or a bullet list of strings. */
export function Block({ value }: { value?: { text?: string; items?: unknown[] } }) {
  const items = (value?.items ?? []).filter((i): i is string => typeof i === 'string' && i.trim() !== '');
  if (items.length) {
    return (
      <ul className="list-disc space-y-2 pl-5 marker:text-college-accent">
        {items.map((i, n) => (
          <li key={n}>{i}</li>
        ))}
      </ul>
    );
  }
  return <Txt value={value?.text} multiline />;
}
