import { NavLink, useNavigate } from 'react-router-dom';
import { ReactNode } from 'react';
import {
  LayoutDashboard, Users, GraduationCap, ShieldCheck, ClipboardList,
  CalendarCheck, History, MessageSquareWarning, FileBarChart, Settings,
  UserCog, LogOut, Menu, UserCircle2, Image as ImageIcon, BarChart3,
  Landmark, Megaphone, KeyRound, Clock, MessagesSquare, ScanLine, Send, FileText, Newspaper, Globe,
} from 'lucide-react';
import { useState } from 'react';
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

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { can } = usePermissions();
  const role = profile?.role ?? 'CR';
  const items = NAV[role].filter((i) => !i.perm || role !== 'SUB_SUPER_ADMIN' || can(i.perm));

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
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-100 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-soft">
            A
          </div>
          <div>
            <p className="text-sm font-extrabold leading-tight text-ink-900">Aspire Group of Colleges</p>
            <p className="text-[11px] leading-tight text-slate-400">Management Portal</p>
          </div>
        </div>

        {/*
          The nav list scrolls in its own region and the credit box sits
          below it in normal flow (not absolutely positioned over it), so
          on shorter screens or roles with many nav items — e.g. Main
          Super Admin, where "Settings" is the last item — the credit box
          can never cover a nav link, Settings included.
        */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin' || item.to === '/cr' || item.to === '/sub-admin' || item.to === '/principal'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                )
              }
              onClick={() => setOpen(false)}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-3">
          <CreditBox variant="mini" />
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-5 backdrop-blur">
          <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="hidden text-sm text-slate-500 lg:block">
            {profile?.role.replace(/_/g, ' ')}
          </div>
          <div className="flex items-center gap-3">
            <AnnouncementBell />
            <NavLink to="/profile" className="flex items-center gap-3 rounded-xl px-1.5 py-1 transition hover:bg-slate-50">
              <div className="text-right">
                <p className="text-sm font-semibold text-ink-900">{profile?.full_name}</p>
                <p className="text-xs text-slate-400">{profile?.email}</p>
              </div>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="h-9 w-9 rounded-xl object-cover ring-2 ring-white shadow-soft" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-soft">
                  {profile?.full_name?.[0]?.toUpperCase() ?? <UserCircle2 size={18} />}
                </div>
              )}
            </NavLink>
            <button
              onClick={handleSignOut}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="flex-1 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
