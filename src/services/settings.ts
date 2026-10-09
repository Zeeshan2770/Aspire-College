import { supabase } from '@/lib/supabase';
import { SystemSettings } from '@/types';

export async function getSettings(): Promise<SystemSettings> {
  const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).single();
  if (error) throw error;
  return data as SystemSettings;
}

export async function updateSettings(patch: Partial<SystemSettings>) {
  const { data, error } = await supabase.from('system_settings').update(patch).eq('id', 1).select().single();
  if (error) throw error;
  return data as SystemSettings;
}
