import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Label, Modal, Select, Spinner } from '@/components/ui';
import { OptionSelect } from '@/components/OptionSelect';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/services/activityLog';
import {
  ClassSubject, FacultyOption, SectionSubjectTeacher, SectionTeacher, addClassSubject, addSectionTeacher, loadClassAcademics,
  removeClassSubject, removeSectionTeacher, setClassTeacher, setSubjectTeacher,
} from '@/services/classAcademics';

type Data = { sections: SectionTeacher[]; subjects: ClassSubject[]; faculty: FacultyOption[]; sectionTeachers: SectionSubjectTeacher[] | null };

/** Teachers of a class: the subjects it has, and for every section its class teacher plus any number of subject teachers. */
export default function ClassAcademicsModal({ classId, className, onClose }: { classId: string; className: string; onClose: () => void }) {
  const { profile } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [subjectFaculty, setSubjectFaculty] = useState('');
  const [busy, setBusy] = useState(false);
  // The "add a teacher" form of each section: chosen subject and teacher, keyed by section id.
  const [draft, setDraft] = useState<Record<string, { subject: string; faculty: string }>>({});

  const load = useCallback(() => {
    setError(null);
    loadClassAcademics(classId).then(setData).catch((e) => setError(e.message));
  }, [classId]);
  useEffect(load, [load]);

  const log = (action: string, target: string, description: string) =>
    logActivity({ adminId: profile!.id, adminName: profile!.full_name, adminRole: profile!.role, action, target, description });
  const facultyName = (id: string | null) => data?.faculty.find((f) => f.id === id)?.full_name ?? 'nobody';
  const subjectLabel = (id: string) => data?.subjects.find((s) => s.subject_id === id)?.subjects?.name ?? 'Subject';

  async function run(fn: () => Promise<void>, ok?: string) {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); load(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const options = (
    <>
      <option value="">Not assigned</option>
      {data?.faculty.map((f) => <option key={f.id} value={f.id}>{f.full_name}{f.designation ? ` (${f.designation})` : ''}</option>)}
    </>
  );

  return (
    <Modal open onClose={onClose} title={`${className}: teachers & subjects`} wide>
      {error ? (
        <p role="alert" className="text-sm text-red-700">{error} <button className="underline" onClick={load}>Retry</button></p>
      ) : !data ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
          {!data.faculty.length && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">No active faculty yet. Add faculty first to assign teachers.</p>}

          <section>
            <h4 className="mb-1 text-sm font-bold text-slate-700">1. Subjects of {className}</h4>
            <p className="mb-3 text-xs text-slate-500">Add the subjects first. The teacher chosen here is optional and is the default for the whole class.</p>
            {!data.subjects.length ? <p className="mb-3 text-sm text-slate-500">No subjects have been added to this class yet.</p> : (
              <ul className="mb-3 space-y-2">
                {data.subjects.map((cs) => (
                  <li key={cs.subject_id} className="grid items-center gap-2 sm:grid-cols-[10rem_1fr_auto]">
                    <span className="text-sm font-medium text-ink-900">{cs.subjects?.name}</span>
                    <Select aria-label={`Default teacher for ${cs.subjects?.name}`} disabled={busy} value={cs.faculty_id ?? ''}
                      onChange={(e) => run(async () => {
                        const id = e.target.value || null;
                        await setSubjectTeacher(classId, cs.subject_id, id);
                        await log('Subject Teacher Assigned', `${className}: ${cs.subjects?.name}`, `Set ${cs.subjects?.name} teacher of ${className} to ${facultyName(id)}.`);
                      }, 'Saved.')}>{options}</Select>
                    <Button size="sm" variant="ghost" aria-label={`Remove ${cs.subjects?.name}`} disabled={busy}
                      onClick={() => { if (!window.confirm(`Remove ${cs.subjects?.name} from ${className}? Its section teachers are removed too.`)) return;
                        run(async () => { await removeClassSubject(classId, cs.subject_id); await log('Subject Removed', className, `Removed ${cs.subjects?.name} from ${className}.`); }, 'Subject removed.'); }}>
                      <Trash2 size={14} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid items-end gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_auto]">
              <div><Label>Add subject</Label><OptionSelect category="faculty_subject" title="Subject" placeholder="Select subject" canManage value={subjectName} onChange={setSubjectName} /></div>
              <div><Label>Default teacher (optional)</Label><Select value={subjectFaculty} onChange={(e) => setSubjectFaculty(e.target.value)}>{options}</Select></div>
              <Button disabled={busy || !subjectName.trim()}
                onClick={() => run(async () => {
                  await addClassSubject(classId, subjectName, subjectFaculty || null);
                  await log('Subject Added', className, `Added ${subjectName.trim()} to ${className}.`);
                  setSubjectName(''); setSubjectFaculty('');
                }, 'Subject added.')}><Plus size={14} /> Add</Button>
            </div>
          </section>

          <section>
            <h4 className="mb-1 text-sm font-bold text-slate-700">2. Teachers of each section</h4>
            <p className="mb-3 text-xs text-slate-500">
              Every section has its own teachers. Choose the class teacher (in charge), then add as many subject teachers as the section has. A subject can have more than one teacher in a section.
            </p>
            {!data.sections.length ? <p className="text-sm text-slate-500">This class has no sections yet.</p> : (
              <div className="space-y-4">
                {data.sections.map((sec) => {
                  const rows = (data.sectionTeachers ?? []).filter((r) => r.section_id === sec.id)
                    .sort((a, b) => subjectLabel(a.subject_id).localeCompare(subjectLabel(b.subject_id)) || facultyName(a.faculty_id).localeCompare(facultyName(b.faculty_id)));
                  const d = draft[sec.id] ?? { subject: '', faculty: '' };
                  const setD = (v: Partial<typeof d>) => setDraft((x) => ({ ...x, [sec.id]: { ...d, ...v } }));
                  return (
                    <div key={sec.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h5 className="text-sm font-bold text-ink-900">Section {sec.name}</h5>
                        <span className="text-xs text-slate-500">{rows.length} subject teacher{rows.length === 1 ? '' : 's'}</span>
                      </div>

                      <div className="mb-3 grid items-center gap-2 sm:grid-cols-[10rem_1fr]">
                        <span className="text-sm text-slate-600">Class teacher (in charge)</span>
                        <Select aria-label={`Class teacher for section ${sec.name}`} disabled={busy} value={sec.class_teacher_id ?? ''}
                          onChange={(e) => run(async () => {
                            const id = e.target.value || null;
                            await setClassTeacher(sec.id, id);
                            await log('Class Teacher Assigned', `${className} ${sec.name}`, `Set class teacher of ${className} ${sec.name} to ${facultyName(id)}.`);
                          }, 'Class teacher saved.')}>{options}</Select>
                      </div>

                      {data.sectionTeachers === null ? (
                        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Subject teachers for sections are not switched on yet. The administrator needs to run the 0023 database script once.
                        </p>
                      ) : (
                        <>
                          {rows.length === 0 ? <p className="mb-2 text-sm text-slate-500">No subject teachers added for this section yet.</p> : (
                            <ul className="mb-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
                              {rows.map((r) => (
                                <li key={`${r.subject_id}-${r.faculty_id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                                  <span><span className="font-medium text-ink-900">{subjectLabel(r.subject_id)}</span> <span className="text-slate-500">·</span> {facultyName(r.faculty_id)}</span>
                                  <button type="button" disabled={busy} aria-label={`Remove ${facultyName(r.faculty_id)} from ${subjectLabel(r.subject_id)} in section ${sec.name}`}
                                    className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                    onClick={() => run(async () => {
                                      await removeSectionTeacher(sec.id, r.subject_id, r.faculty_id);
                                      await log('Section Teacher Removed', `${className} ${sec.name}: ${subjectLabel(r.subject_id)}`, `Removed ${facultyName(r.faculty_id)} as ${subjectLabel(r.subject_id)} teacher of ${className} ${sec.name}.`);
                                    }, 'Teacher removed.')}><X size={14} /></button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {!data.subjects.length ? <p className="text-xs text-slate-500">Add subjects in step 1 to assign their teachers.</p> : (
                            <div className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
                              <div><Label>Subject</Label>
                                <Select aria-label={`Subject for section ${sec.name}`} value={d.subject} onChange={(e) => setD({ subject: e.target.value })}>
                                  <option value="">Select subject</option>
                                  {data.subjects.map((cs) => <option key={cs.subject_id} value={cs.subject_id}>{cs.subjects?.name}</option>)}
                                </Select></div>
                              <div><Label>Teacher</Label>
                                <Select aria-label={`Teacher for section ${sec.name}`} value={d.faculty} onChange={(e) => setD({ faculty: e.target.value })}>
                                  <option value="">Select teacher</option>
                                  {data.faculty.map((f) => <option key={f.id} value={f.id}>{f.full_name}{f.designation ? ` (${f.designation})` : ''}</option>)}
                                </Select></div>
                              <Button disabled={busy || !d.subject || !d.faculty}
                                onClick={() => run(async () => {
                                  await addSectionTeacher(sec.id, d.subject, d.faculty);
                                  await log('Section Teacher Assigned', `${className} ${sec.name}: ${subjectLabel(d.subject)}`, `Added ${facultyName(d.faculty)} as ${subjectLabel(d.subject)} teacher of ${className} ${sec.name}.`);
                                  setD({ faculty: '' });
                                }, 'Teacher added.')}><Plus size={14} /> Add</Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
