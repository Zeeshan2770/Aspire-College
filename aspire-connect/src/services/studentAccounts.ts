import { supabase } from '@/lib/supabase';
import { comparisonKey } from '@/services/csv';

/** Creates a Student Portal login for an existing student record. Generates a permanent Student ID, a synthetic login username, and a temporary password. */
export async function createStudentLogin(studentId: string, admissionYear?: string) {
  const { data, error } = await supabase.functions.invoke('manage-student-credentials', {
    body: { action: 'create', studentId, admissionYear },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { success: true; user: { id: string; full_name: string; student_uid: string; username: string }; password: string };
}

/** Best-effort variant used by CSV import: returns null instead of throwing on "already has an account" so a bulk loop can just skip it. */
export async function createStudentLoginIfNeeded(studentId: string, admissionYear?: string) {
  try {
    return await createStudentLogin(studentId, admissionYear);
  } catch (e: any) {
    if (/already has a Student Portal account/i.test(e.message ?? '')) return null;
    throw e;
  }
}

/** Issues a new temporary password for an existing student account. */
export async function resetStudentPassword(userId: string) {
  const { data, error } = await supabase.functions.invoke('manage-student-credentials', {
    body: { action: 'reset_password', userId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { success: true; password: string };
}

/** Enables or disables a student's login (they keep their student record either way). */
export async function setStudentAccountActive(userId: string, isActive: boolean) {
  const { data, error } = await supabase.functions.invoke('manage-student-credentials', {
    body: { action: isActive ? 'enable' : 'disable', userId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { success: true; is_active: boolean };
}

/** Permanently removes a student's login only — the student record itself is untouched. */
export async function deleteStudentAccount(userId: string) {
  const { data, error } = await supabase.functions.invoke('manage-student-credentials', {
    body: { action: 'delete', userId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { success: true; deletedName: string };
}

/**
 * Best-effort post-import step for the "Create Student Login" checkbox in
 * the Smart CSV Import wizard. Deliberately runs AFTER the atomic import
 * transaction has already committed, rather than inside it — a login
 * that fails to create is not a reason to roll back a successful student
 * import. Re-resolves each row by (roll number, class name, section
 * name) against the now-current roster, since brand-new rows have no
 * student_id until the import itself creates them.
 */
export async function bulkCreateStudentLoginsForRollNumbers(
  rows: { rollNumber: string; className: string; sectionName: string }[]
): Promise<{ created: number; skipped: number; failed: number }> {
  if (!rows.length) return { created: 0, skipped: 0, failed: 0 };

  const [{ data: classes }, { data: sections }] = await Promise.all([
    supabase.from('classes').select('id, name'),
    supabase.from('sections').select('id, name, class_id'),
  ]);

  const classByKey = new Map((classes ?? []).map((c: any) => [comparisonKey(c.name), c.id]));
  const sectionByKey = new Map((sections ?? []).map((s: any) => [`${s.class_id}|${comparisonKey(s.name)}`, s.id]));

  const rollNumbers = Array.from(new Set(rows.map((r) => r.rollNumber)));
  const { data: students, error } = await supabase
    .from('students')
    .select('id, roll_number, class_id, section_id, user_id')
    .in('roll_number', rollNumbers);
  if (error) throw error;

  let created = 0, skipped = 0, failed = 0;
  for (const row of rows) {
    const classId = classByKey.get(comparisonKey(row.className));
    const sectionId = classId ? sectionByKey.get(`${classId}|${comparisonKey(row.sectionName)}`) : undefined;
    if (!classId || !sectionId) { failed++; continue; }

    const match = (students ?? []).find(
      (s: any) => s.roll_number === row.rollNumber && s.class_id === classId && s.section_id === sectionId
    );
    if (!match) { failed++; continue; }
    if (match.user_id) { skipped++; continue; }

    try {
      const result = await createStudentLoginIfNeeded(match.id);
      if (result) created++; else skipped++;
    } catch {
      failed++;
    }
  }
  return { created, skipped, failed };
}
export interface BulkCreateResult {
  studentId: string;
  full_name: string;
  roll_number: string;
  success: boolean;
  student_uid?: string;
  username?: string;
  password?: string;
  error?: string;
}

/**
 * Creates Student Portal logins for an arbitrary list of already-selected
 * students (chosen by section, hand-picked one-by-one, or a roll-number
 * range in the Student Accounts screen — the selection mechanism doesn't
 * matter by the time it reaches here). Runs sequentially, one account at a
 * time, so a single failure never aborts the rest of the batch and the
 * caller can show live "X of Y" progress via onProgress.
 */
export async function bulkCreateStudentLogins(
  students: { id: string; full_name: string; roll_number: string }[],
  onProgress?: (done: number, total: number) => void
): Promise<BulkCreateResult[]> {
  const results: BulkCreateResult[] = [];
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    try {
      const result = await createStudentLogin(s.id);
      results.push({
        studentId: s.id, full_name: s.full_name, roll_number: s.roll_number,
        success: true, student_uid: result.user.student_uid, username: result.user.username, password: result.password,
      });
    } catch (e: any) {
      results.push({ studentId: s.id, full_name: s.full_name, roll_number: s.roll_number, success: false, error: e.message ?? 'Failed.' });
    }
    onProgress?.(i + 1, students.length);
  }
  return results;
}

/** The full student credentials vault, joined with the student's profile, roster record, class and section. Main Super Admin only (enforced by RLS). */
export async function listStudentCredentials() {
  const { data, error } = await supabase
    .from('student_credentials')
    .select(
      '*, profiles!student_credentials_user_id_fkey(full_name, is_active), students!student_credentials_student_id_fkey(full_name, roll_number, class_id, section_id, classes(name), sections(name))'
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
