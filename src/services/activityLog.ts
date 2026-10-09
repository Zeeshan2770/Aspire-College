import { supabase } from '@/lib/supabase';
import { AppRole } from '@/types';

export async function logActivity(params: {
  adminId: string;
  adminName: string;
  adminRole: AppRole;
  action: string;
  target?: string;
  description: string;
}) {
  const { adminId, adminName, adminRole, action, target, description } = params;
  const { error } = await supabase.from('admin_activity_logs').insert({
    admin_id: adminId,
    admin_name: adminName,
    admin_role: adminRole,
    action,
    target: target ?? null,
    description,
  });
  if (error) console.error('Failed to log activity:', error.message);
}

export async function fetchActivityLogs(opts: { onlyOwn?: boolean; adminId?: string; limit?: number }) {
  let query = supabase.from('admin_activity_logs').select('*').order('created_at', { ascending: false });
  if (opts.onlyOwn && opts.adminId) query = query.eq('admin_id', opts.adminId);
  if (opts.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
