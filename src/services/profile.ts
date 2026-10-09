import { supabase } from '@/lib/supabase';

/**
 * Updates the current user's own profile fields. Role, is_active, and
 * email are blocked at the database layer (see migration 0002) even if
 * accidentally included here — this only ever sends editable fields.
 */
export async function updateOwnProfile(userId: string, patch: { full_name?: string; phone?: string; avatar_url?: string | null; must_change_password?: boolean }) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

/**
 * Uploads a profile picture to the `avatars` Storage bucket under a
 * folder named after the user's own id (required by the storage RLS
 * policy), then returns its public URL.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
  });
  if (uploadErr) throw uploadErr;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
