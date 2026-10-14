import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ChevronDown, ClipboardCheck, GraduationCap, Landmark, LogIn, ShieldCheck } from 'lucide-react';
import { PORTAL_ROLES, PortalKey } from '@/lib/portalRoles';

const ICONS: Record<PortalKey, typeof ShieldCheck> = {
  'super-admin': ShieldCheck,
  administration: Briefcase,
  principal: Landmark,
  'teacher-cr': ClipboardCheck,
  student: GraduationCap,
};

/** Header dropdown: one entry per portal role. Keyboard: Enter/Space/ArrowDown open, arrows move, Esc closes. */
export default function PortalLoginMenu({ variant = 'default' }: { variant?: 'default' | 'island' }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const focusItem = (i: number) => items.current[(i + PORTAL_ROLES.length) % PORTAL_ROLES.length]?.focus();

  function onButtonKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setTimeout(() => focusItem(0), 0);
    }
  }

  function onMenuKey(e: KeyboardEvent) {
    const idx = items.current.findIndex((el) => el === document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(idx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(idx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(PORTAL_ROLES.length - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); button.current?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  }

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="portal-login-menu"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKey}
        className={variant === 'island' ? 'island-login' : 'btn btn-secondary btn-sm'}
      >
        {variant === 'island' ? (
          <span className="island-login-icon"><LogIn className="h-4 w-4" aria-hidden="true" /></span>
        ) : (
          <LogIn className="h-4 w-4" aria-hidden="true" />
        )}
        {variant === 'island' ? 'Login' : 'Portal Login'}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          id="portal-login-menu"
          role="menu"
          aria-label="Portal login by role"
          onKeyDown={onMenuKey}
          className={`absolute right-0 z-50 w-80 overflow-hidden border border-[var(--border)] bg-white shadow-pop ${variant === 'island' ? 'mt-3 rounded-3xl' : 'mt-2 rounded-xl'}`} style={{ animation: 'sheetIn var(--dur-2) var(--ease)' }}
        >
          <p className="border-b border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-2)]">Sign in as</p>
          <ul>
            {PORTAL_ROLES.map((p, i) => {
              const Icon = ICONS[p.key];
              return (
                <li key={p.key} role="none">
                  <Link
                    ref={(el) => { items.current[i] = el; }}
                    role="menuitem"
                    to={`/login?as=${p.key}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--soft-blue)] focus:bg-[var(--soft-blue)] focus:outline-none"
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--c-accent))]" aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-semibold text-college-primary">{p.label}</span>
                      <span className="block text-xs text-[var(--text-2)]">{p.blurb}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
