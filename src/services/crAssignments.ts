import { supabase } from '@/lib/supabase';
import { CrAssignment } from '@/types';

export async function listCrAssignments() {
  const { data, error } = await supabase
    .from('cr_assignments')
    .select('*, profiles!cr_assignments_cr_user_id_fkey(full_name,email), classes(name), sections(name)')
    .eq('is_active', true)
    .order('assigned_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function assignCr(input: {
  crUserId: string;
  classId: string;
  sectionId: string;
  assignedBy: string;
}) {
  // Deactivate any existing active CR for this section first (one CR per section).
  await supabase
    .from('cr_assignments')
    .update({ is_active: false })
    .eq('section_id', input.sectionId)
    .eq('is_active', true);

  const { data, error } = await supabase
    .from('cr_assignments')
    .insert({
      cr_user_id: input.crUserId,
      class_id: input.classId,
      section_id: input.sectionId,
      assigned_by: input.assignedBy,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CrAssignment;
}

export async function removeCr(assignmentId: string) {
  const { error } = await supabase.from('cr_assignments').update({ is_active: false }).eq('id', assignmentId);
  if (error) throw error;
}

export async function myAssignments(userId: string) {
  const { data, error } = await supabase
    .from('cr_assignments')
    .select('*, classes(name), sections(name)')
    .eq('cr_user_id', userId)
    .eq('is_active', true)
    .order('assigned_at', { ascending: false });
  if (error) throw error;
  return data;
}
