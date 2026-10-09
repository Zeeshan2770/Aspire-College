import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';

interface CreditBoxProps {
  /** 'full' is the large card (Settings page, login page).
   *  'mini' is a compact version sized for tight spaces like a sidebar footer. */
  variant?: 'full' | 'mini';
  className?: string;
  /** Mini variant only: lets the person collapse it out of the way on small screens. Defaults on. */
  collapsible?: boolean;
}

const DEFAULT_CREDIT_TEXT = 'Muhammad Zeeshan Haider';

export function CreditBox({ variant = 'full', className = '', collapsible = true }: CreditBoxProps) {
  const settings = useSystemSettings();
  const [collapsed, setCollapsed] = useState(false);

  // Falls back to the original hard-coded signature until settings load
  // (or if credit_enabled/credit_text haven't been configured yet), so the
  // credit never silently disappears for a moment on first paint.
  if (settings && settings.credit_enabled === false) return null;
  const creditText = settings?.credit_text?.trim() || DEFAULT_CREDIT_TEXT;
  const logoUrl = settings?.credit_logo_url ?? null;

  if (variant === 'mini') {
    if (collapsed) {
      return (
        <button
          onClick={() => setCollapsed(false)}
          className={`flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-1.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-50 ${className}`}
        >
          <ChevronUp size={12} /> Credit
        </button>
      );
    }
    return (
      <div
        className={`relative rounded-xl border border-slate-200 bg-brand-900 px-3 py-2.5 text-center ${className}`}
      >

        {collapsible && (
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse credit"
            className="absolute right-1.5 top-1.5 rounded-md p-0.5 text-brand-300/70 hover:bg-white/10 hover:text-white"
          >
            <ChevronDown size={12} />
          </button>
        )}

        {logoUrl && <img src={logoUrl} alt="" className="relative mx-auto mb-1 h-5 w-5 rounded object-contain" />}
        <p className="relative text-[9px] font-bold uppercase tracking-[0.2em] text-brand-300">Developed By</p>
        <p className="relative mt-0.5 text-xs font-bold text-white">
          {creditText}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl border border-slate-200 bg-brand-900 p-6 text-center ${className}`}
    >

      {logoUrl && <img src={logoUrl} alt="" className="relative mx-auto mb-2 h-10 w-10 rounded-lg object-contain" />}
      <p className="relative text-[11px] font-bold uppercase tracking-[0.25em] text-brand-300">The Creator</p>
      <p className="relative mt-2 text-lg font-extrabold text-white">{creditText}</p>

      <p className="relative mt-2 text-sm font-semibold uppercase tracking-wide text-brand-200">
        Engineering Ideas Into Impact
      </p>

      <p className="relative mt-1 text-sm italic text-slate-300">&ldquo;Turning Ideas into Digital Solutions.&rdquo;</p>
    </div>
  );
}
