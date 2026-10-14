import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, XCircle, MessageSquareText, MessageSquarePlus } from 'lucide-react';
import { StudentLayout } from '@/components/layout/StudentLayout';
import { Card, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { getMyStudentRecord, getMyAttendanceSummary, MyStudentRecord, AttendanceSummary } from '@/services/studentPortal';
import { listMyConcerns } from '@/services/concerns';

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [student, setStudent] = useState<MyStudentRecord | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [activeQueries, setActiveQueries] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const rec = await getMyStudentRecord();
      setStudent(rec);
      if (rec) {
        const [s, concerns] = await Promise.all([getMyAttendanceSummary(rec.id), listMyConcerns()]);
        setSummary(s);
        setActiveQueries(concerns.filter((c) => !['RESOLVED', 'CLOSED'].includes(c.status)).length);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </StudentLayout>
    );
  }

  if (!student) {
    return (
      <StudentLayout>
        <Card className="p-8 text-center text-slate-500">
          No student record is linked to this account yet. Please contact your Main Super Admin.
        </Card>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="mb-6">
        <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">Welcome, {student.full_name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-[var(--text-2)]">{student.classes?.name} — {student.sections?.name}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<CalendarCheck size={17} />} label="Overall Attendance" value={`${summary?.percentage ?? 0}%`} tone="brand" />
        <StatCard icon={<CalendarCheck size={17} />} label="Total Lectures" value={String(summary?.totalLectures ?? 0)} tone="slate" />
        <StatCard icon={<CheckCircle2 size={17} />} label="Present" value={String(summary?.present ?? 0)} tone="green" />
        <StatCard icon={<XCircle size={17} />} label="Absent" value={String(summary?.absent ?? 0)} tone="red" />
      </div>

      <Card className="mb-6 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <MessageSquareText size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-ink-900">Active Queries</p>
            <p className="text-xs text-slate-500">Submitted and awaiting a response</p>
          </div>
        </div>
        <p className="text-xl font-extrabold text-ink-900 sm:text-2xl">{activeQueries}</p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/student/attendance" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition hover:border-brand-200 hover:shadow-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><CalendarCheck size={18} /></div>
          <div>
            <p className="text-sm font-bold text-ink-900">My Attendance</p>
            <p className="text-xs text-slate-500">Subject-wise breakdown &amp; history</p>
          </div>
        </Link>
        <Link to="/student/raise-query" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition hover:border-brand-200 hover:shadow-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><MessageSquarePlus size={18} /></div>
          <div>
            <p className="text-sm font-bold text-ink-900">Raise a Query</p>
            <p className="text-xs text-slate-500">Academic, attendance, welfare &amp; more</p>
          </div>
        </Link>
      </div>
    </StudentLayout>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'brand' | 'slate' | 'green' | 'red' }) {
  const tones = {
    brand: '!bg-brand-50 text-brand-700',
    slate: '!bg-slate-100 text-slate-600',
    green: '!bg-emerald-50 text-emerald-700',
    red: '!bg-red-50 text-red-700',
  };
  return (
    <Card className={`p-3.5 ${tones[tone]}`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-70">{icon} {label}</div>
      <p className="text-xl font-extrabold">{value}</p>
    </Card>
  );
}
