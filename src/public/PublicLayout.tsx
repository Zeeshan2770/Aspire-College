import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronDown, Home as HomeIcon, Facebook, Instagram, Mail, Menu, Phone, X, Youtube, GraduationCap, MapPin, MessageCircle, Code2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SiteProvider, useSite } from './SiteProvider';
import { Placeholder, StateBox } from './components';
import { useReveal } from './useReveal';
import { PAGES, applySeo, setJsonLd } from './seo';
import { MyTracking, clearTracking, readTracking } from './myTracking';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PortalLoginMenu from './PortalLoginMenu';
import { PORTAL_ROLES, portalHomeForRole } from '@/lib/portalRoles';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/academics', label: 'Academics' },
  { to: '/faculty', label: 'Faculty' },
  { to: '/admissions', label: 'Admissions' },
  { to: '/student-life', label: 'Student Life' },
  { to: '/news', label: 'News & Events' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/ask', label: 'Ask Us' },
  { to: '/contact', label: 'Contact' },
];

const MAIN_NAV = NAV.filter((n) => ['/about', '/academics', '/faculty', '/admissions', '/student-life', '/news', '/ask', '/contact'].includes(n.to));
const MORE_NAV = NAV.filter((n) => ['/gallery'].includes(n.to));

/** "More" dropdown for the less-frequent pages. Keyboard: Enter/Space/ArrowDown open, arrows move, Esc closes. */
function MoreMenu({ items, pathname, wrapRef }: { items: typeof NAV; pathname: string; wrapRef?: (el: HTMLDivElement | null) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const active = items.some((i) => pathname === i.to || pathname.startsWith(i.to + '/'));

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const links = () => Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  function onKey(e: React.KeyboardEvent) {
    const els = links();
    const i = els.findIndex((el) => el === document.activeElement);
    if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) { setOpen(true); setTimeout(() => links()[0]?.focus(), 0); } else els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Tab' && open && e.target !== btn.current) setOpen(false);
  }

  return (
    <div ref={(el) => { wrap.current = el; wrapRef?.(el); }} className="relative" onKeyDown={onKey}>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`island-link ${active ? 'is-active' : ''}`}
      >
        More <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul role="menu" aria-label="More pages" className="absolute left-1/2 top-full z-50 mt-4 w-52 -translate-x-1/2 overflow-hidden rounded-3xl border border-[var(--border)] bg-white p-2 shadow-pop" style={{ animation: 'sheetIn var(--dur-2) var(--ease)' }}>
          {items.map((n) => (
            <li key={n.to} role="none">
              <Link to={n.to} role="menuitem" className="block rounded-full px-4 py-2.5 text-sm font-semibold text-college-primary transition-colors hover:bg-[var(--soft-blue)] focus:bg-[var(--soft-blue)] focus:outline-none">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Logo({ large = false, island = false }: { large?: boolean; island?: boolean }) {
  const { settings } = useSite();
  if (island) {
    return (
      <span className="island-logo" aria-hidden={settings?.logo_url ? undefined : true}>
        {settings?.logo_url ? (
          <img src={settings.logo_url} alt={`${settings.college_name} logo`} className="h-full w-full object-contain p-1.5" />
        ) : (
          <GraduationCap className="h-5 w-5 text-[rgb(var(--ink-950))]" />
        )}
      </span>
    );
  }
  if (settings?.logo_url) {
    return <img src={settings.logo_url} alt={`${settings.college_name} logo`} className={large ? 'h-14 w-auto' : 'h-11 w-auto'} />;
  }
  return (
    <span className={`flex items-center justify-center rounded-lg bg-college-primary text-white shadow-soft ${large ? 'h-12 w-12' : 'h-10 w-10'}`} aria-hidden="true">
      <GraduationCap className="h-5 w-5" />
    </span>
  );
}

/** Desktop nav pills with one shared sliding highlight (active = solid, hover = soft). */
function IslandNav({ pathname }: { pathname: string }) {
  const nav = useRef<HTMLElement>(null);
  const els = useRef<Record<string, HTMLElement | null>>({});
  const [hover, setHover] = useState<string | null>(null);
  const [box, setBox] = useState<Record<'active' | 'hover', { x: number; w: number } | null>>({ active: null, hover: null });

  const match = (to: string, end?: boolean) => (end ? pathname === to : pathname === to || pathname.startsWith(to + '/'));
  const activeKey = pathname === '/' || pathname === '/home' ? '/' : MAIN_NAV.find((n) => match(n.to, n.end))?.to ?? (MORE_NAV.some((n) => match(n.to)) ? 'more' : null);

  useLayoutEffect(() => {
    const measure = (k: string | null) => {
      const el = k ? els.current[k] : null;
      return el ? { x: el.offsetLeft, w: el.offsetWidth } : null;
    };
    const run = () => setBox({ active: measure(activeKey), hover: measure(hover) });
    run();
    window.addEventListener('resize', run);
    document.fonts?.ready.then(run).catch(() => {});
    return () => window.removeEventListener('resize', run);
  }, [activeKey, hover]);

  const hoverProps = (k: string) => ({ onMouseEnter: () => setHover(k), onFocus: () => setHover(k) });
  const slot = (b: { x: number; w: number } | null) => ({ transform: `translateX(${b?.x ?? 0}px)`, width: b?.w ?? 0, opacity: b ? 1 : 0 });

  return (
    <nav ref={nav} aria-label="Main" className="relative hidden items-center gap-0.5 xl:flex" onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)}>
      <span className="island-hover" style={slot(box.hover)} aria-hidden="true" />
      <span className="island-active" style={slot(box.active)} aria-hidden="true" />
      <NavLink to="/" end aria-label="Home" ref={(el) => { els.current['/'] = el; }} {...hoverProps('/')} className={({ isActive }) => `island-link !px-3 ${isActive || pathname === '/home' ? 'is-active' : ''}`}>
        <HomeIcon className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
      </NavLink>
      {MAIN_NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} ref={(el) => { els.current[n.to] = el; }} {...hoverProps(n.to)} className={({ isActive }) => `island-link ${isActive ? 'is-active' : ''}`}>
          {n.label}
        </NavLink>
      ))}
      <div {...hoverProps('more')} ref={(el) => { els.current.more = el; }} className="relative">
        <MoreMenu items={MORE_NAV} pathname={pathname} />
      </div>
    </nav>
  );
}

function Header() {
  const { settings } = useSite();
  const { session, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const menuBtn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const hasBar = !!(settings?.phone || settings?.email);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheet.current?.querySelector<HTMLElement>('a')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); menuBtn.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <header className={`sticky top-0 z-40 ${hasBar ? 'sm:-top-9' : ''}`}>
      {hasBar && (
        <div className="hidden h-9 bg-[rgb(var(--ink-950))] text-xs text-white/85 sm:block">
          <div className="mx-auto flex h-full max-w-content items-center justify-between px-6">
            <span className="flex items-center gap-5">
              {settings?.phone && (
                <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 hover:text-white hover:underline">
                  <Phone className="h-3 w-3" aria-hidden="true" /> {settings.phone}
                </a>
              )}
              {settings?.email && (
                <a href={`mailto:${settings.email}`} className="flex items-center gap-1.5 hover:text-white hover:underline">
                  <Mail className="h-3 w-3" aria-hidden="true" /> {settings.email}
                </a>
              )}
            </span>
            <Link to="/admissions/status" className="hover:text-white hover:underline">Check application status</Link>
          </div>
        </div>
      )}

      {/* The "island": a floating dark capsule that tightens when the page scrolls. */}
      <div className={`pointer-events-none px-3 pt-3 transition-colors duration-300 sm:px-6 ${scrolled ? 'pb-0 bg-transparent' : 'pb-3 bg-college-primary'}`}>
        <div className={`island pointer-events-auto relative mx-auto flex max-w-[76rem] items-center justify-between gap-3 2xl:max-w-[86rem] ${scrolled ? 'is-scrolled' : ''}`}>
          <Link to="/" className="flex min-w-0 shrink-0 items-center gap-3 rounded-full pr-2" aria-label={`${settings?.college_name ?? 'Aspire Group of Colleges'} home`}>
            <Logo island />
            <span className="min-w-0 leading-tight xl:hidden 2xl:block">
              <span className="block truncate font-display text-[0.95rem] font-bold tracking-tight text-white">{settings?.college_name ?? 'Aspire Group of Colleges'}</span>
              <span className="block text-[0.7rem] text-white/70">{settings?.campus_name ?? 'Taunsa Sharif'}</span>
            </span>
          </Link>

          <IslandNav pathname={pathname} />

          <div className="hidden shrink-0 items-center gap-2 xl:flex">
            {session && profile ? (
              <Link to={portalHomeForRole(profile.role)} className="island-login">Open Portal</Link>
            ) : (
              <PortalLoginMenu variant="island" />
            )}
            {settings?.admissions_open !== false && (
              <Link to="/admissions/apply" className="island-apply">
                Apply Now
                <span className="island-apply-icon"><ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
              </Link>
            )}
          </div>

          <button
            ref={menuBtn}
            type="button"
            className="island-menu-btn xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          ref={sheet}
          aria-label="Mobile"
          className="absolute inset-x-3 top-full mt-2 max-h-[calc(100dvh-6.5rem)] overflow-y-auto overscroll-contain rounded-[2rem] border border-white/10 bg-[var(--island-2)] text-white shadow-pop sm:inset-x-6 xl:hidden"
          style={{ animation: 'sheetIn var(--dur-2) var(--ease)' }}
        >
          <div className="mx-auto flex max-w-[76rem] flex-col p-3">
            <div className="grid grid-cols-2 gap-2">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex min-h-[3rem] items-center justify-center rounded-full px-4 text-[0.95rem] font-semibold transition-colors ${isActive ? 'bg-white text-[rgb(var(--ink-950))]' : 'bg-white/[.07] text-white/90 hover:bg-white/15'}`}>
                  {n.label}
                </NavLink>
              ))}
            </div>
            <div className="flex flex-col gap-3 pt-4">
              {settings?.admissions_open !== false && (
                <Link to="/admissions/apply" className="island-apply justify-center !min-h-[3rem]">Apply for Admission <span className="island-apply-icon"><ArrowRight className="h-4 w-4" aria-hidden="true" /></span></Link>
              )}
              {session && profile ? (
                <Link to={portalHomeForRole(profile.role)} className="island-login justify-center !min-h-[3rem]">Open Portal</Link>
              ) : (
                <div className="overflow-hidden rounded-3xl bg-white text-[var(--text)]">
                  <p className="border-b border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-2)]">Portal login</p>
                  <ul>
                    {PORTAL_ROLES.map((p) => (
                      <li key={p.key} className="border-b border-[var(--border)] last:border-0">
                        <Link to={`/login?as=${p.key}`} className="block px-4 py-3 text-sm font-semibold text-college-primary">
                          {p.label}
                          <span className="block text-xs font-normal text-[var(--text-2)]">{p.blurb}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}


function Footer() {
  const { settings } = useSite();
  const year = new Date().getFullYear();
  const social = [
    { href: settings?.facebook_url, label: 'Facebook', Icon: Facebook },
    { href: settings?.instagram_url, label: 'Instagram', Icon: Instagram },
    { href: settings?.youtube_url, label: 'YouTube', Icon: Youtube },
  ].filter((s) => s.href);
  const fl = 'rounded text-white/70 transition-colors hover:text-white hover:underline underline-offset-4';

  return (
    <footer className="relative isolate overflow-hidden bg-[rgb(var(--ink-950))] text-white/75">
      <div className="absolute -bottom-40 -left-24 -z-10 h-96 w-96 rounded-full opacity-25 blur-3xl" style={{ background: 'rgb(var(--c-accent))' }} aria-hidden="true" />
      <div className="mx-auto grid max-w-content gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.3fr_1fr_1.1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Logo large />
            <div className="leading-tight">
              <p className="font-display text-lg font-bold text-white">{settings?.college_name ?? 'Aspire Group of Colleges'}</p>
              <p className="text-sm text-white/60">{settings?.campus_name ?? 'Taunsa Sharif'}</p>
            </div>
          </div>
          {settings?.footer_text && <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/65">{settings.footer_text}</p>}
          {settings?.admissions_open !== false && (
            <Link to="/admissions/apply" className="btn btn-light btn-sm mt-6">Apply Online <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          )}
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[.14em] text-white">Explore</h2>
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {NAV.slice(1).map((n) => (
              <li key={n.to}><Link to={n.to} className={fl}>{n.label}</Link></li>
            ))}
            <li><Link to="/admissions/status" className={fl}>Application Status</Link></li>
            <li><Link to="/login" className={fl}>Portal Login</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[.14em] text-white">Contact</h2>
          <ul className="mt-5 space-y-3.5 text-sm">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#9DBBFF]" aria-hidden="true" />
              {settings?.address ? settings.address : <Placeholder label="Address coming soon" />}
            </li>
            <li className="flex gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#9DBBFF]" aria-hidden="true" />
              {settings?.phone ? <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className={fl}>{settings.phone}</a> : <Placeholder label="Phone coming soon" />}
            </li>
            <li className="flex gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#9DBBFF]" aria-hidden="true" />
              {settings?.email ? <a href={`mailto:${settings.email}`} className={fl}>{settings.email}</a> : <Placeholder label="Email coming soon" />}
            </li>
          </ul>
          {social.length > 0 && (
            <div className="mt-6 flex gap-2.5">
              {social.map(({ href, label, Icon }) => (
                <a key={label} href={href!} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white/75 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-content flex-col items-start justify-between gap-4 px-4 py-6 sm:px-6 sm:pr-64 md:flex-row md:items-center">
          <p className="text-xs text-white/50">
            © {year} {settings?.college_name ?? 'Aspire Group of Colleges'}, {settings?.campus_name ?? 'Taunsa Sharif'}. All rights reserved.
          </p>
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-[#9DBBFF]" aria-hidden="true"><Code2 className="h-4 w-4" /></span>
            <span className="leading-tight">
              <span className="block whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[.18em] text-white/50">Created by</span>
              <span className="block text-sm font-bold text-white">Zeeshan</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Turns a phone number as typed (0300 1234567, +92 300 1234567, ...) into digits for wa.me. Pakistan is assumed for a leading 0. */
function waNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '92' + d.slice(1);
  return d.length >= 11 && d.length <= 15 ? d : null;
}

/** Floating "chat on WhatsApp" button, bottom-right on every public page. Uses the phone number from Website Settings. */
function WhatsAppButton() {
  const { settings } = useSite();
  const num = waNumber(settings?.phone);
  if (!num) return null;
  const text = encodeURIComponent(`Assalam o Alaikum, I would like to know more about ${settings?.college_name ?? 'Aspire Group of Colleges'}.`);
  return (
    <a
      href={`https://wa.me/${num}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="group fixed bottom-5 right-4 z-40 flex items-center gap-2 rounded-full bg-[#25D366] p-3.5 text-white shadow-pop transition-transform duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366] sm:right-6 sm:px-5"
      style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      <MessageCircle className="h-6 w-6" aria-hidden="true" />
      <span className="hidden text-sm font-semibold sm:inline">Chat on WhatsApp</span>
    </a>
  );
}

const TITLES: [string, string][] = [
  ['/admissions/apply', 'Apply for Admission'],
  ['/admissions/status', 'Check Application Status'],
  ['/ask/track', 'Check Your Answer'],
  ['/admissions', 'Admissions'],
  ['/about', 'About'],
  ['/academics', 'Academics'],
  ['/faculty', 'Faculty'],
  ['/student-life', 'Student Life'],
  ['/news', 'News & Events'],
  ['/gallery', 'Gallery'],
  ['/ask', 'Ask Us'],
  ['/contact', 'Contact'],
];

function TrackingBanner() {
  const [t, setT] = useState<MyTracking>({});
  useEffect(() => { setT(readTracking()); }, []); // remounted on each page change (see key in Shell)
  if (!t.app && !t.q) return null;
  const item = (kind: 'app' | 'q', label: string, value: string, to: string, cta: string) => (
    <span key={kind} className="flex flex-wrap items-center gap-x-2">
      <span>{label} <strong className="font-semibold tabular-nums">{value}</strong></span>
      <Link to={to} className="font-semibold underline underline-offset-4 hover:no-underline">{cta}</Link>
      <button type="button" aria-label={`Hide reminder for ${value}`} onClick={() => { clearTracking(kind); setT(readTracking()); }} className="flex h-6 w-6 items-center justify-center rounded hover:bg-black/10"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
    </span>
  );
  return (
    <div role="region" aria-label="Your submissions" className="bg-[var(--soft-blue)] text-sm text-college-primary">
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-8 gap-y-1 px-4 py-2 sm:px-6">
        {t.app && item('app', 'Your application', t.app, `/admissions/status?no=${encodeURIComponent(t.app)}`, 'Check decision')}
        {t.q && item('q', 'Your question', t.q, `/ask/track?code=${encodeURIComponent(t.q)}`, 'Check reply')}
      </div>
    </div>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const { settings } = useSite();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    if (!settings) return;
    const base = settings.website_title || `${settings.college_name}, ${settings.campus_name}`;
    const hit = TITLES.find(([p]) => pathname === p || pathname.startsWith(p + '/'));
    const title = hit ? `${hit[1]} | ${settings.college_name}` : base;
    const detail = /^\/(news|gallery)\/[^/]+/.test(pathname); // the article/album page sets its own tags once loaded
    const desc = PAGES[pathname === '/home' ? '/' : pathname] || PAGES[hit?.[0] ?? ''] || settings.tagline || PAGES['/'];
    document.title = title;
    if (!detail) applySeo({ title, description: desc, image: settings.hero_image_url || settings.logo_url });
  }, [pathname, settings]);
  // Organization details for Google (name, contact, social profiles), taken from the site settings.
  useEffect(() => {
    if (!settings) return;
    const sameAs = [settings.facebook_url, settings.instagram_url, settings.youtube_url].filter(Boolean);
    setJsonLd('org', {
      '@context': 'https://schema.org',
      '@type': 'CollegeOrUniversity',
      name: `${settings.college_name}, ${settings.campus_name}`,
      url: window.location.origin,
      ...(settings.logo_url ? { logo: settings.logo_url, image: settings.hero_image_url || settings.logo_url } : {}),
      ...(settings.tagline ? { description: settings.tagline } : {}),
      ...(settings.phone ? { telephone: settings.phone } : {}),
      ...(settings.email ? { email: settings.email } : {}),
      address: { '@type': 'PostalAddress', streetAddress: settings.address || undefined, addressLocality: 'Taunsa Sharif', addressCountry: 'PK' },
      ...(sameAs.length ? { sameAs } : {}),
    });
  }, [settings]);
  // Search engines: one canonical address per page, and keep personal tracking pages out of results.
  useEffect(() => {
    const url = window.location.origin + (pathname === '/' || pathname === '/home' ? '/' : pathname.replace(/\/+$/, '')); // /home is the same page as /, so it points search engines at /
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = url;
    const priv = pathname === '/admissions/status' || pathname === '/ask/track';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (priv) {
      if (!meta) { meta = document.createElement('meta'); meta.name = 'robots'; document.head.appendChild(meta); }
      meta.content = 'noindex, nofollow';
    } else if (meta) meta.remove();
  }, [pathname]);
  useReveal(pathname);
  return (
    <div className="flex min-h-screen flex-col bg-white text-[var(--text)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:font-semibold focus:text-college-primary focus:shadow-pop">
        Skip to main content
      </a>
      <Header />
      <TrackingBanner key={pathname} />
      <main id="main" className="flex-1">
        <ErrorBoundary resetKey={pathname} inline>
          <Suspense fallback={<StateBox kind="loading" message="Loading page…" />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

export default function PublicLayout() {
  return (
    <SiteProvider>
      <Shell />
    </SiteProvider>
  );
}
