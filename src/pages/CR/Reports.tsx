import { useEffect, useState } from 'react';
import { FileDown, Image as ImageIcon, Zap, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Label, Select, Input } from '@/components/ui';
import { CrSectionSwitcher } from '@/components/CrSectionSwitcher';
import { useCrAssignment } from '@/hooks/useCrAssignment';
import { studentAttendanceStats, dailySessionStatusMap } from '@/services/attendance';
import { getSettings } from '@/services/settings';
import { resolveBranding } from '@/services/reportBranding';
import { buildPdfDocument, pdfPreviewUrl, PdfReportOptions } from '@/services/reports/pdf';
import { buildJpgDataUrl } from '@/services/reports/jpg';
import { quickTodayClassReport, QuickFormat } from '@/services/reports/quickActions';
import { supabase } from '@/lib/supabase';
import { Student } from '@/types';
import { ReportPreviewModal, ReportPreview } from '@/components/ReportPreviewModal';
import clsx from 'clsx';

type Period = 'all' | 'day';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatStatus(status?: string) {
  if (!status) return 'Not Marked';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function CrReports() {
  const { assignment, loading } = useCrAssignment();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [date, setDate] = useState(todayStr());
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [quickFormat, setQuickFormat] = useState<QuickFormat>('pdf');
  const [quickBusy, setQuickBusy] = useState(false);

  /** One-click "Today's Attendance Report" — builds and downloads immediately, no form, no preview. */
  async function handleQuickToday() {
    if (!assignment) return;
    setQuickBusy(true);
    try {
      await quickTodayClassReport({
        classId: assignment.class_id,
        sectionId: assignment.section_id,
        className: assignment.classes?.name,
        sectionName: assignment.sections?.name,
        format: quickFormat,
      });
      toast.success(`Today's ${quickFormat.toUpperCase()} report downloaded.`);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to generate report.');
    } finally {
      setQuickBusy(false);
    }
  }

  function closePreview() {
    if (preview?.format === 'pdf') URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  /** Builds the report and opens it in a preview modal instead of downloading straight away. */
  async function showPreview(format: 'pdf' | 'jpg', opts: Omit<PdfReportOptions, 'filename'> & { filename: string }) {
    if (preview?.format === 'pdf') URL.revokeObjectURL(preview.url);
    if (format === 'pdf') {
      const doc = await buildPdfDocument(opts);
      setPreview({ format: 'pdf', url: pdfPreviewUrl(doc), filename: `${opts.filename}.pdf` });
    } else {
      const url = await buildJpgDataUrl(opts);
      setPreview({ format: 'jpg', url, filename: `${opts.filename}.jpg` });
    }
  }

  function handleDownload() {
    if (!preview) return;
    const a = document.createElement('a');
    a.href = preview.url;
    a.download = preview.filename;
    a.click();
    toast.success(`${preview.format.toUpperCase()} downloaded.`);
  }

  useEffect(() => {
    if (!assignment) return;
    let cancelled = false;
    setStudentId('');
    // Clear immediately on section change so the previous section's
    // roster can never briefly linger (and be reported on) while the new
    // section's students are still loading.
    setStudents([]);
    (async () => {
      const { data } = await supabase.from('students').select('*').eq('section_id', assignment.section_id).order('roll_number');
      // If the CR switched sections again (or this effect re-ran) before
      // this fetch resolved, discard the now-stale result.
      if (cancelled) return;
      setStudents((data as Student[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [assignment]);

  async function generateIndividual(format: 'pdf' | 'jpg') {
    if (!assignment) return;
    // Pin the section this report is being generated for, so a section
    // switch mid-flight can't smuggle another section's data into the
    // preview (see the assignment-consistency check below).
    const activeSectionId = assignment.section_id;
    const student = students.find((s) => s.id === studentId);
    if (!student) { toast.error('Select a student first.'); return; }
    // Defense in depth: never trust the in-memory student record alone —
    // confirm it actually belongs to the CR's currently active section
    // before pulling any attendance data for it. The database's row-level
    // security already enforces this server-side; this guard just stops a
    // stale/mismatched client state from even attempting the request.
    if (student.section_id !== activeSectionId) {
      toast.error('That student is not in your assigned section.');
      return;
    }
    setGenerating(true);
    try {
      const [settings, branding] = await Promise.all([
        getSettings(),
        resolveBranding(assignment.class_id, assignment.section_id),
      ]);
      if (assignment.section_id !== activeSectionId) {
        toast.error('Your section changed while generating — please try again.');
        return;
      }

      if (period === 'day') {
        const statusMap = await dailySessionStatusMap(activeSectionId, date);
        if (!statusMap) {
          toast.error(`Attendance hasn't been taken for ${date} yet.`);
          return;
        }
        const columns = ['Metric', 'Value'];
        const rows: (string | number)[][] = [
          ['Student', student.full_name],
          ['Roll Number', student.roll_number],
          ['Class', assignment.classes?.name ?? ''],
          ['Section', assignment.sections?.name ?? ''],
          ['Date', date],
          ['Status', formatStatus(statusMap[student.id])],
        ];
        await showPreview(format, {
          title: 'Daily Student Attendance Report',
          dateRange: date,
          columns, rows, settings, branding,
          filename: `attendance-daily-${student.roll_number}-${date}`,
        });
      } else {
        const stats = await studentAttendanceStats(studentId);
        if (assignment.section_id !== activeSectionId) {
          toast.error('Your section changed while generating — please try again.');
          return;
        }
        const columns = ['Metric', 'Value'];
        const rows: (string | number)[][] = [
          ['Student', student.full_name],
          ['Roll Number', student.roll_number],
          ['Class', assignment.classes?.name ?? ''],
          ['Section', assignment.sections?.name ?? ''],
          ['Total Days', stats.total],
          ['Present', stats.counts.PRESENT],
          ['Absent', stats.counts.ABSENT],
          ['Attendance Percentage', `${stats.percentage}%`],
        ];
        await showPreview(format, {
          title: 'Student Attendance Report',
          columns, rows, settings, branding,
          filename: `attendance-${student.roll_number}`,
        });
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  }

  async function generateClassReport(format: 'pdf' | 'jpg') {
    if (!assignment) return;
    const activeSectionId = assignment.section_id;
    // Defense in depth: only ever report on students whose section_id
    // matches the CR's active section, even if `students` momentarily held
    // a stale list from a just-abandoned section switch.
    const inSection = students.filter((s) => s.section_id === activeSectionId);
    if (inSection.length === 0) {
      toast.error('No students found for your assigned section.');
      return;
    }
    setGenerating(true);
    try {
      const [settings, branding] = await Promise.all([
        getSettings(),
        resolveBranding(assignment.class_id, assignment.section_id),
      ]);
      if (assignment.section_id !== activeSectionId) {
        toast.error('Your section changed while generating — please try again.');
        return;
      }

      if (period === 'day') {
        const statusMap = await dailySessionStatusMap(activeSectionId, date);
        if (!statusMap) {
          toast.error(`Attendance hasn't been taken for ${date} yet.`);
          return;
        }
        const columns = ['Roll #', 'Name', 'Status'];
        const rows = inSection.map((s) => [s.roll_number, s.full_name, formatStatus(statusMap[s.id])]);
        const subtitle = `Class: ${assignment.classes?.name} | Section: ${assignment.sections?.name}`;
        await showPreview(format, {
          title: 'Daily Class Attendance Report',
          subtitle,
          dateRange: date,
          columns, rows, settings, branding,
          filename: `class-attendance-daily-${date}`,
        });
      } else {
        const entries = await Promise.all(inSection.map(async (s) => {
          const st = await studentAttendanceStats(s.id);
          return [s.roll_number, s.full_name, st.total, st.counts.PRESENT, st.counts.ABSENT, `${st.percentage}%`];
        }));
        if (assignment.section_id !== activeSectionId) {
          toast.error('Your section changed while generating — please try again.');
          return;
        }
        const columns = ['Roll #', 'Name', 'Total', 'Present', 'Absent', 'Percentage'];
        const subtitle = `Class: ${assignment.classes?.name} | Section: ${assignment.sections?.name}`;
        await showPreview(format, {
          title: 'Complete Class Attendance Report',
          subtitle, columns, rows: entries, settings, branding,
          filename: 'class-attendance-report',
        });
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  }

  if (!assignment) {
    return (
      <DashboardLayout>
        <Card className="p-8 text-center text-slate-400">
          {loading ? 'Loading…' : 'You are not assigned to any section yet.'}
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">Reports</h1>
        <div className="mt-2"><CrSectionSwitcher /></div>
      </div>

      <Card className="mb-4 border-brand-100 bg-brand-50/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 font-bold text-ink-900"><Zap size={16} className="text-brand-600" /> Quick Report</h3>
            <p className="mt-0.5 text-xs text-slate-500">One click — downloads today's class attendance immediately, no setup needed.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-xl bg-white p-1 border border-slate-200">
              <button
                onClick={() => setQuickFormat('pdf')}
                className={clsx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', quickFormat === 'pdf' ? 'bg-brand-600 text-white shadow-soft' : 'text-slate-500')}
              >
                PDF
              </button>
              <button
                onClick={() => setQuickFormat('jpg')}
                className={clsx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', quickFormat === 'jpg' ? 'bg-brand-600 text-white shadow-soft' : 'text-slate-500')}
              >
                JPG
              </button>
            </div>
            <Button disabled={quickBusy} onClick={handleQuickToday}>
              <Download size={16} /> {quickBusy ? 'Preparing…' : "Today's Attendance Report"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mb-4 p-5">
        <Label>Report Period</Label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setPeriod('all')}
              className={clsx('rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', period === 'all' ? 'bg-white text-ink-900 shadow-soft' : 'text-slate-500')}
            >
              Complete (All-Time)
            </button>
            <button
              onClick={() => setPeriod('day')}
              className={clsx('rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', period === 'day' ? 'bg-white text-ink-900 shadow-soft' : 'text-slate-500')}
            >
              Daily
            </button>
          </div>
          {period === 'day' && (
            <div className="flex items-center gap-2">
              <Input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
              <button
                onClick={() => setDate(todayStr())}
                className="whitespace-nowrap rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                Today
              </button>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {period === 'day'
            ? 'Prints exactly what was recorded for the selected day — Present/Absent per student, no totals.'
            : 'Prints each student\'s full attendance record across every day recorded so far.'}
        </p>
      </Card>

      <Card className="mb-4 p-6">
        <h3 className="mb-3 font-bold text-ink-900">Individual Student Report</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <Label>Student</Label>
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Select student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} (#{s.roll_number})</option>)}
            </Select>
          </div>
          <Button disabled={generating} onClick={() => generateIndividual('pdf')}><FileDown size={16} /> Preview PDF</Button>
          <Button disabled={generating} variant="secondary" onClick={() => generateIndividual('jpg')}><ImageIcon size={16} /> Preview JPG</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-3 font-bold text-ink-900">{period === 'day' ? 'Daily Class Report' : 'Complete Class Report'}</h3>
        <div className="flex gap-3">
          <Button disabled={generating} onClick={() => generateClassReport('pdf')}><FileDown size={16} /> Preview PDF</Button>
          <Button disabled={generating} variant="secondary" onClick={() => generateClassReport('jpg')}><ImageIcon size={16} /> Preview JPG</Button>
        </div>
      </Card>

      {preview && <ReportPreviewModal preview={preview} onClose={closePreview} onDownload={handleDownload} />}
    </DashboardLayout>
  );
}
