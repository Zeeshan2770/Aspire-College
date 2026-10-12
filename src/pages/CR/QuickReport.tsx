import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageCircle, Copy, MessageSquareText, Share2, Info } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Label, Select, Badge } from '@/components/ui';
import { CrSectionSwitcher } from '@/components/CrSectionSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { useCrAssignment } from '@/hooks/useCrAssignment';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { createConcern, listConcerns } from '@/services/concerns';
import { supabase } from '@/lib/supabase';
import {
  generateReportMessage,
  getConfiguredCoordinators,
  buildWhatsAppLink,
  buildSmsLink,
  copyMessage,
  shareMessage,
  Coordinator,
} from '@/services/quickReports';
import { QUICK_REPORT_CATEGORIES, Student } from '@/types';
import clsx from 'clsx';

export default function QuickReport() {
  const { profile } = useAuth();
  const { assignment, loading } = useCrAssignment();
  const settings = useSystemSettings();

  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState('');
  const [category, setCategory] = useState(QUICK_REPORT_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [messageEdited, setMessageEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);

  const coordinators = useMemo(() => getConfiguredCoordinators(settings), [settings]);

  useEffect(() => {
    if (coordinators.length && !coordinator) setCoordinator(coordinators[0]);
  }, [coordinators, coordinator]);

  useEffect(() => {
    if (!assignment) return;
    setStudentId('');
    (async () => {
      const { data } = await supabase.from('students').select('*').eq('section_id', assignment.section_id).eq('status', 'ACTIVE').order('roll_number');
      setStudents((data as Student[]) ?? []);
      setHistory(await listConcerns({ sectionId: assignment.section_id }));
    })();
  }, [assignment]);

  const selectedStudent = students.find((s) => s.id === studentId);

  // Regenerate the message whenever the inputs change, unless the CR has
  // started editing it by hand — their edits are never silently overwritten.
  useEffect(() => {
    if (!selectedStudent || !assignment || !profile || messageEdited) return;
    setMessage(
      generateReportMessage({
        student: selectedStudent,
        className: assignment.classes?.name ?? '',
        sectionName: assignment.sections?.name ?? '',
        concernType: category,
        description,
        crName: profile.full_name,
        settings,
      })
    );
  }, [selectedStudent, assignment, profile, category, description, settings, messageEdited]);

  function resetForNextReport() {
    setStudentId('');
    setCategory(QUICK_REPORT_CATEGORIES[0]);
    setDescription('');
    setMessage('');
    setMessageEdited(false);
  }

  async function ensureSaved(): Promise<boolean> {
    if (!assignment || !profile || !selectedStudent) {
      toast.error('Please select a student first.');
      return false;
    }
    setSubmitting(true);
    try {
      await createConcern({
        studentId: selectedStudent.id,
        classId: assignment.class_id,
        sectionId: assignment.section_id,
        reportedBy: profile.id,
        concernType: category,
        shortDescription: description || category,
        additionalNotes: description || undefined,
      });
      setHistory(await listConcerns({ sectionId: assignment.section_id }));
      return true;
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save the report.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWhatsApp() {
    if (!coordinator) { toast.error('No coordinator WhatsApp number is configured. Ask a Super Admin to set one in Settings.'); return; }
    if (!(await ensureSaved())) return;
    window.open(buildWhatsAppLink(coordinator.whatsapp, message), '_blank', 'noopener,noreferrer');
    toast.success('Opened WhatsApp — press Send to deliver it.');
    resetForNextReport();
  }

  async function handleCopy() {
    try {
      await copyMessage(message);
      toast.success('Message copied.');
    } catch {
      toast.error('Could not copy — please select and copy the text manually.');
    }
  }

  async function handleSms() {
    if (!coordinator) { toast.error('No coordinator number is configured. Ask a Super Admin to set one in Settings.'); return; }
    if (!(await ensureSaved())) return;
    window.location.href = buildSmsLink(coordinator.whatsapp, message);
    resetForNextReport();
  }

  async function handleShare() {
    const result = await shareMessage(message, 'Student Report — Aspire Group of Colleges');
    if (result === 'unsupported') {
      await handleCopy();
      toast('Sharing isn\'t supported on this device — message copied instead.', { icon: 'ℹ️' });
      return;
    }
    await ensureSaved();
    resetForNextReport();
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
        <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">Quick Reports &amp; Messages</h1>
        <p className="text-sm text-slate-500">Prepare a professional report and forward it to the coordinator in seconds.</p>
        <div className="mt-2"><CrSectionSwitcher /></div>
      </div>

      <Card className="mb-6 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Class</Label>
            <div className="flex h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-600">{assignment.classes?.name}</div>
          </div>
          <div>
            <Label>Section</Label>
            <div className="flex h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-600">{assignment.sections?.name}</div>
          </div>
          <div>
            <Label>Student</Label>
            <Select value={studentId} onChange={(e) => { setStudentId(e.target.value); setMessageEdited(false); }}>
              <option value="">Select student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} (Roll #{s.roll_number})</option>)}
            </Select>
          </div>
        </div>

        {selectedStudent && (
          <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
            <div><span className="text-xs text-slate-400">Student Name</span><p className="text-sm font-semibold text-ink-900">{selectedStudent.full_name}</p></div>
            <div><span className="text-xs text-slate-400">Father Name</span><p className="text-sm font-semibold text-ink-900">{selectedStudent.father_name || '—'}</p></div>
            <div><span className="text-xs text-slate-400">Roll Number</span><p className="text-sm font-semibold text-ink-900">{selectedStudent.roll_number}</p></div>
            <div><span className="text-xs text-slate-400">Class / Section</span><p className="text-sm font-semibold text-ink-900">{assignment.classes?.name} — {assignment.sections?.name}</p></div>
          </div>
        )}

        <div className="mt-4">
          <Label>Concern Category</Label>
          <div className="flex flex-wrap gap-2">
            {QUICK_REPORT_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => { setCategory(c); setMessageEdited(false); }}
                className={clsx(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                  category === c ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Label>Details {category === 'Other' ? '' : '(optional)'}</Label>
          <textarea
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            rows={2}
            value={description}
            onChange={(e) => { setDescription(e.target.value); setMessageEdited(false); }}
            placeholder="Describe what happened…"
          />
        </div>

        {selectedStudent && (
          <div className="mt-4">
            <Label>Message Preview (editable before sending)</Label>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs leading-relaxed outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              rows={12}
              value={message}
              onChange={(e) => { setMessage(e.target.value); setMessageEdited(true); }}
            />

            {coordinators.length > 1 && (
              <div className="mt-3 flex items-center gap-2">
                <Label>Send To</Label>
                <Select value={coordinator?.whatsapp ?? ''} onChange={(e) => setCoordinator(coordinators.find((c) => c.whatsapp === e.target.value) ?? null)} className="max-w-xs">
                  {coordinators.map((c) => <option key={c.whatsapp} value={c.whatsapp}>{c.name}</option>)}
                </Select>
              </div>
            )}

            {!coordinators.length && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                <Info size={13} /> No coordinator WhatsApp number configured yet — ask a Super Admin to set one in Settings → Communication.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={handleWhatsApp} disabled={submitting} className="!bg-emerald-600 hover:!bg-emerald-700">
                <MessageCircle size={16} className="mr-1.5 inline" /> WhatsApp
              </Button>
              <Button onClick={handleCopy} className="!bg-slate-700 hover:!bg-slate-800">
                <Copy size={16} className="mr-1.5 inline" /> Copy Message
              </Button>
              <Button onClick={handleSms} disabled={submitting} className="!bg-sky-600 hover:!bg-sky-700">
                <MessageSquareText size={16} className="mr-1.5 inline" /> SMS / Message
              </Button>
              <Button onClick={handleShare} disabled={submitting} className="!bg-brand-600 hover:!bg-brand-700">
                <Share2 size={16} className="mr-1.5 inline" /> Share
              </Button>
            </div>
          </div>
        )}
      </Card>

      <h2 className="mb-3 text-lg font-bold text-ink-900">Recent Reports</h2>
      <Card className="divide-y divide-slate-100">
        {history.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-ink-900">{c.students?.full_name} (#{c.students?.roll_number})</p>
              <p className="text-sm text-slate-600">{c.concern_type}: {c.short_description}</p>
            </div>
            <div className="text-right">
              <Badge tone={c.status === 'RESOLVED' || c.status === 'CLOSED' ? 'green' : 'amber'}>{c.status}</Badge>
              <p className="mt-1 text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
        {!history.length && <div className="px-5 py-10 text-center text-slate-400">No reports sent yet.</div>}
      </Card>
    </DashboardLayout>
  );
}
