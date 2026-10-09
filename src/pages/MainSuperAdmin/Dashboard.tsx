import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, GraduationCap, ClipboardList, UserCog, CalendarCheck, CheckCircle2, XCircle, MessageSquareWarning, Download, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, StatCard, Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import CollegeSnapshot from '@/components/dashboard/CollegeSnapshot';
import { quickSystemAttendanceReport } from '@/services/reports/quickActions';

interface Stats {
  students: number;
  classes: number;
  sections: number;
  crs: number;
  subAdmins: number;
  todaySessions: number;
  todayPresent: number;
  todayAbsent: number;
  concernsTotal: number;
  concernsPending: number;
  concernsResolved: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);

  /** One-click download of today's system-wide attendance report, straight from the dashboard. */
  async function handleQuickReport() {
    setQuickBusy(true);
    try {
      await quickSystemAttendanceReport({ days: 1, label: 'Today', format: 'pdf' });
      toast.success("Today's report downloaded.");
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to generate report.');
    } finally {
      setQuickBusy(false);
    }
  }

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const [students, classes, sections, crs, subAdmins, sessions, concerns, pending, resolved] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('classes').select('id', { count: 'exact', head: true }),
        supabase.from('sections').select('id', { count: 'exact', head: true }),
        supabase.from('cr_assignments').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'SUB_SUPER_ADMIN'),
        supabase.from('attendance_sessions').select('id').eq('date', today),
        supabase.from('student_concerns').select('id', { count: 'exact', head: true }),
        supabase.from('student_concerns').select('id', { count: 'exact', head: true }).not('status', 'in', '(RESOLVED,CLOSED)'),
        supabase.from('student_concerns').select('id', { count: 'exact', head: true }).eq('status', 'RESOLVED'),
      ]);

      let present = 0, absent = 0;
      const sessionIds = (sessions.data ?? []).map((s) => s.id);
      if (sessionIds.length) {
        const { data: records } = await supabase.from('attendance_records').select('status').in('attendance_session_id', sessionIds);
        present = (records ?? []).filter((r) => r.status === 'PRESENT').length;
        absent = (records ?? []).filter((r) => r.status === 'ABSENT').length;
      }

      setStats({
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        sections: sections.count ?? 0,
        crs: crs.count ?? 0,
        subAdmins: subAdmins.count ?? 0,
        todaySessions: sessionIds.length,
        todayPresent: present,
        todayAbsent: absent,
        concernsTotal: concerns.count ?? 0,
        concernsPending: pending.count ?? 0,
        concernsResolved: resolved.count ?? 0,
      });
    }
    load();
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink-900">Welcome, {profile?.full_name}</h1>
        <p className="text-sm text-slate-500">Main Super Admin — full system overview</p>
      </div>

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-brand-100 bg-brand-50/50 p-5">
        <div>
          <h3 className="font-bold text-ink-900">Today's Attendance Report</h3>
          <p className="mt-0.5 text-xs text-slate-500">One click — download a PDF covering every class &amp; section for today.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={quickBusy} onClick={handleQuickReport}>
            <Download size={16} /> {quickBusy ? 'Preparing…' : 'Download PDF'}
          </Button>
          <Link to="/admin/reports" className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100">
            More reports <ArrowRight size={14} />
          </Link>
        </div>
      </Card>

      {!stats ? (
        <Card className="p-8 text-center text-slate-400">Loading dashboard…</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total Students" value={stats.students} icon={<Users size={20} />} />
            <StatCard label="Classes" value={stats.classes} icon={<GraduationCap size={20} />} tone="green" />
            <StatCard label="Sections" value={stats.sections} icon={<GraduationCap size={20} />} tone="green" />
            <StatCard label="Active CRs" value={stats.crs} icon={<ClipboardList size={20} />} tone="amber" />
            <StatCard label="Sub Super Admins" value={stats.subAdmins} icon={<UserCog size={20} />} tone="amber" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard label="Today's Sessions" value={stats.todaySessions} icon={<CalendarCheck size={20} />} />
            <StatCard label="Today's Present" value={stats.todayPresent} icon={<CheckCircle2 size={20} />} tone="green" />
            <StatCard label="Today's Absent" value={stats.todayAbsent} icon={<XCircle size={20} />} tone="red" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard label="Total Concerns" value={stats.concernsTotal} icon={<MessageSquareWarning size={20} />} tone="amber" />
            <StatCard label="Open Concerns" value={stats.concernsPending} icon={<MessageSquareWarning size={20} />} tone="red" />
            <StatCard label="Resolved Concerns" value={stats.concernsResolved} icon={<CheckCircle2 size={20} />} tone="green" />
          </div>
        </>
      )}
      <CollegeSnapshot />
    </DashboardLayout>
  );
}
