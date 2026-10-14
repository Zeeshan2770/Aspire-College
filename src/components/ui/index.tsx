import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, useEffect } from 'react';
import clsx from 'clsx';

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants = {
    primary: 'bg-brand-600 text-white shadow-soft hover:bg-brand-700 hover:shadow-card',
    secondary: 'border border-[#CBD5E4] bg-white text-ink-800 hover:border-[#AEBBD0] hover:bg-[#F8FAFE]',
    ghost: 'bg-transparent text-[#41516B] hover:bg-[#EEF2F9]',
    danger: 'bg-[#C43D4B] text-white shadow-soft hover:bg-[#A8303D]',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-base' };
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div className={clsx('rounded-2xl border border-[var(--border)] bg-white shadow-card', className)} onClick={onClick}>
      {children}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'w-full rounded-full border border-[#CBD5E4] bg-white px-4 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-[#8A98AE] hover:border-[#AEBBD0] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-[#F1F4F9] disabled:text-[#8A98AE]',
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={clsx(
        'w-full rounded-full border border-[#CBD5E4] bg-white px-4 py-2.5 text-sm text-ink-900 outline-none transition hover:border-[#AEBBD0] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-[#F1F4F9]',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-xs font-semibold tracking-wide text-[var(--text-2)]">{children}</label>;
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue';
}) {
  const tones = {
    slate: 'bg-[#EEF2F9] text-[#41516B]',
    green: 'bg-[#E3F4EC] text-[#106B4A]',
    red: 'bg-[#FBE9EB] text-[#A8303D]',
    amber: 'bg-[#FBF1DC] text-[#8F5E12]',
    blue: 'bg-brand-50 text-brand-700',
  };
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none', tones[tone])}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 backdrop-blur-sm animate-fadeIn sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={clsx('max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-pop sm:max-h-[90dvh] sm:rounded-3xl sm:p-6', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between gap-2 bg-white px-4 py-3 sm:static sm:mx-0 sm:mt-0 sm:p-0">
          <h3 className="min-w-0 break-words font-display text-lg font-bold text-ink-900">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[#EEF2F9] hover:text-ink-900">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'h-5 w-5 animate-spin rounded-full border-2 border-[#DCE4F0] border-t-brand-600',
        className
      )}
    />
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: 'brand' | 'green' | 'red' | 'amber';
}) {
  const tones = {
    brand: 'bg-brand-600',
    green: 'bg-[#16845B]',
    red: 'bg-[#C43D4B]',
    amber: 'bg-[#B7791F]',
  };
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-[var(--text-2)]">{label}</p>
          <p className="mt-1 font-display text-[1.75rem] font-extrabold tabular-nums leading-tight text-ink-900">{value}</p>
        </div>
        <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-soft', tones[tone])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

/** Consistent page title block for portal screens: title, optional description, optional actions. */
export function PageHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-[var(--text-2)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small uppercase-free label that groups related stat cards. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-8 font-display text-sm font-bold tracking-wide text-[var(--text-2)]">{children}</h2>;
}

/** Placeholder blocks shown while a dashboard loads, so the layout does not jump. */
export function StatSkeletons({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading dashboard" className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-card">
          <div className="skeleton h-3 w-1/2" />
          <div className="skeleton mt-3 h-7 w-1/3" />
        </div>
      ))}
    </div>
  );
}
