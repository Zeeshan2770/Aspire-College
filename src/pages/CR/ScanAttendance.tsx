import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Loader2, AlertTriangle, CheckCircle2, ScanLine } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Label, Select, Badge, Modal } from '@/components/ui';
import { CrSectionSwitcher } from '@/components/CrSectionSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { useCrAssignment } from '@/hooks/useCrAssignment';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { findExistingSession, createAttendanceSession, saveAttendanceRecords } from '@/services/attendance';
import { createOcrEngine, parseAttendanceWords } from '@/services/attendanceOcr';
import { supabase } from '@/lib/supabase';
import { AttendanceStatus, OcrReviewRow, Student } from '@/types';
import clsx from 'clsx';

const CONFIDENCE_THRESHOLD = 70;

export default function ScanAttendance() {
  const { profile } = useAuth();
  const { assignment, loading: assignmentLoading } = useCrAssignment();
  const settings = useSystemSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [alreadyTaken, setAlreadyTaken] = useState(false);
  const [roster, setRoster] = useState<Student[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [rows, setRows] = useState<OcrReviewRow[]>([]);
  const [statusOverride, setStatusOverride] = useState<Record<string, AttendanceStatus | undefined>>({});
  const [unknownRolls, setUnknownRolls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!assignment) return;
    (async () => {
      const existing = await findExistingSession(assignment.section_id, date);
      setAlreadyTaken(!!existing);
      const { data } = await supabase.from('students').select('*').eq('section_id', assignment.section_id).eq('status', 'ACTIVE').order('roll_number');
      setRoster((data as Student[]) ?? []);
    })();
    resetScan();
  }, [assignment, date]); // eslint-disable-line

  function resetScan() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRows([]);
    setStatusOverride({});
    setUnknownRolls([]);
    setScanned(false);
  }

  async function handleFile(file: File) {
    resetScan();
    // Preview only, in-memory (object URL) — nothing is uploaded or written
    // to Supabase Storage at any point in this flow.
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setProcessing(true);
    setProgressLabel('Reading attendance sheet…');
    let engine: Awaited<ReturnType<typeof createOcrEngine>> | null = null;
    try {
      engine = await createOcrEngine();
      setProgressLabel('Recognizing roll numbers and marks…');
      const { words } = await engine.recognize(file);
      const rawRows = parseAttendanceWords(words);

      const byRoll = new Map(roster.map((s) => [s.roll_number.trim(), s]));
      const matched: OcrReviewRow[] = [];
      const unknown: string[] = [];

      for (const r of rawRows) {
        const student = byRoll.get(r.rollNumber.trim());
        if (!student) {
          unknown.push(r.rollNumber);
          continue;
        }
        matched.push({
          rollNumber: r.rollNumber,
          studentId: student.id,
          studentName: student.full_name,
          detectedStatus: r.detectedStatus,
          confidence: r.confidence,
          matched: true,
        });
      }

      // Roster students the scan never picked up at all — surfaced so the
      // CR can add them manually instead of them silently going unmarked.
      for (const s of roster) {
        if (!matched.some((m) => m.studentId === s.id)) {
          matched.push({
            rollNumber: s.roll_number,
            studentId: s.id,
            studentName: s.full_name,
            detectedStatus: 'UNCLEAR',
            confidence: 0,
            matched: true,
          });
        }
      }

      matched.sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }));
      setRows(matched);
      setUnknownRolls(unknown);
      setScanned(true);
      if (!rawRows.length) toast('Could not clearly read the sheet — you can still mark attendance manually below.', { icon: '⚠️' });
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to process the image.');
    } finally {
      await engine?.terminate();
      setProcessing(false);
      setProgressLabel('');
      // The photo itself is never kept past this point — only the parsed
      // review rows above are retained in memory.
    }
  }

  function statusFor(row: OcrReviewRow): AttendanceStatus | undefined {
    if (statusOverride[row.studentId!] !== undefined) return statusOverride[row.studentId!];
    return row.detectedStatus === 'PRESENT' || row.detectedStatus === 'ABSENT' ? row.detectedStatus : undefined;
  }

  function setRowStatus(studentId: string, status: AttendanceStatus) {
    setStatusOverride((prev) => ({ ...prev, [studentId]: status }));
  }

  const summary = useMemo(() => {
    let present = 0, absent = 0, needsReview = 0, unmarked = 0;
    for (const r of rows) {
      const st = statusFor(r);
      if (st === 'PRESENT') present++;
      else if (st === 'ABSENT') absent++;
      else unmarked++;
      if (r.confidence < CONFIDENCE_THRESHOLD || r.detectedStatus === 'UNCLEAR') needsReview++;
    }
    return { present, absent, needsReview, unmarked };
  }, [rows, statusOverride]); // eslint-disable-line

  async function doSave() {
    if (!assignment || !profile) return;
    setSaving(true);
    try {
      const session = await createAttendanceSession({
        classId: assignment.class_id, sectionId: assignment.section_id, date, takenBy: profile.id, source: 'OCR_SCAN',
      });
      const records = rows
        .map((r) => ({ studentId: r.studentId!, status: statusFor(r) }))
        .filter((r): r is { studentId: string; status: AttendanceStatus } => !!r.status);
      await saveAttendanceRecords(session.id, records);
      toast.success('Attendance saved from scan.');
      setAlreadyTaken(true);
      setConfirmOpen(false);
    } catch (e: any) {
      if (e.code === '23505') toast.error('Attendance for today has already been recorded.');
      else toast.error(e.message ?? 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  }

  if (settings && !settings.allow_ocr_scanning) {
    return (
      <DashboardLayout>
        <Card className="p-8 text-center text-slate-400">
          OCR attendance scanning is currently disabled by your Super Admin. Use Take Attendance instead.
        </Card>
      </DashboardLayout>
    );
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
        <h1 className="text-2xl font-extrabold text-ink-900">Scan Attendance Sheet</h1>
        <p className="text-sm text-slate-500">Photograph a paper attendance sheet — nothing is saved until you confirm it below.</p>
        <div className="mt-2"><CrSectionSwitcher /></div>
      </div>

      <Card className="mb-4 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label>Class</Label><div className="flex h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-600">{assignment.classes?.name}</div></div>
          <div><Label>Section</Label><div className="flex h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-600">{assignment.sections?.name}</div></div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
      </Card>

      {alreadyTaken ? (
        <Card className="p-8 text-center text-amber-600">Attendance for this date has already been recorded.</Card>
      ) : (
        <>
          <Card className="mb-4 p-5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />
            <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
              {previewUrl ? (
                <img src={previewUrl} alt="Attendance sheet preview" className="max-h-56 rounded-lg border border-slate-200 object-contain" />
              ) : (
                <Camera size={32} className="text-slate-300" />
              )}
              <p className="text-sm text-slate-500">Take a photo or upload an image of the attendance sheet.</p>
              <p className="text-xs text-slate-400">The photo is processed on your device and is never uploaded or saved.</p>
              <Button onClick={() => fileInputRef.current?.click()} disabled={processing}>
                {processing ? <><Loader2 size={15} className="mr-1.5 inline animate-spin" /> {progressLabel}</> : <><ScanLine size={15} className="mr-1.5 inline" /> {previewUrl ? 'Scan Another Sheet' : 'Scan Attendance Sheet'}</>}
              </Button>
            </div>
          </Card>

          {scanned && (
            <>
              {unknownRolls.length > 0 && (
                <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                  <AlertTriangle size={15} className="mr-1.5 inline" />
                  Unknown Roll Number{unknownRolls.length > 1 ? 's' : ''} detected and ignored (not created as students): {unknownRolls.join(', ')}
                </Card>
              )}

              <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">Present: {summary.present}</span>
                  <span className="rounded-lg bg-red-50 px-2.5 py-1 text-red-700">Absent: {summary.absent}</span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-500">Not Marked: {summary.unmarked}</span>
                  {summary.needsReview > 0 && <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700">Needs Review: {summary.needsReview}</span>}
                </div>
                <Button onClick={() => setConfirmOpen(true)} disabled={saving}>
                  <CheckCircle2 size={15} className="mr-1.5 inline" /> Confirm &amp; Save Attendance
                </Button>
              </Card>

              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">Attendance Review</h2>
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3">Roll No.</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Detected Status</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => {
                      const needsReview = r.confidence < CONFIDENCE_THRESHOLD || r.detectedStatus === 'UNCLEAR';
                      const current = statusFor(r);
                      return (
                        <tr key={r.studentId} className={clsx(needsReview && 'bg-amber-50/60')}>
                          <td className="px-4 py-3 font-medium">{r.rollNumber}</td>
                          <td className="px-4 py-3">{r.studentName}</td>
                          <td className="px-4 py-3">
                            {needsReview ? <Badge tone="amber">Needs Review</Badge> : <Badge tone={r.detectedStatus === 'PRESENT' ? 'green' : 'red'}>{r.detectedStatus}</Badge>}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{r.confidence > 0 ? `${r.confidence}%` : '—'}</td>
                          <td className="px-4 py-3">
                            <Select
                              className="max-w-[140px]"
                              value={current ?? ''}
                              onChange={(e) => setRowStatus(r.studentId!, e.target.value as AttendanceStatus)}
                            >
                              <option value="">Not Marked</option>
                              <option value="PRESENT">Present</option>
                              <option value="ABSENT">Absent</option>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Scanned Attendance">
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            Save attendance for <strong className="text-ink-900">{assignment.classes?.name} — {assignment.sections?.name}</strong> on{' '}
            <strong className="text-ink-900">{date}</strong> from this scan?
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">Present: {summary.present}</span>
            <span className="rounded-lg bg-red-50 px-2.5 py-1 text-red-700">Absent: {summary.absent}</span>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-500">Not Marked: {summary.unmarked}</span>
          </div>
          {summary.needsReview > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600"><AlertTriangle size={13} /> {summary.needsReview} row(s) still need review — check the table before confirming.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Go Back</Button>
            <Button onClick={doSave} disabled={saving}>{saving ? 'Saving…' : 'Confirm & Save'}</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
