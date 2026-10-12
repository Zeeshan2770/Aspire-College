import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Label, Modal } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { ClassRow, SectionRow } from '@/types';
import {
  listClasses,
  listSections,
  createClass,
  createSection,
  updateClass,
  updateSection,
  deleteClass,
  deleteSection,
} from '@/services/academics';
import { logActivity } from '@/services/activityLog';
import ClassAcademicsModal from './ClassAcademicsModal';

type ClassModalState = { open: boolean; mode: 'add' | 'edit'; target?: ClassRow };
type SectionModalState = { open: boolean; mode: 'add' | 'edit'; classId: string; target?: SectionRow };

export default function ClassesPage() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [classModal, setClassModal] = useState<ClassModalState>({ open: false, mode: 'add' });
  const [sectionModal, setSectionModal] = useState<SectionModalState>({ open: false, mode: 'add', classId: '' });
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [academicsFor, setAcademicsFor] = useState<ClassRow | null>(null);

  async function reload() {
    setClasses(await listClasses());
    setSections(await listSections());
  }
  useEffect(() => { reload(); }, []);

  function openAddClass() {
    setNameInput('');
    setClassModal({ open: true, mode: 'add' });
  }
  function openEditClass(c: ClassRow) {
    setNameInput(c.name);
    setClassModal({ open: true, mode: 'edit', target: c });
  }
  function openAddSection(classId: string) {
    setNameInput('');
    setSectionModal({ open: true, mode: 'add', classId });
  }
  function openEditSection(s: SectionRow) {
    setNameInput(s.name);
    setSectionModal({ open: true, mode: 'edit', classId: s.class_id, target: s });
  }

  async function saveClass() {
    const name = nameInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      if (classModal.mode === 'edit' && classModal.target) {
        const before = classModal.target.name;
        await updateClass(classModal.target.id, name);
        await logActivity({
          adminId: profile!.id,
          adminName: profile!.full_name,
          adminRole: profile!.role,
          action: 'Class Renamed',
          target: name,
          description: `Renamed class "${before}" to "${name}". Students already linked to this class stay linked automatically.`,
        });
        toast.success('Class renamed. Linked students are unaffected.');
      } else {
        await createClass(name);
        await logActivity({
          adminId: profile!.id,
          adminName: profile!.full_name,
          adminRole: profile!.role,
          action: 'Class Created',
          target: name,
          description: `Created class ${name}.`,
        });
        toast.success('Class created.');
      }
      setClassModal({ open: false, mode: 'add' });
      setNameInput('');
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save class.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSection() {
    const name = nameInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      if (sectionModal.mode === 'edit' && sectionModal.target) {
        const before = sectionModal.target.name;
        await updateSection(sectionModal.target.id, name);
        const cls = classes.find((c) => c.id === sectionModal.classId);
        await logActivity({
          adminId: profile!.id,
          adminName: profile!.full_name,
          adminRole: profile!.role,
          action: 'Section Renamed',
          target: name,
          description: `Renamed section "${before}" to "${name}" in ${cls?.name}. Students already linked to this section stay linked automatically.`,
        });
        toast.success('Section renamed. Linked students are unaffected.');
      } else {
        await createSection(sectionModal.classId, name);
        const cls = classes.find((c) => c.id === sectionModal.classId);
        await logActivity({
          adminId: profile!.id,
          adminName: profile!.full_name,
          adminRole: profile!.role,
          action: 'Section Created',
          target: name,
          description: `Created section ${name} in ${cls?.name}.`,
        });
        toast.success('Section created.');
      }
      setSectionModal({ open: false, mode: 'add', classId: '' });
      setNameInput('');
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save section.');
    } finally {
      setSaving(false);
    }
  }

  async function removeClass(c: ClassRow) {
    if (!confirm(`Delete class "${c.name}"? All its sections must be removed first.`)) return;
    try {
      await deleteClass(c.id);
      toast.success('Class deleted.');
      reload();
    } catch (e: any) {
      toast.error('Cannot delete: class has students or sections linked to it.');
    }
  }

  async function removeSection(s: SectionRow) {
    if (!confirm(`Delete section "${s.name}"?`)) return;
    try {
      await deleteSection(s.id);
      toast.success('Section deleted.');
      reload();
    } catch (e: any) {
      toast.error('Cannot delete: section has students linked to it.');
    }
  }

  const classModalTitle = classModal.mode === 'edit' ? 'Rename Class' : 'Add Class';
  const sectionModalTitle = sectionModal.mode === 'edit' ? 'Rename Section' : 'Add Section';

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">Classes & Sections</h1>
          <p className="text-sm text-slate-500">
            Organize the academic structure used across the system. If a CSV import doesn&rsquo;t match, rename a class
            or section here instead of deleting it &mdash; linked students stay attached automatically.
          </p>
        </div>
        <Button onClick={openAddClass}><Plus size={16} /> Add Class</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {classes.map((c) => (
          <Card key={c.id} className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-ink-900">{c.name}</h3>
                <button
                  onClick={() => openEditClass(c)}
                  title="Rename class"
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                >
                  <Pencil size={13} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setAcademicsFor(c)}>
                  Teachers &amp; subjects
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openAddSection(c.id)}>
                  <Plus size={14} /> Section
                </Button>
                <button onClick={() => removeClass(c)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {sections.filter((s) => s.class_id === c.id).map((s) => (
                <span key={s.id} className="group flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                  {s.name}
                  <button onClick={() => openEditSection(s)} title="Rename section" className="opacity-50 hover:opacity-100"><Pencil size={11} /></button>
                  <button onClick={() => removeSection(s)} title="Delete section" className="opacity-50 hover:opacity-100"><Trash2 size={11} /></button>
                </span>
              ))}
              {!sections.filter((s) => s.class_id === c.id).length && (
                <span className="text-xs text-slate-400">No sections yet.</span>
              )}
            </div>
          </Card>
        ))}
        {!classes.length && <Card className="p-8 text-center text-slate-400">No classes yet. Add your first class to get started.</Card>}
      </div>

      <Modal open={classModal.open} onClose={() => setClassModal({ open: false, mode: 'add' })} title={classModalTitle}>
        <Label>Class Name</Label>
        <Input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="e.g. ICS Part II"
          onKeyDown={(e) => e.key === 'Enter' && saveClass()}
          autoFocus
        />
        {classModal.mode === 'edit' && (
          <p className="mt-2 text-xs text-slate-400">
            This updates the name everywhere it&rsquo;s used. Students already in this class stay linked &mdash; make
            sure the new name matches what your CSV file uses in its Class column.
          </p>
        )}
        <Button className="mt-4 w-full" onClick={saveClass} disabled={saving}>
          {classModal.mode === 'edit' ? 'Save Changes' : 'Add Class'}
        </Button>
      </Modal>

      <Modal open={sectionModal.open} onClose={() => setSectionModal({ open: false, mode: 'add', classId: '' })} title={sectionModalTitle}>
        <Label>Section Name</Label>
        <Input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="e.g. Diamond"
          onKeyDown={(e) => e.key === 'Enter' && saveSection()}
          autoFocus
        />
        {sectionModal.mode === 'edit' && (
          <p className="mt-2 text-xs text-slate-400">
            This updates the name everywhere it&rsquo;s used. Students already in this section stay linked &mdash; make
            sure the new name matches what your CSV file uses in its Section column.
          </p>
        )}
        <Button className="mt-4 w-full" onClick={saveSection} disabled={saving}>
          {sectionModal.mode === 'edit' ? 'Save Changes' : 'Add Section'}
        </Button>
      </Modal>
      {academicsFor && <ClassAcademicsModal classId={academicsFor.id} className={academicsFor.name} onClose={() => setAcademicsFor(null)} />}
    </DashboardLayout>
  );
}
