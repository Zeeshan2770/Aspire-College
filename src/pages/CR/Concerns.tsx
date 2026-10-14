import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Label, Select, Badge } from '@/components/ui';
import { CrSectionSwitcher } from '@/components/CrSectionSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { useCrAssignment } from '@/hooks/useCrAssignment';
import { createConcern, listConcerns } from '@/services/concerns';
import { supabase } from '@/lib/supabase';
import { QUICK_CONCERNS, Student } from '@/types';
import clsx from 'clsx';

export default function Concerns() {
  const { profile } = useAuth();
  const { assignment, loading } = useCrAssignment();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState('');
  const [quick, setQuick] = useState(QUICK_CONCERNS[0].label);
  const [customText, setCustomText] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!assignment) return;
    setStudentId('');
    (async () => {
      const { data } = await supabase.from('students').select('*').eq('section_id', assignment.section_id).order('roll_number');
      setStudents((data as Student[]) ?? []);
      setHistory(await listConcerns({ sectionId: assignment.section_id }));
    })();
  }, [assignment]);

  const selectedStudent = students.find((s) => s.id === studentId);

  async function handleSubmit() {
    if (!assignment || !profile || !studentId) {
      toast.error('Please select a student.');
      return;
    }
    const isOther = quick === 'Other';
    const shortDescription = isOther ? customText.trim() : QUICK_CONCERNS.find((q) => q.label === quick)!.short_description;
    if (isOther && !shortDescription) {
      toast.error('Please describe the concern.');
      return;
    }
    setSubmitting(true);
    try {
      await createConcern({
        studentId, classId: assignment.class_id, sectionId: assignment.section_id,
        reportedBy: profile.id, concernType: quick, shortDescription, additionalNotes: notes || undefined,
      });
      toast.success('Student concern submitted.');
      setStudentId(''); setCustomText(''); setNotes('');
      setHistory(await listConcerns({ sectionId: assignment.section_id }));
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to submit concern.');
    } finally {
      setSubmitting(false);
    }
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
        <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">Report Student Concern</h1>
        <div className="mt-2"><CrSectionSwitcher /></div>
      </div>

      <Card className="mb-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Student</Label>
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Select student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} (Roll #{s.roll_number})</option>)}
            </Select>
          </div>
          <div>
            <Label>Roll Number</Label>
            <div className="flex h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-600">
              {selectedStudent?.roll_number ?? 'Automatically displayed'}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Label>Quick Concern</Label>
          <div className="flex flex-wrap gap-2">
            {QUICK_CONCERNS.map((q) => (
              <button
                key={q.label}
                onClick={() => setQuick(q.label)}
                className={clsx(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                  quick === q.label ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {quick === 'Other' && (
          <div className="mt-4">
            <Label>Custom Concern</Label>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              rows={2}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Describe the concern…"
            />
          </div>
        )}

        <div className="mt-4">
          <Label>Additional Notes (optional)</Label>
          <textarea
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <Button className="mt-5" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Concern'}</Button>
      </Card>

      <h2 className="mb-3 text-lg font-bold text-ink-900">Recent Concerns</h2>
      <Card className="divide-y divide-slate-100">
        {history.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-ink-900">{c.students?.full_name} (#{c.students?.roll_number})</p>
              <p className="text-sm text-slate-600">{c.short_description}</p>
              {c.additional_notes && <p className="text-xs text-slate-500">{c.additional_notes}</p>}
            </div>
            <div className="text-right">
              <Badge tone={c.status === 'RESOLVED' || c.status === 'CLOSED' ? 'green' : 'amber'}>{c.status}</Badge>
              <p className="mt-1 text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
        {!history.length && <div className="px-5 py-10 text-center text-slate-500">No concerns reported yet.</div>}
      </Card>
    </DashboardLayout>
  );
}
