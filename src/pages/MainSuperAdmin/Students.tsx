import { useEffect, useState } from 'react';
import { Plus, Search, Upload, Download, Pencil, Trash2, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Select, Label, Badge, Modal } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { ClassRow, SectionRow, Student } from '@/types';
import { listClasses, listSections } from '@/services/academics';
import { listStudents, createStudent, updateStudent, deleteStudent } from '@/services/students';
import { exportStudentsToCsv, downloadCsvTemplate } from '@/services/csv';
import { logActivity } from '@/services/activityLog';
import { SmartImportWizard } from '@/components/students/SmartImportWizard';

export default function StudentsPage() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState({ full_name: '', father_name: '', roll_number: '', class_id: '', section_id: '', phone: '' });

  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    listClasses().then(setClasses);
    listSections().then(setSections);
  }, []);

  async function reload() {
    const { students, total } = await listStudents({
      search: search || undefined,
      classId: classFilter || undefined,
      sectionId: sectionFilter || undefined,
      page,
      pageSize,
    });
    setStudents(students);
    setTotal(total);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, classFilter, sectionFilter, page]);

  function openCreate() {
    setEditing(null);
    setForm({ full_name: '', father_name: '', roll_number: '', class_id: classes[0]?.id ?? '', section_id: '', phone: '' });
    setFormOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setForm({ full_name: s.full_name, father_name: s.father_name ?? '', roll_number: s.roll_number, class_id: s.class_id, section_id: s.section_id, phone: s.phone ?? '' });
    setFormOpen(true);
  }

  async function submitForm() {
    if (!form.full_name || !form.roll_number || !form.class_id || !form.section_id) {
      toast.error('Please fill all required fields.');
      return;
    }
    try {
      if (editing) {
        await updateStudent(editing.id, { ...form, father_name: form.father_name || null, phone: form.phone || null });
        await logActivity({
          adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
          action: 'Student Edited', target: form.full_name, description: `Edited student ${form.full_name} (Roll ${form.roll_number}).`,
        });
        toast.success('Student updated successfully.');
      } else {
        await createStudent({
          ...form,
          father_name: form.father_name || null,
          phone: form.phone || null,
          status: 'ACTIVE',
          user_id: null,
          student_uid: null,
          session_label: null,
        });
        await logActivity({
          adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
          action: 'Student Created', target: form.full_name, description: `Added student ${form.full_name} (Roll ${form.roll_number}).`,
        });
        toast.success('Student added successfully.');
      }
      setFormOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save student.');
    }
  }

  async function handleDelete(s: Student) {
    if (!confirm(`Delete ${s.full_name}? This cannot be undone.`)) return;
    try {
      await deleteStudent(s.id);
      await logActivity({
        adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
        action: 'Student Deleted', target: s.full_name, description: `Deleted student ${s.full_name} (Roll ${s.roll_number}).`,
      });
      toast.success('Student deleted.');
      reload();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to delete student.');
    }
  }

  async function handleImportComplete() {
    reload();
    listClasses().then(setClasses);
    listSections().then(setSections);
  }

  async function handleExport() {
    const { students: all } = await listStudents({ classId: classFilter || undefined, sectionId: sectionFilter || undefined, pageSize: 5000 });
    exportStudentsToCsv(all, classes, sections);
    await logActivity({
      adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role,
      action: 'CSV Exported', target: `${all.length} students`, description: `Exported ${all.length} students to CSV.`,
    });
  }

  const formSections = sections.filter((s) => s.class_id === form.class_id);

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">Students</h1>
          <p className="mt-1 text-sm text-[var(--text-2)]">Manage student records across all classes and sections.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadCsvTemplate()}>
            <FileDown size={16} /> Download Template
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setImportFile(f);
                e.target.value = '';
              }}
            />
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 hover:bg-slate-50">
              <Upload size={16} /> Import CSV
            </span>
          </label>
          <Button variant="secondary" onClick={handleExport}><Download size={16} /> Export CSV</Button>
          <Button onClick={openCreate}><Plus size={16} /> Add Student</Button>
        </div>
      </div>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <Input className="pl-9" placeholder="Search by name or roll number…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
          </div>
          <Select value={classFilter} onChange={(e) => { setPage(1); setClassFilter(e.target.value); setSectionFilter(''); }}>
            <option value="">All Classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={sectionFilter} onChange={(e) => { setPage(1); setSectionFilter(e.target.value); }}>
            <option value="">All Sections</option>
            {sections.filter((s) => !classFilter || s.class_id === classFilter).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-[#F4F7FC] text-left text-xs font-semibold tracking-wide text-[#5B6B83]">
            <tr>
              <th className="px-4 py-3">Roll #</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium">{s.roll_number}</td>
                <td className="px-4 py-3">{s.full_name}</td>
                <td className="px-4 py-3 text-slate-500">{classes.find((c) => c.id === s.class_id)?.name}</td>
                <td className="px-4 py-3 text-slate-500">{sections.find((sec) => sec.id === s.section_id)?.name}</td>
                <td className="px-4 py-3"><Badge tone={s.status === 'ACTIVE' ? 'green' : 'slate'}>{s.status}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(s)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!students.length && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No students found.</td></tr>
            )}
          </tbody>
        </table></div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>{total} student{total !== 1 ? 's' : ''} total</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="secondary" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>

      {/* Add / Edit Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Student' : 'Add Student'}>
        <div className="space-y-3">
          <div><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>Father Name</Label><Input value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} /></div>
          <div><Label>Roll Number</Label><Input value={form.roll_number} onChange={(e) => setForm({ ...form, roll_number: e.target.value })} /></div>
          <div>
            <Label>Class</Label>
            <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, section_id: '' })}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Section</Label>
            <Select value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })}>
              <option value="">Select section</option>
              {formSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <Button className="w-full" onClick={submitForm}>{editing ? 'Save Changes' : 'Add Student'}</Button>
        </div>
      </Modal>

      {/* Smart CSV Import Wizard */}
      <SmartImportWizard
        file={importFile}
        open={!!importFile}
        onClose={() => setImportFile(null)}
        classes={classes}
        sections={sections}
        adminName={profile?.full_name ?? 'Admin'}
        onComplete={handleImportComplete}
      />
    </DashboardLayout>
  );
}
