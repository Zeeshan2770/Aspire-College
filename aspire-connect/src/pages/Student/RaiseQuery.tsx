import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';
import { StudentLayout } from '@/components/layout/StudentLayout';
import { Button, Card, Label } from '@/components/ui';
import { raiseConcern } from '@/services/concerns';
import { STUDENT_QUERY_CATEGORIES } from '@/types';
import { useOptions } from '@/components/OptionSelect';
import clsx from 'clsx';

export default function StudentRaiseQuery() {
  const navigate = useNavigate();
  const { options } = useOptions('student_query_category');
  const categories = options.length ? options.map((o) => o.label) : STUDENT_QUERY_CATEGORIES;
  const [picked, setCategory] = useState('');
  const category = picked && categories.includes(picked) ? picked : categories[0];
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!subject.trim()) { toast.error('Please enter a subject for your query.'); return; }
    setSubmitting(true);
    try {
      // scope/student_id/class_id/section_id are all forced server-side to
      // the caller's own record (see create_concern in
      // 0015_student_portal.sql) — nothing sent from here can put this
      // query under a different student.
      await raiseConcern({ category, subject: subject.trim(), description: description.trim() || undefined });
      toast.success('Query submitted. You can track its status under My Queries.');
      navigate('/student/queries');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to submit your query.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StudentLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink-900">Raise a Query</h1>
        <p className="text-sm text-slate-500">Your query goes straight to the Main Super Admin, authorized Sub Super Admins, and the Principal.</p>
      </div>

      <Card className="p-5">
        <div className="mb-4">
          <Label>Category</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
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

        <div className="mb-4">
          <Label>Subject</Label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="A short summary of your query"
            maxLength={120}
          />
        </div>

        <div className="mb-5">
          <Label>Description</Label>
          <textarea
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your query in detail…"
          />
        </div>

        <Button onClick={submit} disabled={submitting} className="w-full">
          <Send size={16} className="mr-1.5 inline" /> {submitting ? 'Submitting…' : 'Submit Query'}
        </Button>
      </Card>
    </StudentLayout>
  );
}
