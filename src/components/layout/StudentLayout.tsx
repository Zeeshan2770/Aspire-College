import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { LayoutDashboard, CalendarCheck, MessageSquarePlus, MessageSquareText, UserCircle2, LogOut, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { CreditBox } from '@/components/CreditBox';

const NAV_ITEMS = [
  { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/attendance', label: 'Attendance', icon: CalendarCheck, end: false },
  { to: '/student/raise-query', label: 'Raise Query', icon: MessageSquarePlus, end: false },
  { to: '/student/queries', label: 'My Queries', icon: MessageSquareText, end: false },
  { to: '/student/profile', label: 'Profile', icon: UserCircle2, end: false },
];

export function StudentLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const { pathname } = useLocation();
  const tabs = useRef<HTMLElement>(null);
  const tabEls = useRef<Record<string, HTMLElement | null>>({});
  const [pill, setPill] = useState({ x: 0, w: 0 });
  const [scrolled, setScrolled] = useState(false);
  const activeTo = NAV_ITEMS.find((i) => (i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(i.to + '/')))?.to;

  useLayoutEffect(() => {
    const run = () => {
      const el = activeTo ? tabEls.current[activeTo] : null;
      setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : { x: 0, w: 0 });
    };
    run();
    window.addEventListener('resize', run);
    document.fonts?.ready.then(run).catch(() => {});
    return () => window.removeEventListener('resize', run);
  }, [activeTo]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[var(--bg)] pb-28 md:pb-0">
      {/* Top island — identity, tabs and logout; no administrative nav ever appears here */}
      <header className="pointer-events-none sticky top-0 z-30 px-3 pt-3">
        <div className={clsx('island pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-2 md:max-w-4xl', scrolled && 'is-scrolled')}>
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white font-display font-extrabold text-[rgb(var(--ink-950))] shadow-soft">
              A
            </div>
            <div className="min-w-0 lg:hidden xl:block">
              <p className="truncate font-display text-sm font-bold leading-tight text-white">Aspire Group of Colleges</p>
              <p className="text-[11px] leading-tight text-white/60">Student Portal</p>
            </div>
          </div>

          {/* Desktop/tablet tabs with a sliding highlight */}
          <nav ref={tabs} aria-label="Student tabs" className="relative hidden items-center gap-0.5 md:flex">
            <span className="island-active" style={{ transform: `translateX(${pill.x}px)`, width: pill.w, opacity: pill.w ? 1 : 0 }} aria-hidden="true" />
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                ref={(el) => { tabEls.current[item.to] = el; }}
                className={({ isActive }) => clsx('island-link !px-3.5 !text-[0.85rem]', isActive && 'is-active')}
              >
                <item.icon size={15} /> {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-white/70" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white ring-1 ring-white/25">
                {profile?.full_name?.[0]?.toUpperCase()}
              </div>
            )}
            <button
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
              className="flex h-10 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white transition hover:border-[#F2A0A8] hover:bg-[#C43D4B] sm:px-4"
            >
              <LogOut size={15} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl md:max-w-4xl px-4 py-5">
        {profile?.must_change_password && (
          <NavLink
            to="/student/profile"
            className="mb-4 flex items-center gap-2 rounded-xl border border-[#EAD3A0] bg-[#FBF1DC] px-4 py-3 text-sm font-medium text-[#6F470C] hover:bg-[#F7E8C6]"
          >
            <AlertTriangle size={16} className="shrink-0" />
            Please change your temporary password before continuing.
          </NavLink>
        )}
        {children}
      </main>

      <div className="px-4 pb-6">
        <CreditBox variant="mini" />
      </div>

      {/* Mobile bottom nav — this is the primary way students, on their phones, get around the portal */}
      <nav aria-label="Student" className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="island pointer-events-auto mx-auto flex max-w-md items-center justify-between !p-1.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-[3.1rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10.5px] font-semibold transition-all duration-300',
                  isActive ? 'bg-white text-[rgb(var(--ink-950))] shadow-[0_6px_16px_-6px_rgba(0,0,0,.6),0_0_18px_rgba(81,137,255,.4)]' : 'text-white/70'
                )
              }
            >
              <item.icon size={18} /> {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
