import { NavLink, useNavigate } from 'react-router-dom';
import { ReactNode } from 'react';
import {
  LayoutDashboard, Users, GraduationCap, ShieldCheck, ClipboardList,
  CalendarCheck, History, MessageSquareWarning, FileBarChart, Settings,
  UserCog, LogOut, Menu, UserCircle2, Image as ImageIcon, BarChart3,
  Landmark, Megaphone, KeyRound, Clock, MessagesSquare, ScanLine, Send, FileText, Newspaper, Globe, Mail,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { AdminPermissions } from '@/types';
import { CreditBox } from '@/components/CreditBox';
import { AnnouncementBell } from '@/components/AnnouncementBell';
import { useIdleLogout, IDLE_TIMEOUT_MS } from '@/hooks/useIdleLogout';
import clsx from 'clsx';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Administration accounts only see this item when they hold the permission. */
  perm?: keyof AdminPermissions;
}

const NAV: Record<string, NavItem[]> = {
  MAIN_SUPER_ADMIN: [
    { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/admin/students', label: 'Students', icon: <Users size={18} /> },
    { to: '/admin/admissions', label: 'Admissions', icon: <FileText size={18} /> },
    { to: '/admin/faculty', label: 'Faculty', icon: <Users size={18} /> },
    { to: '/admin/classes', label: 'Classes & Sections', icon: <GraduationCap size={18} /> },
    { to: '/admin/crs', label: 'Class Representatives', icon: <ClipboardList size={18} /> },
    { to: '/admin/cr-accounts', label: 'CR Accounts & Credentials', icon: <KeyRound size={18} /> },
    { to: '/admin/student-accounts', label: 'Student Accounts', icon: <UserCircle2 size={18} /> },
    { to: '/admin/login-sessions', label: 'Login Sessions', icon: <Clock size={18} /> },
    { to: '/admin/sub-admins', label: 'Sub Super Admins', icon: <UserCog size={18} /> },
    { to: '/admin/principals', label: 'Principal Accounts', icon: <Landmark size={18} /> },
    { to: '/admin/statistics', label: 'Statistics', icon: <BarChart3 size={18} /> },
    { to: '/admin/attendance', label: 'Attendance Records', icon: <History size={18} /> },
    { to: '/admin/reports', label: 'Reports', icon: <FileBarChart size={18} /> },
    { to: '/admin/report-branding', label: 'Report Branding', icon: <ImageIcon size={18} /> },
    { to: '/admin/messages', label: 'Message Center', icon: <Mail size={18} /> },
    { to: '/announcements', label: 'Announcements', icon: <Megaphone size={18} /> },
    { to: '/concerns', label: 'Concerns', icon: <MessagesSquare size={18} /> },
    { to: '/admin/logs', label: 'Activity Logs', icon: <ShieldCheck size={18} /> },
    { to: '/admin/website', label: 'Website Content', icon: <Newspaper size={18} /> },
    { to: '/admin/website-settings', label: 'Website & Branding', icon: <Globe size={18} /> },
    { to: '/admin/settings', label: 'Settings', icon: <Settings size={18} /> },
  ],
  PRINCIPAL: [
    { to: '/principal', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/admin/admissions', label: 'Admissions', icon: <FileText size={18} /> },
    { to: '/admin/faculty', label: 'Faculty', icon: <Users size={18} /> },
    { to: '/admin/website', label: 'Website Content', icon: <Newspaper size={18} /> },
    { to: '/admin/statistics', label: 'Statistics', icon: <BarChart3 size={18} /> },
    { to: '/admin/attendance', label: 'Attendance Records', icon: <History size={18} /> },
    { to: '/admin/reports', label: 'Reports', icon: <FileBarChart size={18} /> },
    { to: '/admin/messages', label: 'Message Center', icon: <Mail size={18} /> },
    { to: '/announcements', label: 'Announcements', icon: <Megaphone size={18} /> },
    { to: '/concerns', label: 'Concerns', icon: <MessagesSquare size={18} /> },
  ],
  SUB_SUPER_ADMIN: [
    { to: '/sub-admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/admin/students', label: 'Students', icon: <Users size={18} /> },
    { to: '/admin/admissions', label: 'Admissions', icon: <FileText size={18} />, perm: 'manage_admissions' },
    { to: '/admin/faculty', label: 'Faculty', icon: <Users size={18} />, perm: 'manage_faculty' },
    { to: '/admin/website', label: 'Website Content', icon: <Newspaper size={18} />, perm: 'manage_content' },
    { to: '/admin/classes', label: 'Classes & Sections', icon: <GraduationCap size={18} /> },
    { to: '/admin/crs', label: 'Class Representatives', icon: <ClipboardList size={18} /> },
    { to: '/admin/statistics', label: 'Statistics', icon: <BarChart3 size={18} /> },
    { to: '/admin/attendance', label: 'Attendance Records', icon: <History size={18} /> },
    { to: '/admin/reports', label: 'Reports', icon: <FileBarChart size={18} /> },
    { to: '/admin/report-branding', label: 'Report Branding', icon: <ImageIcon size={18} /> },
    { to: '/admin/messages', label: 'Message Center', icon: <Mail size={18} /> },
    { to: '/announcements', label: 'Announcements', icon: <Megaphone size={18} /> },
    { to: '/concerns', label: 'Concerns', icon: <MessagesSquare size={18} /> },
  ],
  CR: [
    { to: '/cr', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/cr/attendance/take', label: 'Take Attendance', icon: <CalendarCheck size={18} /> },
    { to: '/cr/attendance/scan', label: 'Scan Attendance Sheet', icon: <ScanLine size={18} /> },
    { to: '/cr/attendance/history', label: 'Attendance History', icon: <History size={18} /> },
    { to: '/cr/students', label: 'My Students', icon: <Users size={18} /> },
    { to: '/cr/quick-report', label: 'Quick Reports & Messages', icon: <Send size={18} /> },
    { to: '/cr/concerns', label: 'Report Student Concern', icon: <MessageSquareWarning size={18} /> },
    { to: '/cr/reports', label: 'Reports', icon: <FileBarChart size={18} /> },
    { to: '/announcements', label: 'Announcements', icon: <Megaphone size={18} /> },
    { to: '/concerns', label: 'Concerns', icon: <MessagesSquare size={18} /> },
  ],
};

const GROUPS = ['Overview', 'People', 'Attendance & Reports', 'Communication', 'Website & Admissions', 'System'] as const;
function groupOf(to: string): (typeof GROUPS)[number] {
  if (['/admin', '/cr', '/sub-admin', '/principal'].includes(to)) return 'Overview';
  if (/students|faculty|classes|crs$|cr-accounts|student-accounts|sub-admins|principals/.test(to)) return 'People';
  if (/attendance|statistics|reports|report-branding/.test(to)) return 'Attendance & Reports';
  if (/announcements|concerns|quick-report/.test(to)) return 'Communication';
  if (/admissions|website/.test(to)) return 'Website & Admissions';
  return 'System';
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const { can } = usePermissions();
  const role = profile?.role ?? 'CR';
  const items = NAV[role]
    .filter((i) => !i.perm || role !== 'SUB_SUPER_ADMIN' || can(i.perm))
    .map((i, idx) => ({ i, idx, g: GROUPS.indexOf(groupOf(i.to)) }))
    .sort((a, b) => a.g - b.g || a.idx - b.idx)
    .map((x) => x.i);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  useIdleLogout(async () => {
    await signOut();
    toast('You were signed out after being inactive.', { icon: '⏱️' });
    navigate('/login');
  }, IDLE_TIMEOUT_MS);

  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-[var(--bg)]">
      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-[17rem] max-w-[85vw] transform flex-col bg-brand-900 text-white shadow-pop transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 font-display font-extrabold text-white shadow-soft">
            A
          </div>
          <div>
            <p className="font-display text-sm font-bold leading-tight text-white">Aspire Group of Colleges</p>
            <p className="text-[11px] leading-tight text-white/60">Management Portal</p>
          </div>
        </div>

        {/*
          The nav list scrolls in its own region and the credit box sits
          below it in normal flow (not absolutely positioned over it), so
          on shorter screens or roles with many nav items — e.g. Main
          Super Admin, where "Settings" is the last item — the credit box
          can never cover a nav link, Settings included.
        */}
        <nav aria-label="Portal" className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.map((item, n) => (
            <div key={item.to}>
              {(n === 0 || groupOf(items[n - 1].to) !== groupOf(item.to)) && n > 0 && (
                <p className="px-4 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-[.14em] text-white/45">{groupOf(item.to)}</p>
              )}
            <NavLink
              to={item.to}
              end={item.to === '/admin' || item.to === '/cr' || item.to === '/sub-admin' || item.to === '/principal'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-white text-[rgb(var(--ink-950))] shadow-[0_6px_16px_-6px_rgba(0,0,0,.6),0_0_20px_rgba(81,137,255,.35)]' : 'text-white/70 hover:bg-white/[.1] hover:text-white'
                )
              }
              onClick={() => setOpen(false)}
            >
              {item.icon}
              {item.label}
            </NavLink>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <CreditBox variant="mini" />
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-ink-900/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-h-screen min-h-[100dvh] min-w-0 flex-1 flex-col">
        <header className="pointer-events-none sticky top-0 z-20 px-3 pt-3 sm:px-5">
          <div className={clsx('island pointer-events-auto flex items-center justify-between gap-2', scrolled && 'is-scrolled')}>
            <div className="flex min-w-0 items-center gap-2">
              <button aria-label="Open menu" aria-expanded={open} className="island-menu-btn lg:hidden" onClick={() => setOpen(true)}>
                <Menu size={20} />
              </button>
              <div className="hidden items-center gap-2 pl-3 text-sm font-semibold capitalize text-white/90 lg:flex">
                <span className="h-2 w-2 rounded-full bg-[#5189FF] shadow-[0_0_10px_#5189FF]" aria-hidden="true" />
                {profile?.role.replace(/_/g, ' ').toLowerCase()}
              </div>
              <span className="truncate pl-1 font-display text-sm font-bold text-white lg:hidden">Aspire Portal</span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <AnnouncementBell tone="island" />
              <NavLink to="/profile" className="flex min-w-0 items-center gap-2.5 rounded-full border border-white/15 bg-white/10 p-1 transition hover:bg-white/20 md:pr-4">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name} className="h-8 w-8 rounded-full object-cover ring-2 ring-white/70" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-bold text-[rgb(var(--ink-950))]">
                    {profile?.full_name?.[0]?.toUpperCase() ?? <UserCircle2 size={18} />}
                  </div>
                )}
                <div className="hidden min-w-0 text-left md:block">
                  <p className="max-w-[12rem] truncate text-[0.8rem] font-semibold leading-tight text-white">{profile?.full_name}</p>
                  <p className="max-w-[12rem] truncate text-[0.68rem] leading-tight text-white/60">{profile?.email}</p>
                </div>
              </NavLink>
              <button
                onClick={handleSignOut}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:border-[#F2A0A8] hover:bg-[#C43D4B]"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
