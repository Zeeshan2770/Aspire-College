import { supabase } from '@/lib/supabase';
import {
  ConcernStatus,
  ConcernPriority,
  ConcernScope,
  StudentConcern,
  ConcernComment,
  ConcernHistoryEntry,
  ConcernAttachment,
  ConcernNotification,
} from '@/types';

// =====================================================================
// Legacy CR "report a student's misbehavior" flow — unchanged, still
// used by src/pages/CR/Concerns.tsx. Kept exactly as before so existing
// CR-submitted concerns keep working.
// =====================================================================

export async function createConcern(input: {
  studentId: string;
  classId: string;
  sectionId: string;
  reportedBy: string;
  concernType: string;
  shortDescription: string;
  additionalNotes?: string;
}) {
  const { data, error } = await supabase
    .from('student_concerns')
    .insert({
      student_id: input.studentId,
      class_id: input.classId,
      section_id: input.sectionId,
      reported_by: input.reportedBy,
      concern_type: input.concernType,
      short_description: input.shortDescription,
      additional_notes: input.additionalNotes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listConcerns(opts: { sectionId?: string; studentId?: string; from?: string; to?: string }) {
  let query = supabase
    .from('student_concerns')
    .select('*, students(full_name, roll_number), classes(name), sections(name)')
    .order('created_at', { ascending: false });
  if (opts.sectionId) query = query.eq('section_id', opts.sectionId);
  if (opts.studentId) query = query.eq('student_id', opts.studentId);
  if (opts.from) query = query.gte('created_at', opts.from);
  if (opts.to) query = query.lte('created_at', opts.to);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateConcernStatus(id: string, status: ConcernStatus) {
  const { error } = await supabase.from('student_concerns').update({ status }).eq('id', id);
  if (error) throw error;
}

// =====================================================================
// Universal Concern & Complaint System
// =====================================================================

export type ConcernWithNames = StudentConcern & {
  students: { full_name: string; roll_number: string } | null;
  classes: { name: string } | null;
  sections: { name: string } | null;
  reporter: { full_name: string; role: string } | null;
  assignee: { full_name: string; role: string } | null;
};

const CONCERN_SELECT =
  '*, students(full_name, roll_number), classes(name), sections(name), reporter:reported_by(full_name, role), assignee:assigned_to(full_name, role)';

function friendlyConcernError(message: string): string {
  if (!message) return 'Something went wrong. Please try again.';
  if (message.startsWith('PERMISSION_DENIED')) return message.replace('PERMISSION_DENIED: ', '');
  if (/permission denied for/i.test(message)) return "You don't have permission to do that.";
  return message;
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(friendlyConcernError(error.message));
  return data as T;
}

/** Raise a new concern. Server re-checks permission and caps CR-submitted priority at HIGH. */
export async function raiseConcern(input: {
  category: string;
  subject: string;
  description?: string;
  priority?: ConcernPriority;
  scope?: ConcernScope;
  classId?: string | null;
  sectionId?: string | null;
  studentId?: string | null;
}): Promise<{ id: string; status: ConcernStatus; priority: ConcernPriority }> {
  return callRpc('create_concern', {
    payload: {
      category: input.category,
      subject: input.subject,
      description: input.description ?? null,
      priority: input.priority ?? 'MEDIUM',
      scope: input.scope ?? 'PERSONAL',
      class_id: input.classId ?? null,
      section_id: input.sectionId ?? null,
      student_id: input.studentId ?? null,
    },
  });
}

/** Concerns the signed-in user raised themselves. */
export async function listMyConcerns(): Promise<ConcernWithNames[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('student_concerns')
    .select(CONCERN_SELECT)
    .eq('reported_by', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]) ?? [];
}

/** Concerns currently assigned to the signed-in user. */
export async function listAssignedConcerns(): Promise<ConcernWithNames[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('student_concerns')
    .select(CONCERN_SELECT)
    .eq('assigned_to', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]) ?? [];
}

/**
 * Every concern the signed-in user is authorized to see (RLS enforces
 * the actual boundary — this is just optional filtering on top).
 */
export async function listVisibleConcerns(filters: {
  status?: ConcernStatus;
  category?: string;
  priority?: ConcernPriority;
  classId?: string;
  sectionId?: string;
  scope?: ConcernScope;
  assignedTo?: string | null;
  unassignedOnly?: boolean;
} = {}): Promise<ConcernWithNames[]> {
  let query = supabase.from('student_concerns').select(CONCERN_SELECT).order('created_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.category) query = query.eq('concern_type', filters.category);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.classId) query = query.eq('class_id', filters.classId);
  if (filters.sectionId) query = query.eq('section_id', filters.sectionId);
  if (filters.scope) query = query.eq('scope', filters.scope);
  if (filters.unassignedOnly) query = query.is('assigned_to', null);
  else if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
  const { data, error } = await query;
  if (error) throw error;
  return (data as any[]) ?? [];
}

export async function getConcern(id: string): Promise<ConcernWithNames | null> {
  const { data, error } = await supabase.from('student_concerns').select(CONCERN_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function listConcernComments(concernId: string): Promise<ConcernComment[]> {
  const { data, error } = await supabase
    .from('concern_comments')
    .select('*')
    .eq('concern_id', concernId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as ConcernComment[];
}

export async function addConcernComment(concernId: string, body: string, isInternal = false): Promise<{ id: string }> {
  return callRpc('add_concern_comment', { p_concern_id: concernId, p_body: body, p_is_internal: isInternal });
}

export async function listConcernHistory(concernId: string): Promise<ConcernHistoryEntry[]> {
  const { data, error } = await supabase
    .from('concern_history')
    .select('*')
    .eq('concern_id', concernId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as ConcernHistoryEntry[];
}

/** Change status, reassign, and/or change priority in one atomic, audited call. */
export async function updateConcern(
  concernId: string,
  patch: { status?: ConcernStatus; assignedTo?: string | null; priority?: ConcernPriority; note?: string }
): Promise<{ id: string; ok: boolean }> {
  const payload: Record<string, unknown> = {};
  if (patch.status) payload.status = patch.status;
  if (patch.assignedTo !== undefined) payload.assigned_to = patch.assignedTo;
  if (patch.priority) payload.priority = patch.priority;
  if (patch.note) payload.note = patch.note;
  return callRpc('update_concern', { p_concern_id: concernId, p_patch: payload });
}

/** Profiles who can be assigned a concern (Main Super Admin, Sub Super Admin, Principal). Empty for callers without profile-list visibility (RLS-limited). */
export async function listConcernManagers(): Promise<{ id: string; full_name: string; role: string }[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['MAIN_SUPER_ADMIN', 'SUB_SUPER_ADMIN', 'PRINCIPAL'])
    .eq('is_active', true)
    .order('full_name');
  if (error) throw error;
  return (data as any[]) ?? [];
}

// ---------- Attachments ----------

const ATTACHMENTS_BUCKET = 'concern-attachments';
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

export async function listConcernAttachments(concernId: string): Promise<ConcernAttachment[]> {
  const { data, error } = await supabase
    .from('concern_attachments')
    .select('*')
    .eq('concern_id', concernId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ConcernAttachment[];
}

export async function uploadConcernAttachment(concernId: string, file: File): Promise<ConcernAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('File is too large — the limit is 10MB.');
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    throw new Error('Only PNG, JPEG, WebP images or PDF files can be attached.');
  }
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('You must be signed in to attach a file.');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${concernId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('concern_attachments')
    .insert({
      concern_id: concernId,
      uploaded_by: uid,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
    throw error;
  }
  return data as ConcernAttachment;
}

export async function getAttachmentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteConcernAttachment(id: string, storagePath: string): Promise<void> {
  const { error } = await supabase.from('concern_attachments').delete().eq('id', id);
  if (error) throw error;
  await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
}

// ---------- Client-side permission helper (server always re-checks) ----------

export interface ConcernCapabilities {
  canRaise: boolean;
  canViewAll: boolean;
  canManage: boolean;
}

/**
 * Best-effort client-side capability check, purely for deciding which UI
 * to show — the RPC functions and RLS re-check everything server-side
 * regardless of what this returns.
 */
export async function getMyConcernCapabilities(role: string): Promise<ConcernCapabilities> {
  if (role === 'MAIN_SUPER_ADMIN') return { canRaise: true, canViewAll: true, canManage: true };
  if (role === 'PRINCIPAL') return { canRaise: true, canViewAll: true, canManage: false };
  if (role === 'CR') return { canRaise: true, canViewAll: false, canManage: false };
  if (role === 'STUDENT') return { canRaise: true, canViewAll: false, canManage: false };
  // SUB_SUPER_ADMIN — depends on their configured admin_permissions row.
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { canRaise: false, canViewAll: false, canManage: false };
  const { data } = await supabase
    .from('admin_permissions')
    .select('raise_concerns, view_concerns, manage_concerns')
    .eq('profile_id', uid)
    .maybeSingle();
  return {
    canRaise: data?.raise_concerns ?? true,
    canViewAll: data?.view_concerns ?? true,
    canManage: data?.manage_concerns ?? false,
  };
}

// ---------- Notifications ----------

export async function listConcernNotifications(limit = 30): Promise<ConcernNotification[]> {
  const { data, error } = await supabase
    .from('concern_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ConcernNotification[];
}

export async function unreadConcernNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('concern_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function markConcernNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('concern_notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllConcernNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from('concern_notifications').update({ is_read: true }).in('id', ids);
  if (error) throw error;
}
