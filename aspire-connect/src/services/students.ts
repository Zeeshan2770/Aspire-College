import { supabase } from '@/lib/supabase';
import { Student } from '@/types';

export interface StudentQuery {
  search?: string;
  classId?: string;
  sectionId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  page?: number;
  pageSize?: number;
}

export async function listStudents(q: StudentQuery = {}) {
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('students').select('*', { count: 'exact' }).order('roll_number');
  if (q.search) query = query.or(`full_name.ilike.%${q.search}%,roll_number.ilike.%${q.search}%`);
  if (q.classId) query = query.eq('class_id', q.classId);
  if (q.sectionId) query = query.eq('section_id', q.sectionId);
  if (q.status) query = query.eq('status', q.status);
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { students: data as Student[], total: count ?? 0 };
}

export async function createStudent(input: Omit<Student, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase.from('students').insert(input).select().single();
  if (error) throw error;
  return data as Student;
}

export async function updateStudent(id: string, patch: Partial<Student>) {
  const { data, error } = await supabase.from('students').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as Student;
}

export async function deleteStudent(id: string) {
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkInsertStudents(rows: Omit<Student, 'id' | 'created_at' | 'updated_at'>[]) {
  const { data, error } = await supabase.from('students').insert(rows).select();
  if (error) throw error;
  return data as Student[];
}

/**
 * Looks up existing students by roll number (exact match after trimming),
 * batched so a large CSV doesn't turn into thousands of individual queries.
 * Roll numbers aren't guaranteed unique across the whole institution, so a
 * given roll number may resolve to more than one existing student — the
 * Smart CSV Import engine uses that to detect movements vs. conflicts.
 */
export async function findStudentsByRollNumbers(rollNumbers: string[]): Promise<Student[]> {
  const unique = Array.from(new Set(rollNumbers.map((r) => r.trim()).filter(Boolean)));
  if (!unique.length) return [];

  const CHUNK_SIZE = 200;
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) chunks.push(unique.slice(i, i + CHUNK_SIZE));

  const results: Student[] = [];
  for (const chunk of chunks) {
    const { data, error } = await supabase.from('students').select('*').in('roll_number', chunk);
    if (error) throw error;
    results.push(...((data as Student[]) ?? []));
  }
  return results;
}
