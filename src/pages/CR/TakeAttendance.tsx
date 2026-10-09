import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Label, Modal } from '@/components/ui';
import { CrSectionSwitcher } from '@/components/CrSectionSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { useCrAssignment } from '@/hooks/useCrAssignment';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { findExistingSession, createAttendanceSession, saveAttendanceRecords } from '@/services/attendance';
import { supabase } from '@/lib/supabase';
import { AttendanceStatus, Student } from '@/types';
import clsx from 'clsx';

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: any; active: string }> = {
  PRESENT: { label: 'Present', icon: CheckCircle2, active: 'bg-emerald-500 text-white' },
  ABSENT: { label: 'Absent', icon: XCircle, active: 'bg-red-500 text-white' },
};

export default function TakeAttendance() {
  const { profile } = useAuth();
  const { assignment, loading: assignmentLoading } = useCrAssignment();
  const settings = useSystemSettings();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | undefined>>({});
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [alreadyTaken, setAlreadyTaken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function loadStudents() {
    if (!assignment) return;
    setLoaded(false);
    const existing = await findExistingSession(assignment.section_id, date);
    if (existing) {
      setAlreadyTaken(true);
      setLoaded(true);
      return;
    }
    setAlreadyTaken(false);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('section_id', assignment.section_id)
      .eq('status', 'ACTIVE')
      .order('roll_number');
    if (error) {
      toast.error(error.message);
      return;
    }
    setStudents(data as Student[]);
    const startAllPresent = (settings?.default_attendance_behavior ?? 'ALL_PRESENT') === 'ALL_PRESENT';
    const init: Record<string, AttendanceStatus | undefined> = {};
    data.forEach((s) => (init[s.id] = startAllPresent ? 'PRESENT' : undefined));
    setStatuses(init);
    setLoaded(true);
  }

  useEffect(() => { loadStudents(); }, [assignment, date, settings]); // eslint-disable-line

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.full_name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q));
  }, [students, search]);

  const presentCount = Object.values(statuses).filter((s) => s === 'PRESENT').length;
  const absentCount = Object.values(statuses).filter((s) => s === 'ABSENT').length;
  const notMarkedCount = students.length - presentCount - absentCount;
  const attendancePercentage = students.length ? Math.round((presentCount / students.length) * 1000) / 10 : 0;

  function markAll(status: AttendanceStatus) {
    const next = { ...statuses };
    // Only affects the currently filtered/visible list, so a search doesn't
    // silently change students the CR can't currently see.
    filteredStudents.forEach((s) => { next[s.id] = status; });
    setStatuses(next);
  }

  async function doSave() {
    if (!assignment || !profile) return;
    setSaving(true);
    try {
      const session = await createAttendanceSession({
        classId: assignment.class_id,
        sectionId: assignment.section_id,
        date, takenBy: profile.id,
      });
      await saveAttendanceRecords(
        session.id,
        students.filter((s) => statuses[s.id]).map((s) => ({ studentId: s.id, status: statuses[s.id] as AttendanceStatus }))
      );
      toast.success('Attendance successfully submitted.');
      setAlreadyTaken(true);
    } catch (e: any) {
      if (e.code === '23505') toast.error('Attendance for today has already been recorded.');
      else toast.error(e.message ?? 'Failed to save attendance.');
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  function handleSaveClick() {
    if (notMarkedCount > 0 && !confirm(`${notMarkedCount} student(s) are not marked yet. Continue anyway?`)) return;
    setConfirmOpen(true);
  }

  if (!assignment) {
    return (
      <DashboardLayout>
        <Card className="p-8 text-center text-slate-400">
          {assignmentLoading ? 'Loading…' : 'You are not assigned to any section yet.'}
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink-900">Take Attendance</h1>
        <div className="mt-2"><CrSectionSwitcher /></div>
      </div>

      <Card className="mb-4 flex flex-wrap items-end gap-4 p-5">
        <div className="max-w-xs">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="max-w-xs flex-1">
          <Label>Search Student</Label>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Name or roll number…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </Card>

      {!loaded ? (
        <Card className="p-8 text-center text-slate-400">Loading…</Card>
      ) : alreadyTaken ? (
        <Card className="p-8 text-center text-amber-600">Attendance for today has already been recorded.</Card>
      ) : (
        <>
          <Card className="mb-4 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">Present: {presentCount}</span>
                <span className="rounded-lg bg-red-50 px-2.5 py-1 text-red-700">Absent: {absentCount}</span>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-500">Not Marked: {notMarkedCount}</span>
                <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700">{attendancePercentage}% present</span>
              </div>
              <Button onClick={handleSaveClick} disabled={saving || !students.length}>{saving ? 'Saving…' : 'Save Attendance'}</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => markAll('PRESENT')} className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200">
                Select All Present{search ? ' (filtered)' : ''}
              </button>
              <button onClick={() => markAll('ABSENT')} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200">
                Select All Absent{search ? ' (filtered)' : ''}
              </button>
            </div>
          </Card>

          <Card className="divide-y divide-slate-100">
            {filteredStudents.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{s.full_name}</p>
                  <p className="text-xs text-slate-400">Roll #{s.roll_number}</p>
                </div>
                <div className="flex gap-1.5">
                  {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((st) => {
                    const cfg = STATUS_CONFIG[st];
                    const Icon = cfg.icon;
                    const isActive = statuses[s.id] === st;
                    return (
                      <button
                        key={st}
                        onClick={() => setStatuses({ ...statuses, [s.id]: st })}
                        className={clsx(
                          'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                          isActive ? cfg.active : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        )}
                      >
                        <Icon size={13} /> {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {!filteredStudents.length && (
              <div className="px-4 py-10 text-center text-slate-400">
                {students.length ? 'No students match your search.' : 'No active students in this section.'}
              </div>
            )}
          </Card>
        </>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Attendance Submission">
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            You're about to submit attendance for <strong className="text-ink-900">{assignment.classes?.name} — {assignment.sections?.name}</strong> on{' '}
            <strong className="text-ink-900">{date}</strong>.
          </p>
          <div className="flex gap-3 text-xs font-semibold">
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">Present: {presentCount}</span>
            <span className="rounded-lg bg-red-50 px-2.5 py-1 text-red-700">Absent: {absentCount}</span>
            {notMarkedCount > 0 && <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700">Not Marked: {notMarkedCount}</span>}
          </div>
          <p className="text-xs text-slate-400">This cannot be changed by re-submitting — double-check the class, section, and date above.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={doSave} disabled={saving}>{saving ? 'Saving…' : 'Confirm & Submit'}</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
