import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      {/* Top header — identity + logout, no administrative nav ever appears here */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-soft">
              A
            </div>
            <div>
              <p className="text-sm font-extrabold leading-tight text-ink-900">Aspire Group of Colleges</p>
              <p className="text-[11px] leading-tight text-slate-400">Student Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {profile?.full_name?.[0]?.toUpperCase()}
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              <LogOut size={14} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Desktop/tablet nav — a slim tab bar, distinct from the admin sidebar entirely */}
        <nav className="mx-auto hidden max-w-3xl gap-1 px-4 pb-2 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100'
                )
              }
            >
              <item.icon size={15} /> {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {profile?.must_change_password && (
          <NavLink
            to="/student/profile"
            className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
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
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-3xl">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition',
                  isActive ? 'text-brand-600' : 'text-slate-400'
                )
              }
            >
              <item.icon size={19} /> {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
