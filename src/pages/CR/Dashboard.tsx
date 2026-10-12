import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, CalendarCheck, CheckCircle2, XCircle, MessageSquareWarning, ShieldAlert, X, Download, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, StatCard, Badge, Button } from '@/components/ui';
import { CrSectionSwitcher } from '@/components/CrSectionSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { useCrAssignment } from '@/hooks/useCrAssignment';
import { todaysStats } from '@/services/attendance';
import { listWarnings, acknowledgeWarning } from '@/services/crAccounts';
import { quickTodayClassReport } from '@/services/reports/quickActions';
import { CrWarning } from '@/types';
import { supabase } from '@/lib/supabase';

export default function CrDashboard() {
  const { profile } = useAuth();
  const { assignment, loading } = useCrAssignment();
  const [studentCount, setStudentCount] = useState(0);
  const [concernCount, setConcernCount] = useState(0);
  const [today, setToday] = useState({ sessions: 0, present: 0, absent: 0 });
  const [warnings, setWarnings] = useState<CrWarning[]>([]);
  const [quickBusy, setQuickBusy] = useState(false);

  /** One-click download of today's class attendance report, straight from the dashboard. */
  async function handleQuickReport() {
    if (!assignment) return;
    setQuickBusy(true);
    try {
      await quickTodayClassReport({
        classId: assignment.class_id,
        sectionId: assignment.section_id,
        className: assignment.classes?.name,
        sectionName: assignment.sections?.name,
        format: 'pdf',
      });
      toast.success("Today's report downloaded.");
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to generate report.');
    } finally {
      setQuickBusy(false);
    }
  }

  useEffect(() => {
    if (!profile) return;
    listWarnings(profile.id).then((w) => setWarnings((w as CrWarning[]).filter((x) => !x.acknowledged_at)));
  }, [profile]);

  async function handleAcknowledge(id: string) {
    await acknowledgeWarning(id);
    setWarnings((w) => w.filter((x) => x.id !== id));
    toast.success('Warning acknowledged.');
  }

  useEffect(() => {
    if (!assignment) return;
    (async () => {
      const [{ count: sc }, { count: cc }, stats] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('section_id', assignment.section_id),
        supabase.from('student_concerns').select('id', { count: 'exact', head: true }).eq('section_id', assignment.section_id),
        todaysStats(assignment.section_id),
      ]);
      setStudentCount(sc ?? 0);
      setConcernCount(cc ?? 0);
      setToday(stats);
    })();
  }, [assignment]);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">Welcome, {profile?.full_name}</h1>
        {assignment ? (
          <div className="mt-2"><CrSectionSwitcher /></div>
        ) : !loading ? (
          <p className="text-sm text-amber-600">You have not been assigned to a class/section yet. Contact your Main Super Admin.</p>
        ) : null}
      </div>

      {warnings.length > 0 && (
        <div className="mb-6 space-y-3">
          {warnings.map((w) => (
            <Card key={w.id} className="border-l-4 border-l-red-400 bg-red-50/60 p-4">
              <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
                <ShieldAlert className="mt-0.5 shrink-0 text-red-500" size={20} />
                <div className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-auto">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone={w.severity === 'HIGH' ? 'red' : w.severity === 'MEDIUM' ? 'amber' : 'slate'}>{w.severity} Warning</Badge>
                    <span className="text-xs text-slate-400">{new Date(w.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-ink-800">{w.message}</p>
                  <p className="mt-1 text-xs text-slate-400">Issued by {w.issued_by_name}</p>
                </div>
                <Button size="sm" variant="secondary" className="shrink-0" onClick={() => handleAcknowledge(w.id)}><X size={13} /> Acknowledge</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {assignment && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total Students" value={studentCount} icon={<Users size={20} />} />
          <StatCard label="Today's Sessions" value={today.sessions} icon={<CalendarCheck size={20} />} />
          <StatCard label="Today's Present" value={today.present} icon={<CheckCircle2 size={20} />} tone="green" />
          <StatCard label="Today's Absent" value={today.absent} icon={<XCircle size={20} />} tone="red" />
          <StatCard label="Student Concerns" value={concernCount} icon={<MessageSquareWarning size={20} />} tone="amber" />
        </div>
      )}

      {assignment && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 border-brand-100 bg-brand-50/50 p-5">
          <div>
            <h3 className="font-bold text-ink-900">Today's Attendance Report</h3>
            <p className="mt-0.5 text-xs text-slate-500">One click — download a PDF of today's Present/Absent for your section.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={quickBusy} onClick={handleQuickReport}>
              <Download size={16} /> {quickBusy ? 'Preparing…' : 'Download PDF'}
            </Button>
            <Link to="/cr/reports" className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100">
              More reports <ArrowRight size={14} />
            </Link>
          </div>
        </Card>
      )}

      {!assignment && !loading && (
        <Card className="p-8 text-center text-slate-400">No section assigned yet.</Card>
      )}
    </DashboardLayout>
  );
}
