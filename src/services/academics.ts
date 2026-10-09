import { supabase } from '@/lib/supabase';
import { ClassRow, SectionRow } from '@/types';

export async function listClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase.from('classes').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function listSections(classId?: string): Promise<SectionRow[]> {
  let query = supabase.from('sections').select('*').order('name');
  if (classId) query = query.eq('class_id', classId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createClass(name: string): Promise<ClassRow> {
  const { data, error } = await supabase.from('classes').insert({ name }).select().single();
  if (error) throw error;
  return data;
}

export async function createSection(classId: string, name: string): Promise<SectionRow> {
  const { data, error } = await supabase
    .from('sections')
    .insert({ class_id: classId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Renames an existing class. Existing students/sections stay linked (same id),
 * so this is the safe way to fix a class name that doesn't match the CSV.
 */
export async function updateClass(id: string, name: string): Promise<ClassRow> {
  const { data, error } = await supabase.from('classes').update({ name }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/**
 * Renames an existing section. Existing students stay linked (same id),
 * so this is the safe way to fix a section name that doesn't match the CSV.
 */
export async function updateSection(id: string, name: string): Promise<SectionRow> {
  const { data, error } = await supabase.from('sections').update({ name }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteClass(id: string) {
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteSection(id: string) {
  const { error } = await supabase.from('sections').delete().eq('id', id);
  if (error) throw error;
}
