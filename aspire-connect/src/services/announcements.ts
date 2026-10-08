import { supabase } from '@/lib/supabase';
import { Announcement, AnnouncementPriority, AppRole } from '@/types';

/**
 * Who a given role is allowed to send announcements to. Mirrors the
 * can_announce_to() check enforced in the database — this is only for
 * building the UI; the real gate is server-side.
 */
export function allowedAudienceFor(role: AppRole): AppRole[] {
  if (role === 'MAIN_SUPER_ADMIN') return ['PRINCIPAL', 'SUB_SUPER_ADMIN', 'CR'];
  if (role === 'PRINCIPAL') return ['SUB_SUPER_ADMIN', 'CR'];
  if (role === 'SUB_SUPER_ADMIN') return ['CR'];
  return [];
}

export type InboxAnnouncement = Announcement & { read: boolean };

/** Announcements targeted at the current user's role, newest/pinned first. */
export async function listInboxAnnouncements(): Promise<InboxAnnouncement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*, announcement_reads(profile_id)')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map((a) => ({ ...a, read: (a.announcement_reads ?? []).length > 0 }));
}

/** Announcements the current user has authored. */
export async function listSentAnnouncements(userId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createAnnouncement(input: {
  createdBy: string;
  createdByName: string;
  createdByRole: AppRole;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  targetRoles: AppRole[];
  isPinned: boolean;
  expiresAt?: string | null;
}) {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      created_by: input.createdBy,
      created_by_name: input.createdByName,
      created_by_role: input.createdByRole,
      title: input.title,
      message: input.message,
      priority: input.priority,
      target_roles: input.targetRoles,
      is_pinned: input.isPinned,
      expires_at: input.expiresAt ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAnnouncement(
  id: string,
  patch: Partial<{
    title: string;
    message: string;
    priority: AnnouncementPriority;
    target_roles: AppRole[];
    is_pinned: boolean;
    expires_at: string | null;
  }>
) {
  const { error } = await supabase.from('announcements').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}

export async function markAnnouncementRead(announcementId: string, profileId: string) {
  const { error } = await supabase
    .from('announcement_reads')
    .upsert({ announcement_id: announcementId, profile_id: profileId }, { onConflict: 'announcement_id,profile_id' });
  if (error) throw error;
}

/** How many of the intended recipients have opened this announcement. */
export async function announcementReadStats(announcementId: string, targetRoles: AppRole[]) {
  const [{ count: total }, { count: read }] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', targetRoles).eq('is_active', true),
    supabase.from('announcement_reads').select('profile_id', { count: 'exact', head: true }).eq('announcement_id', announcementId),
  ]);
  return { total: total ?? 0, read: read ?? 0 };
}
