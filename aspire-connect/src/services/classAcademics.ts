import { supabase } from '@/lib/supabase';

export interface FacultyOption { id: string; full_name: string; designation: string | null }
export interface SectionTeacher { id: string; name: string; class_teacher_id: string | null }
export interface ClassSubject { subject_id: string; faculty_id: string | null; subjects: { name: string } | null }
/** A teacher for one subject in one section (overrides the class-wide teacher of that subject). */
export interface SectionSubjectTeacher { section_id: string; subject_id: string; faculty_id: string }

export async function loadClassAcademics(classId: string) {
  const [sec, sub, fac, sst] = await Promise.all([
    supabase.from('sections').select('id, name, class_teacher_id').eq('class_id', classId).order('name'),
    supabase.from('class_subjects').select('subject_id, faculty_id, subjects(name)').eq('class_id', classId),
    supabase.from('faculty').select('id, full_name, designation').eq('status', 'ACTIVE').order('full_name').range(0, 499),
    supabase.from('section_subject_teachers').select('section_id, subject_id, faculty_id'),
  ]);
  if (sec.error || sub.error || fac.error) throw new Error('Unable to load class details. Please try again.');
  const subjects = ((sub.data ?? []) as unknown as ClassSubject[]).sort((a, b) => (a.subjects?.name ?? '').localeCompare(b.subjects?.name ?? ''));
  const sectionIds = new Set(((sec.data ?? []) as SectionTeacher[]).map((x) => x.id));
  // If the section-teacher table has not been created yet, the rest of the screen still works.
  const sectionTeachers = sst.error ? null : ((sst.data ?? []) as SectionSubjectTeacher[]).filter((r) => sectionIds.has(r.section_id));
  return { sections: (sec.data ?? []) as SectionTeacher[], subjects, faculty: (fac.data ?? []) as FacultyOption[], sectionTeachers };
}

export async function setClassTeacher(sectionId: string, facultyId: string | null) {
  const { error } = await supabase.from('sections').update({ class_teacher_id: facultyId }).eq('id', sectionId);
  if (error) throw new Error('Unable to save the class teacher. You may not have permission to manage sections.');
}

export async function addClassSubject(classId: string, subjectName: string, facultyId: string | null) {
  const name = subjectName.trim();
  if (!name) throw new Error('Enter a subject name.');
  // Reuse an existing subject (case-insensitive) or create it.
  const { data: found } = await supabase.from('subjects').select('id').ilike('name', name.replace(/[%_\\]/g, (c) => `\\${c}`)).maybeSingle();
  let subjectId = found?.id as string | undefined;
  if (!subjectId) {
    const { data: created, error } = await supabase.from('subjects').insert({ name }).select('id').single();
    if (error || !created) throw new Error('Unable to create the subject. You may not have permission to manage classes.');
    subjectId = created.id as string;
  }
  const { error } = await supabase.from('class_subjects').insert({ class_id: classId, subject_id: subjectId, faculty_id: facultyId });
  if (error) throw new Error(error.code === '23505' ? 'This subject is already added to the class.' : 'Unable to add the subject.');
}

export async function setSubjectTeacher(classId: string, subjectId: string, facultyId: string | null) {
  const { error } = await supabase.from('class_subjects').update({ faculty_id: facultyId }).eq('class_id', classId).eq('subject_id', subjectId);
  if (error) throw new Error('Unable to save the subject teacher.');
}

/** Adds a teacher for a subject in a section. A section can have many teachers, and a subject can have more than one. */
export async function addSectionTeacher(sectionId: string, subjectId: string, facultyId: string) {
  const { error } = await supabase.from('section_subject_teachers').insert({ section_id: sectionId, subject_id: subjectId, faculty_id: facultyId });
  if (error) throw new Error(error.code === '23505' ? 'This teacher is already assigned to this subject in the section.' : 'Unable to add the teacher. You may not have permission to manage classes.');
}

export async function removeSectionTeacher(sectionId: string, subjectId: string, facultyId: string) {
  const { error } = await supabase.from('section_subject_teachers').delete().eq('section_id', sectionId).eq('subject_id', subjectId).eq('faculty_id', facultyId);
  if (error) throw new Error('Unable to remove the teacher.');
}

export async function removeClassSubject(classId: string, subjectId: string) {
  const { error } = await supabase.from('class_subjects').delete().eq('class_id', classId).eq('subject_id', subjectId);
  if (error) throw new Error('Unable to remove the subject.');
}
