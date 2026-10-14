import { useEffect, useState } from 'react';
import { Users, GraduationCap, ClipboardList, MessageSquareWarning } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, StatCard, StatSkeletons } from '@/components/ui';
import CollegeSnapshot from '@/components/dashboard/CollegeSnapshot';
import { useAuth } from '@/hooks/useAuth';

export default function SubAdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<{ students: number; classes: number; crs: number; concerns: number } | null>(null);

  useEffect(() => {
    async function load() {
      const [students, classes, crs, concerns] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('classes').select('id', { count: 'exact', head: true }),
        supabase.from('cr_assignments').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('student_concerns').select('id', { count: 'exact', head: true }),
      ]);
      setStats({ students: students.count ?? 0, classes: classes.count ?? 0, crs: crs.count ?? 0, concerns: concerns.count ?? 0 });
    }
    load();
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">Welcome, {profile?.full_name}</h1>
        <p className="mt-1 text-sm text-[var(--text-2)]">Sub Super Admin — manage students, classes, and CRs within your permissions.</p>
      </div>
      {!stats ? (
        <StatSkeletons />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total Students" value={stats.students} icon={<Users size={20} />} />
          <StatCard label="Classes" value={stats.classes} icon={<GraduationCap size={20} />} tone="green" />
          <StatCard label="Active CRs" value={stats.crs} icon={<ClipboardList size={20} />} tone="amber" />
          <StatCard label="Student Concerns" value={stats.concerns} icon={<MessageSquareWarning size={20} />} tone="red" />
        </div>
      )}
      <CollegeSnapshot />
    </DashboardLayout>
  );
}
