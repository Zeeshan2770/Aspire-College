import { useEffect, useMemo, useState } from 'react';
import { ListChecks, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, Badge, Label, Select } from '@/components/ui';
import { ClassRow, SectionRow } from '@/types';
import { listClasses, listSections } from '@/services/academics';
import { listSessionsFiltered, sessionSummary, studentRosterStats } from '@/services/attendance';

type ViewMode = 'sessions' | 'roster';

export default function AttendanceRecords() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mode, setMode] = useState<ViewMode>('sessions');

  const [sessions, setSessions] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [roster, setRoster] = useState<Awaited<ReturnType<typeof studentRosterStats>>>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  useEffect(() => {
    listClasses().then(setClasses);
    listSections().then(setSections);
  }, []);

  const formSections = useMemo(() => sections.filter((s) => !classId || s.class_id === classId), [sections, classId]);

  useEffect(() => {
    setOpenId(null);
    if (mode !== 'sessions') return;
    setLoadingSessions(true);
    listSessionsFiltered({ classId: classId || undefined, sectionId: sectionId || undefined, from: from || undefined, to: to || undefined, limit: 200 })
      .then(setSessions)
      .finally(() => setLoadingSessions(false));
  }, [classId, sectionId, from, to, mode]);

  useEffect(() => {
    if (mode !== 'roster') return;
    setLoadingRoster(true);
    studentRosterStats({ classId: classId || undefined, sectionId: sectionId || undefined, from: from || undefined, to: to || undefined })
      .then(setRoster)
      .finally(() => setLoadingRoster(false));
  }, [classId, sectionId, from, to, mode]);

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

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">Attendance Records</h1>
        <p className="text-sm text-slate-500">Drill into real attendance data for any class and section — not just totals.</p>
      </div>

      <Card className="mb-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Class</Label>
            <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}>
              <option value="">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Section</Label>
            <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">All Sections</option>
              {formSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div><Label>From</Label><input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setMode('sessions')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${mode === 'sessions' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <ListChecks size={15} /> Daily Log
          </button>
          <button
            onClick={() => setMode('roster')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${mode === 'roster' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Users size={15} /> Student Roster
          </button>
        </div>
      </Card>

      {mode === 'sessions' ? (
        <Card className="divide-y divide-slate-100">
          {loadingSessions ? (
            <div className="px-5 py-10 text-center text-slate-400">Loading sessions…</div>
          ) : (
            <>
              {sessions.map((s) => (
                <div key={s.id}>
                  <button onClick={() => toggleOpen(s.id)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {new Date(s.date).toLocaleDateString()}
                        <span className="ml-2 font-normal text-slate-400">{s.classes?.name} · {s.sections?.name}</span>
                      </p>
                      {s.subject && <p className="text-xs text-slate-400">{s.subject}{s.teacher ? ` • ${s.teacher}` : ''}</p>}
                    </div>
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
              {!sessions.length && <div className="px-5 py-10 text-center text-slate-400">No attendance sessions found for this filter.</div>}
            </>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-bold text-ink-900">Student-wise Attendance</h3>
            <p className="text-xs text-slate-400">Every student's individual record for the selected class/section and date range.</p>
          </div>
          {loadingRoster ? (
            <div className="px-5 py-10 text-center text-slate-400">Loading roster…</div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">Student</th>
                  <th className="px-5 py-2.5">Class / Section</th>
                  <th className="px-5 py-2.5">Present</th>
                  <th className="px-5 py-2.5">Absent</th>
                  <th className="px-5 py-2.5">Total</th>
                  <th className="px-5 py-2.5">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map(({ student, stats }) => (
                  <tr key={student.id}>
                    <td className="px-5 py-2.5 font-medium text-ink-900">{student.full_name} <span className="text-slate-400">#{student.roll_number}</span></td>
                    <td className="px-5 py-2.5 text-slate-500">{student.classes?.name} — {student.sections?.name}</td>
                    <td className="px-5 py-2.5"><Badge tone="green">{stats.counts.PRESENT}</Badge></td>
                    <td className="px-5 py-2.5"><Badge tone="red">{stats.counts.ABSENT}</Badge></td>
                    <td className="px-5 py-2.5 text-slate-500">{stats.total}</td>
                    <td className="px-5 py-2.5"><Badge tone={stats.percentage >= 75 ? 'green' : stats.percentage >= 50 ? 'amber' : 'red'}>{stats.percentage}%</Badge></td>
                  </tr>
                ))}
                {!roster.length && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No students found for this filter.</td></tr>
                )}
              </tbody>
            </table></div>
          )}
        </Card>
      )}
    </DashboardLayout>
  );
}
