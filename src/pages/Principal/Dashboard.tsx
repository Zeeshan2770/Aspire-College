import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, ClipboardList, CalendarCheck, CheckCircle2, XCircle,
  MessageSquareWarning, BarChart3, FileBarChart, History,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, StatCard, Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import CollegeSnapshot from '@/components/dashboard/CollegeSnapshot';

interface Stats {
  students: number;
  classes: number;
  sections: number;
  crs: number;
  todaySessions: number;
  todayPresent: number;
  todayAbsent: number;
  concernsTotal: number;
  concernsPending: number;
}

export default function PrincipalDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const [students, classes, sections, crs, sessions, concerns, pending] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('classes').select('id', { count: 'exact', head: true }),
        supabase.from('sections').select('id', { count: 'exact', head: true }),
        supabase.from('cr_assignments').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('attendance_sessions').select('id').eq('date', today),
        supabase.from('student_concerns').select('id', { count: 'exact', head: true }),
        supabase.from('student_concerns').select('id', { count: 'exact', head: true }).not('status', 'in', '(RESOLVED,CLOSED)'),
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
        todaySessions: sessionIds.length,
        todayPresent: present,
        todayAbsent: absent,
        concernsTotal: concerns.count ?? 0,
        concernsPending: pending.count ?? 0,
      });
    }
    load();
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">Welcome, {profile?.full_name}</h1>
          <p className="text-sm text-slate-500">Principal — full read-only visibility across the system.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/statistics"><Button variant="secondary"><BarChart3 size={16} /> Statistics</Button></Link>
          <Link to="/admin/attendance"><Button variant="secondary"><History size={16} /> Attendance Records</Button></Link>
          <Link to="/admin/reports"><Button><FileBarChart size={16} /> Reports</Button></Link>
        </div>
      </div>

      {!stats ? (
        <Card className="p-8 text-center text-slate-400">Loading dashboard…</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Total Students" value={stats.students} icon={<Users size={20} />} />
            <StatCard label="Classes" value={stats.classes} icon={<GraduationCap size={20} />} tone="green" />
            <StatCard label="Sections" value={stats.sections} icon={<GraduationCap size={20} />} tone="green" />
            <StatCard label="Active CRs" value={stats.crs} icon={<ClipboardList size={20} />} tone="amber" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard label="Today's Sessions" value={stats.todaySessions} icon={<CalendarCheck size={20} />} />
            <StatCard label="Today's Present" value={stats.todayPresent} icon={<CheckCircle2 size={20} />} tone="green" />
            <StatCard label="Today's Absent" value={stats.todayAbsent} icon={<XCircle size={20} />} tone="red" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-2">
            <StatCard label="Total Concerns" value={stats.concernsTotal} icon={<MessageSquareWarning size={20} />} tone="amber" />
            <StatCard label="Open Concerns" value={stats.concernsPending} icon={<MessageSquareWarning size={20} />} tone="red" />
          </div>
        </>
      )}
      <CollegeSnapshot />
    </DashboardLayout>
  );
}
