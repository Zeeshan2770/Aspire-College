import { useEffect, useState } from 'react';
import { StudentLayout } from '@/components/layout/StudentLayout';
import { Card, Spinner, Badge } from '@/components/ui';
import { getMyStudentRecord, getMyAttendanceSummary, AttendanceSummary } from '@/services/studentPortal';

export default function StudentAttendance() {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [noRecord, setNoRecord] = useState(false);

  useEffect(() => {
    (async () => {
      const rec = await getMyStudentRecord();
      if (!rec) { setNoRecord(true); setLoading(false); return; }
      setSummary(await getMyAttendanceSummary(rec.id));
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <StudentLayout><div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div></StudentLayout>;
  }
  if (noRecord || !summary) {
    return <StudentLayout><Card className="p-8 text-center text-slate-500">No attendance data is available yet.</Card></StudentLayout>;
  }

  return (
    <StudentLayout>
      <div className="mb-6">
        <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">My Attendance</h1>
        <p className="mt-1 text-sm text-[var(--text-2)]">Read-only — calculated from official records. If something looks wrong, raise a query instead of trying to fix it here.</p>
      </div>

      <Card className="mb-6 p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-extrabold text-brand-700">{summary.percentage}%</p>
            <p className="text-xs text-slate-500">Overall</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-emerald-600">{summary.present}</p>
            <p className="text-xs text-slate-500">Present</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-red-600">{summary.absent}</p>
            <p className="text-xs text-slate-500">Absent</p>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">{summary.totalLectures} lecture{summary.totalLectures === 1 ? '' : 's'} recorded in total</p>
      </Card>

      {summary.subjectDataAvailable && (
        <>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Subject-wise Attendance</h2>
          <Card className="mb-6 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-[#F4F7FC] text-left text-xs tracking-wide text-[#5B6B83]">
                <tr><th className="px-4 py-2.5">Subject</th><th className="px-4 py-2.5">Total</th><th className="px-4 py-2.5">Present</th><th className="px-4 py-2.5">Absent</th><th className="px-4 py-2.5">%</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.bySubject.map((s) => (
                  <tr key={s.subject}>
                    <td className="px-4 py-2.5 font-medium text-ink-900">{s.subject}</td>
                    <td className="px-4 py-2.5">{s.total}</td>
                    <td className="px-4 py-2.5 text-emerald-600">{s.present}</td>
                    <td className="px-4 py-2.5 text-red-600">{s.absent}</td>
                    <td className="px-4 py-2.5 font-semibold">{s.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Recent Attendance</h2>
      <Card className="divide-y divide-slate-100">
        {summary.recent.map((r, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink-900">{new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
              {r.subject && <p className="text-xs text-slate-500">{r.subject}</p>}
            </div>
            <Badge tone={r.status === 'PRESENT' ? 'green' : 'red'}>{r.status}</Badge>
          </div>
        ))}
        {!summary.recent.length && <div className="px-4 py-10 text-center text-slate-500">No attendance recorded yet.</div>}
      </Card>
    </StudentLayout>
  );
}
