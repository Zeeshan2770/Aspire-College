import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Facebook, Instagram, Mail, Menu, Phone, X, Youtube, GraduationCap, MapPin } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SiteProvider, useSite } from './SiteProvider';
import { Placeholder, StateBox, btnPrimary } from './components';
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

function Logo({ large = false }: { large?: boolean }) {
  const { settings } = useSite();
  if (settings?.logo_url) {
    return <img src={settings.logo_url} alt={`${settings.college_name} logo`} className={large ? 'h-14 w-auto' : 'h-11 w-auto'} />;
  }
  return (
    <span className={`flex items-center justify-center rounded bg-college-primary text-white ${large ? 'h-12 w-12' : 'h-10 w-10'}`} aria-hidden="true">
      <GraduationCap className="h-5 w-5" />
    </span>
  );
}

function Header() {
  const { settings } = useSite();
  const { session, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname]);

  const link = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded px-3 py-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-college-accent ${
      isActive ? 'text-college-primary underline decoration-college-accent decoration-2 underline-offset-[10px]' : 'text-slate-700 hover:text-college-primary'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      {(settings?.phone || settings?.email) && (
        <div className="hidden bg-college-primary text-xs text-white/90 sm:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-1.5">
            <span className="flex items-center gap-4">
              {settings.phone && (
                <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 hover:underline">
                  <Phone className="h-3 w-3" aria-hidden="true" /> {settings.phone}
                </a>
              )}
              {settings.email && (
                <a href={`mailto:${settings.email}`} className="flex items-center gap-1.5 hover:underline">
                  <Mail className="h-3 w-3" aria-hidden="true" /> {settings.email}
                </a>
              )}
            </span>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-college-accent">
          <Logo />
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-base font-semibold text-college-primary">{settings?.college_name ?? 'Aspire Group of Colleges'}</span>
            <span className="block text-xs text-slate-500">{settings?.campus_name ?? 'Taunsa Sharif'}</span>
          </span>
        </Link>

        <div className="hidden shrink-0 items-center gap-3 xl:flex">
          {session && profile ? (
            <Link to={portalHomeForRole(profile.role)} className="text-sm font-medium text-college-primary hover:underline">
              Open Portal
            </Link>
          ) : (
            <PortalLoginMenu />
          )}
          {settings?.admissions_open !== false && (
            <Link to="/admissions/apply" className={btnPrimary}>
              Apply Now
            </Link>
          )}
        </div>

        <button
          type="button"
          className="rounded p-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-college-accent xl:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <nav aria-label="Main" className="hidden border-t border-slate-100 xl:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-6">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={link}>
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-slate-200 bg-white xl:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-4 py-2 sm:px-6">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `border-b border-slate-100 py-3 text-sm font-medium ${isActive ? 'text-college-primary' : 'text-slate-700'}`}>
                {n.label}
              </NavLink>
            ))}
            <div className="flex flex-col gap-2 py-4">
              {settings?.admissions_open !== false && (
                <Link to="/admissions/apply" className={btnPrimary}>
                  Apply for Admission
                </Link>
              )}
              {session && profile ? (
                <Link to={portalHomeForRole(profile.role)} className="py-2 text-center text-sm font-medium text-college-primary">
                  Open Portal
                </Link>
              ) : (
                <div className="mt-2 rounded border border-slate-200">
                  <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Portal login</p>
                  <ul>
                    {PORTAL_ROLES.map((p) => (
                      <li key={p.key} className="border-b border-slate-100 last:border-0">
                        <Link to={`/login?as=${p.key}`} className="block px-3 py-3 text-sm font-medium text-slate-700">
                          {p.label}
                          <span className="block text-xs font-normal text-slate-500">{p.blurb}</span>
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

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <Logo large />
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold text-white">{settings?.college_name ?? 'Aspire Group of Colleges'}</p>
              <p className="text-sm text-slate-400">{settings?.campus_name ?? 'Taunsa Sharif'}</p>
            </div>
          </div>
          {settings?.footer_text && <p className="mt-4 text-sm text-slate-400">{settings.footer_text}</p>}
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Quick Links</h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {NAV.slice(1).map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="hover:text-white hover:underline">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/admissions/apply" className="hover:text-white hover:underline">
                Apply Online
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-white hover:underline">
                Portal Login
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Contact</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              {settings?.address ? settings.address : <Placeholder label="[ADDRESS TO BE PROVIDED]" />}
            </li>
            <li className="flex gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              {settings?.phone ? <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="hover:text-white">{settings.phone}</a> : <Placeholder label="[PHONE TO BE PROVIDED]" />}
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              {settings?.email ? <a href={`mailto:${settings.email}`} className="hover:text-white">{settings.email}</a> : <Placeholder label="[EMAIL TO BE PROVIDED]" />}
            </li>
          </ul>
          {social.length > 0 && (
            <div className="mt-5 flex gap-3">
              {social.map(({ href, label, Icon }) => (
                <a key={label} href={href!} target="_blank" rel="noopener noreferrer" aria-label={label} className="rounded border border-slate-700 p-2 hover:border-slate-500 hover:text-white">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-slate-800">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-500 sm:px-6">
          © {year} {settings?.college_name ?? 'Aspire Group of Colleges'}, {settings?.campus_name ?? 'Taunsa Sharif'}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function Shell() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-800">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-college-primary">
        Skip to main content
      </a>
      <Header />
      <main id="main" className="flex-1">
        <ErrorBoundary resetKey={pathname} inline>
          <Suspense fallback={<StateBox kind="loading" message="Loading page…" />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
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
