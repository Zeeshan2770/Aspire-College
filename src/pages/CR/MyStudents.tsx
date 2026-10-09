import { useEffect, useState } from 'react';
import { Search, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, Input, Badge, Button, Label, Modal } from '@/components/ui';
import { CrSectionSwitcher } from '@/components/CrSectionSwitcher';
import { useCrAssignment } from '@/hooks/useCrAssignment';
import { studentAttendanceStats } from '@/services/attendance';
import { createStudent, deleteStudent } from '@/services/students';
import { supabase } from '@/lib/supabase';
import { Student } from '@/types';

export default function MyStudents() {
  const { assignment, loading } = useCrAssignment();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<Record<string, number>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', roll_number: '', phone: '' });

  async function reload() {
    if (!assignment) return;
    const { data } = await supabase.from('students').select('*').eq('section_id', assignment.section_id).order('roll_number');
    setStudents((data as Student[]) ?? []);
    const entries = await Promise.all(
      (data ?? []).map(async (s: Student) => [s.id, (await studentAttendanceStats(s.id)).percentage] as const)
    );
    setStats(Object.fromEntries(entries));
  }

  useEffect(() => {
    let cancelled = false;
    setStudents([]);
    (async () => {
      if (!assignment) return;
      const { data } = await supabase.from('students').select('*').eq('section_id', assignment.section_id).order('roll_number');
      if (cancelled) return;
      setStudents((data as Student[]) ?? []);
      const entries = await Promise.all(
        (data ?? []).map(async (s: Student) => [s.id, (await studentAttendanceStats(s.id)).percentage] as const)
      );
      if (cancelled) return;
      setStats(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [assignment]);

  const filtered = students.filter(
    (s) => s.full_name.toLowerCase().includes(search.toLowerCase()) || s.roll_number.includes(search)
  );

  function openAdd() {
    setForm({ full_name: '', roll_number: '', phone: '' });
    setAddOpen(true);
  }

  async function submitAdd() {
    if (!assignment) return;
    if (!form.full_name.trim() || !form.roll_number.trim()) {
      toast.error('Please fill in name and roll number.');
      return;
    }
    setSaving(true);
    try {
      // class_id/section_id are always taken from the CR's own active
      // assignment, never from user input — the database policy enforces
      // this too, but keeping it out of the form avoids any confusion
      // about which section a new student lands in.
      await createStudent({
        full_name: form.full_name.trim(),
        father_name: null,
        roll_number: form.roll_number.trim(),
        phone: form.phone.trim() || null,
        class_id: assignment.class_id,
        section_id: assignment.section_id,
        status: 'ACTIVE',
        user_id: null,
        student_uid: null,
        session_label: null,
      });
      toast.success('Student added.');
      setAddOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to add student.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(s: Student) {
    if (!confirm(`Remove ${s.full_name} from your section? This also deletes their attendance history and cannot be undone.`)) return;
    try {
      await deleteStudent(s.id);
      toast.success('Student removed.');
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to remove student.');
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
        <h1 className="text-2xl font-extrabold text-ink-900">My Students</h1>
        <div className="mt-2"><CrSectionSwitcher /></div>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input className="pl-9" placeholder="Search by name or roll number…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={openAdd}><Plus size={16} /> Add Student</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Roll #</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Attendance</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium">{s.roll_number}</td>
                <td className="px-4 py-3">{s.full_name}</td>
                <td className="px-4 py-3 text-slate-500">{s.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge tone={stats[s.id] >= 75 ? 'green' : stats[s.id] >= 50 ? 'amber' : 'red'}>{stats[s.id] ?? 0}%</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button onClick={() => handleRemove(s)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" title="Remove student">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No students found.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Student">
        <div className="space-y-3">
          <div><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>Roll Number</Label><Input value={form.roll_number} onChange={(e) => setForm({ ...form, roll_number: e.target.value })} /></div>
          <div><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <p className="text-xs text-slate-400">
            Adds to {assignment.classes?.name} — {assignment.sections?.name}.
          </p>
          <Button className="w-full" disabled={saving} onClick={submitAdd}>{saving ? 'Adding…' : 'Add Student'}</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
