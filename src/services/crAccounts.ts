import { supabase } from '@/lib/supabase';

/**
 * Generates a CR account with a structured, predictable email
 * (cr + section + class @ domain) and a random password — via the
 * "manage-cr-credentials" Edge Function (service role, MAIN_SUPER_ADMIN only).
 * The CR's real name is never auto-generated; only the email/password are.
 */
export async function generateCrAccount(input: {
  fullName: string;
  phone?: string;
  classId: string;
  sectionId: string;
  email?: string; // optional override of the auto-generated email
}) {
  const { data, error } = await supabase.functions.invoke('manage-cr-credentials', {
    body: { action: 'generate', ...input },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { success: true; user: { id: string; full_name: string; email: string; phone?: string }; password: string };
}

/** Changes a CR's login email — the Main Super Admin can do this any time. */
export async function updateCrEmail(crUserId: string, newEmail: string) {
  const { data, error } = await supabase.functions.invoke('manage-cr-credentials', {
    body: { action: 'update_email', crUserId, newEmail },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { success: true; email: string };
}

/** Issues a new password for a CR (auto-generated unless one is supplied). */
export async function resetCrPassword(crUserId: string, newPassword?: string) {
  const { data, error } = await supabase.functions.invoke('manage-cr-credentials', {
    body: { action: 'reset_password', crUserId, newPassword },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { success: true; password: string };
}

/** Permanently deletes a CR account — auth user, profile, assignments, credentials, warnings, and session log all cascade automatically. */
export async function deleteCrAccount(crUserId: string) {
  const { data, error } = await supabase.functions.invoke('manage-cr-credentials', {
    body: { action: 'delete', crUserId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { success: true; deletedName: string };
}

/** The full credentials vault, joined with the CR's profile and class/section. */
export async function listCrCredentials() {
  const { data, error } = await supabase
    .from('cr_credentials')
    .select('*, profiles!cr_credentials_cr_user_id_fkey(full_name, email, phone, is_active), classes(name), sections(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Login / credential-change history. Optionally scoped to one user. */
export async function listLoginSessions(params?: { userId?: string; limit?: number }) {
  let query = supabase.from('login_sessions').select('*').order('created_at', { ascending: false });
  if (params?.userId) query = query.eq('user_id', params.userId);
  if (params?.limit) query = query.limit(params.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Records the current user's own login. Safe to call fire-and-forget. */
export async function logLoginSession(userId: string) {
  const { data: prof } = await supabase.from('profiles').select('full_name, role').eq('id', userId).single();
  if (!prof) return;
  await supabase.from('login_sessions').insert({
    user_id: userId,
    user_name: prof.full_name,
    user_role: prof.role,
    event_type: 'LOGIN',
    description: `${prof.full_name} logged in.`,
  });
}

/** Issues a formal warning to a CR for misconduct. Main Super Admin only. */
export async function issueWarning(input: { crUserId: string; issuedBy: string; issuedByName: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; message: string }) {
  const { error } = await supabase.from('cr_warnings').insert({
    cr_user_id: input.crUserId,
    issued_by: input.issuedBy,
    issued_by_name: input.issuedByName,
    severity: input.severity,
    message: input.message,
  });
  if (error) throw error;
}

/** Warning history — for a specific CR, or everyone (Main Super Admin view). */
export async function listWarnings(crUserId?: string) {
  let query = supabase.from('cr_warnings').select('*').order('created_at', { ascending: false });
  if (crUserId) query = query.eq('cr_user_id', crUserId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** A CR acknowledges a warning issued to them. */
export async function acknowledgeWarning(id: string) {
  const { error } = await supabase.from('cr_warnings').update({ acknowledged_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
