import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, Badge } from '@/components/ui';
import { CrSectionSwitcher } from '@/components/CrSectionSwitcher';
import { useCrAssignment } from '@/hooks/useCrAssignment';
import { listSessionHistory, sessionSummary } from '@/services/attendance';

export default function AttendanceHistory() {
  const { assignment, loading } = useCrAssignment();
  const [sessions, setSessions] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any[]>([]);

  useEffect(() => {
    if (!assignment) return;
    setOpenId(null);
    listSessionHistory(assignment.section_id).then(setSessions);
  }, [assignment]);

  async function toggleOpen(id: string) {
    if (openId === id) { setOpenId(null); return; }
    const data = await sessionSummary(id);
    setDetail(data);
    setOpenId(id);
  }

  // Tallies whatever statuses actually appear — normally just
  // PRESENT/ABSENT, but a session recorded before attendance was
  // simplified may still carry a historical LATE/LEAVE mark.
  function counts(records: any[]) {
    const c: Record<string, number> = {};
    records.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }

  if (!assignment) {
    return (
      <DashboardLayout>
        <Card className="p-8 text-center text-slate-500">
          {loading ? 'Loading…' : 'You are not assigned to any section yet.'}
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">Attendance History</h1>
        <p className="mt-1 text-sm text-[var(--text-2)]">Review past attendance days for your section.</p>
        <div className="mt-2"><CrSectionSwitcher /></div>
      </div>

      <Card className="divide-y divide-slate-100">
        {sessions.map((s) => (
          <div key={s.id}>
            <button onClick={() => toggleOpen(s.id)} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50">
              <p className="text-sm font-semibold text-ink-900">{new Date(s.date).toLocaleDateString()}</p>
              <Badge tone="blue">View</Badge>
            </button>
            {openId === s.id && (
              <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                <div className="mb-3 flex gap-2">
                  {Object.entries(counts(detail)).map(([k, v]) => (
                    <Badge key={k} tone={k === 'PRESENT' ? 'green' : k === 'ABSENT' ? 'red' : 'amber'}>{k}: {v}</Badge>
                  ))}
                </div>
                <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-sm">
                  <tbody className="divide-y divide-slate-200">
                    {detail.map((r: any, i: number) => (
                      <tr key={i}>
                        <td className="py-1.5">{r.students?.full_name} (#{r.students?.roll_number})</td>
                        <td className="py-1.5 text-right"><Badge tone={r.status === 'PRESENT' ? 'green' : r.status === 'ABSENT' ? 'red' : 'amber'}>{r.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}
          </div>
        ))}
        {!sessions.length && <div className="px-5 py-10 text-center text-slate-500">No attendance sessions yet.</div>}
      </Card>
    </DashboardLayout>
  );
}
