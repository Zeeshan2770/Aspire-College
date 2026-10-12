import { useEffect, useState } from 'react';
import { FileDown, Image as ImageIcon, Zap, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Label, Select } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { ClassRow, SectionRow } from '@/types';
import { listClasses, listSections } from '@/services/academics';
import { getSettings } from '@/services/settings';
import { resolveBranding } from '@/services/reportBranding';
import { buildPdfDocument, pdfPreviewUrl } from '@/services/reports/pdf';
import { buildJpgDataUrl } from '@/services/reports/jpg';
import { quickSystemAttendanceReport, quickTodayConcernsReport, QuickFormat } from '@/services/reports/quickActions';
import { studentRosterStats } from '@/services/attendance';
import { ReportPreviewModal, ReportPreview } from '@/components/ReportPreviewModal';
import CollegeReports from '@/components/reports/CollegeReports';

type ReportKind = 'attendance' | 'concerns';
type AttendanceDetail = 'summary' | 'student';
type QuickKey = 'today' | 'week' | 'month' | 'concerns';

const QUICK_ACTIONS: { key: QuickKey; label: string }[] = [
  { key: 'today', label: "Today's Attendance" },
  { key: 'week', label: "This Week's Attendance" },
  { key: 'month', label: "This Month's Attendance" },
  { key: 'concerns', label: "Today's Concerns" },
];

export default function AdminReportsPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [kind, setKind] = useState<ReportKind>('attendance');
  const [attendanceDetail, setAttendanceDetail] = useState<AttendanceDetail>('summary');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [quickFormat, setQuickFormat] = useState<QuickFormat>('pdf');
  const [quickBusy, setQuickBusy] = useState<QuickKey | null>(null);

  function closePreview() {
    if (preview?.format === 'pdf') URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  /** One-click reports — build and download immediately, bypassing the form and preview step below. */
  async function handleQuickAction(action: QuickKey) {
    setQuickBusy(action);
    try {
      if (action === 'today') await quickSystemAttendanceReport({ days: 1, label: 'Today', format: quickFormat });
      else if (action === 'week') await quickSystemAttendanceReport({ days: 7, label: 'Last 7 Days', format: quickFormat });
      else if (action === 'month') await quickSystemAttendanceReport({ days: 30, label: 'Last 30 Days', format: quickFormat });
      else await quickTodayConcernsReport(quickFormat);
      toast.success(`${quickFormat.toUpperCase()} report downloaded.`);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to generate report.');
    } finally {
      setQuickBusy(null);
    }
  }

  useEffect(() => {
    listClasses().then(setClasses);
    listSections().then(setSections);
  }, []);

  const formSections = sections.filter((s) => !classId || s.class_id === classId);

  async function buildAttendanceRows() {
    let query = supabase
      .from('attendance_sessions')
      .select('date, section_id, sections(name), classes(name), attendance_records(status)')
      .order('date', { ascending: false });
    if (classId) query = query.eq('class_id', classId);
    if (sectionId) query = query.eq('section_id', sectionId);
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((s: any) => {
      const present = s.attendance_records.filter((r: any) => r.status === 'PRESENT').length;
      const absent = s.attendance_records.filter((r: any) => r.status === 'ABSENT').length;
      return [s.date, s.classes?.name ?? '', s.sections?.name ?? '', present, absent];
    });
  }

  /**
   * Student-wise breakdown: real per-student attendance data (not just
   * session totals) for the selected class/section and date range — one
   * row per student, matching the roster view used in Attendance Records.
   */
  async function buildStudentWiseRows() {
    const results = await studentRosterStats({
      classId: classId || undefined,
      sectionId: sectionId || undefined,
      from: from || undefined,
      to: to || undefined,
    });
    return results.map(({ student, stats }) => [
      student.roll_number,
      student.full_name,
      (student as any).classes?.name ?? '',
      (student as any).sections?.name ?? '',
      stats.total,
      stats.counts.PRESENT,
      stats.counts.ABSENT,
      `${stats.percentage}%`,
    ]);
  }

  async function buildConcernRows() {
    let query = supabase
      .from('student_concerns')
      .select('created_at, concern_type, status, students(full_name, roll_number), classes(name), sections(name)')
      .order('created_at', { ascending: false });
    if (classId) query = query.eq('class_id', classId);
    if (sectionId) query = query.eq('section_id', sectionId);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((c: any) => [
      new Date(c.created_at).toLocaleDateString(),
      c.students?.full_name ?? '',
      c.students?.roll_number ?? '',
      c.classes?.name ?? '',
      c.sections?.name ?? '',
      c.concern_type,
      c.status,
    ]);
  }

  async function handleGenerate(format: 'pdf' | 'jpg') {
    if (preview?.format === 'pdf') URL.revokeObjectURL(preview.url);
    setGenerating(true);
    try {
      const [settings, branding] = await Promise.all([getSettings(), resolveBranding(classId || null, sectionId || null)]);
      const subtitleParts = [];
      if (classId) subtitleParts.push(`Class: ${classes.find((c) => c.id === classId)?.name}`);
      if (sectionId) subtitleParts.push(`Section: ${sections.find((s) => s.id === sectionId)?.name}`);
      const subtitle = subtitleParts.join(' | ') || 'All Classes & Sections';
      const dateRange = from || to ? (from && to && from === to ? from : `${from || 'Start'} to ${to || 'Today'}`) : undefined;

      let title: string;
      let columns: string[];
      let rows: (string | number)[][];
      let filename: string;

      if (kind === 'attendance' && attendanceDetail === 'student') {
        title = 'Student-wise Attendance Report';
        columns = ['Roll #', 'Name', 'Class', 'Section', 'Total', 'Present', 'Absent', 'Percentage'];
        rows = await buildStudentWiseRows();
        filename = 'student-attendance-report';
      } else if (kind === 'attendance') {
        title = 'Attendance Report';
        columns = ['Date', 'Class', 'Section', 'Present', 'Absent'];
        rows = await buildAttendanceRows();
        filename = 'attendance-report';
      } else {
        title = 'Student Concern Report';
        columns = ['Date', 'Student', 'Roll #', 'Class', 'Section', 'Concern', 'Status'];
        rows = await buildConcernRows();
        filename = 'concern-report';
      }

      const reportOpts = { title, subtitle, dateRange, columns, rows, settings, branding, filename };
      if (format === 'pdf') {
        const doc = await buildPdfDocument(reportOpts);
        setPreview({ format: 'pdf', url: pdfPreviewUrl(doc), filename: `${filename}.pdf` });
      } else {
        const url = await buildJpgDataUrl(reportOpts);
        setPreview({ format: 'jpg', url, filename: `${filename}.jpg` });
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to generate report.');
    } finally {
      setGenerating(false);
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

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">Reports</h1>
        <p className="text-sm text-slate-500">Preview a report before downloading so figures can be checked and corrected — pick "Today" for a daily report, a range for a period report, or leave the dates empty for the complete record. Choose student-wise detail for the actual attendance record of every student, not just totals.</p>
      </div>

      <Card className="mb-4 border-brand-100 bg-brand-50/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 font-bold text-ink-900"><Zap size={16} className="text-brand-600" /> Quick Reports</h3>
            <p className="mt-0.5 text-xs text-slate-500">One click, system-wide, all classes &amp; sections — downloads immediately.</p>
          </div>
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
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <Button
              key={a.key}
              size="sm"
              variant="secondary"
              disabled={quickBusy !== null}
              onClick={() => handleQuickAction(a.key)}
            >
              <Download size={14} /> {quickBusy === a.key ? 'Preparing…' : a.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Report Type</Label>
            <Select value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
              <option value="attendance">Attendance Report</option>
              <option value="concerns">Student Concern Report</option>
            </Select>
          </div>
          {kind === 'attendance' && (
            <div>
              <Label>Attendance Detail</Label>
              <Select value={attendanceDetail} onChange={(e) => setAttendanceDetail(e.target.value as AttendanceDetail)}>
                <option value="summary">Daily Summary (session totals)</option>
                <option value="student">Student-wise (each student's own record)</option>
              </Select>
            </div>
          )}
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
          <div className="grid grid-cols-2 gap-2">
            <div><Label>From</Label><input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Quick range:</span>
          <button
            onClick={() => { const t = new Date().toISOString().slice(0, 10); setFrom(t); setTo(t); }}
            className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            Today (Daily Report)
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 6);
              setFrom(d.toISOString().slice(0, 10));
              setTo(new Date().toISOString().slice(0, 10));
            }}
            className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 29);
              setFrom(d.toISOString().slice(0, 10));
              setTo(new Date().toISOString().slice(0, 10));
            }}
            className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            Last 30 Days
          </button>
          {(from || to) && (
            <button
              onClick={() => { setFrom(''); setTo(''); }}
              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Clear (Complete Report)
            </button>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Button disabled={generating} onClick={() => handleGenerate('pdf')}><FileDown size={16} /> {generating ? 'Preparing…' : 'Preview PDF'}</Button>
          <Button disabled={generating} variant="secondary" onClick={() => handleGenerate('jpg')}><ImageIcon size={16} /> {generating ? 'Preparing…' : 'Preview JPG'}</Button>
        </div>
      </Card>

      <CollegeReports />

      {preview && <ReportPreviewModal preview={preview} onClose={closePreview} onDownload={handleDownload} />}
    </DashboardLayout>
  );
}
