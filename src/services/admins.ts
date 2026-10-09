import { supabase } from '@/lib/supabase';
import { AdminPermissions } from '@/types';

/**
 * Creating a Sub Super Admin requires Supabase Admin privileges (service role)
 * to call auth.admin.createUser, which must not run in the browser with the
 * anon key. In production, wrap this in a Supabase Edge Function
 * ("create-admin") that uses the service role key server-side and is called
 * from here via supabase.functions.invoke. This client-side function calls
 * that edge function.
 */
export async function createSubSuperAdmin(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  permissions: Partial<AdminPermissions>;
}) {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: { ...input, role: 'SUB_SUPER_ADMIN' },
  });
  if (error) throw error;
  return data;
}

/**
 * Creates a new Class Representative account (Supabase Auth user + profile).
 * Uses the same "create-user" Edge Function as Sub Super Admin creation.
 * The full name entered here becomes the CR's profile name everywhere in
 * the app; email and mobile number are required.
 */
export async function createCrUser(input: { fullName: string; email: string; phone: string; password: string }) {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: { ...input, role: 'CR' },
  });
  if (error) throw error;
  return data;
}

export async function listCrUsers() {
  const { data, error } = await supabase.from('profiles').select('*').eq('role', 'CR').order('full_name');
  if (error) throw error;
  return data;
}

export async function listSubSuperAdmins() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, admin_permissions(*)')
    .eq('role', 'SUB_SUPER_ADMIN')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Creates a new Principal account (Supabase Auth user + profile).
 * Only a Main Super Admin can create these (enforced server-side in the
 * "create-user" Edge Function). Principals are read-only everywhere —
 * they get no admin_permissions row because their access is granted
 * directly via RLS (is_principal()), not the fine-grained permission
 * system used for Sub Super Admins.
 */
export async function createPrincipal(input: { fullName: string; email: string; phone: string; password: string }) {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: { ...input, role: 'PRINCIPAL' },
  });
  if (error) throw error;
  return data;
}

export async function listPrincipals() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'PRINCIPAL')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateAdminPermissions(profileId: string, patch: Partial<AdminPermissions>) {
  const { error } = await supabase.from('admin_permissions').update(patch).eq('profile_id', profileId);
  if (error) throw error;
}

export async function setAdminActive(profileId: string, isActive: boolean) {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', profileId);
  if (error) throw error;
}
