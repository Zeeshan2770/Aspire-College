import { supabase } from '@/lib/supabase';

export interface DropdownOption { id: string; category: string; label: string; sort_order: number }

export type OptionCategory =
  | 'faculty_designation' | 'faculty_department' | 'faculty_subject' | 'faculty_qualification'
  | 'program_level' | 'program_duration' | 'news_category' | 'event_location' | 'student_query_category';

const cache = new Map<string, DropdownOption[]>();
const inflight = new Map<string, Promise<DropdownOption[]>>();
const listeners = new Map<string, Set<(o: DropdownOption[]) => void>>();

function publish(category: string, rows: DropdownOption[]) {
  cache.set(category, rows);
  listeners.get(category)?.forEach((l) => l(rows));
}

export function getCachedOptions(category: string): DropdownOption[] | undefined {
  return cache.get(category);
}

export function subscribeOptions(category: string, fn: (o: DropdownOption[]) => void) {
  if (!listeners.has(category)) listeners.set(category, new Set());
  listeners.get(category)!.add(fn);
  return () => { listeners.get(category)?.delete(fn); };
}

export async function loadOptions(category: string): Promise<DropdownOption[]> {
  const hit = cache.get(category);
  if (hit) return hit;
  let p = inflight.get(category);
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase.from('dropdown_options').select('*').eq('category', category)
        .order('sort_order').order('label');
      if (error) throw new Error('Unable to load the list.');
      const rows = (data ?? []) as DropdownOption[];
      publish(category, rows);
      return rows;
    })().finally(() => inflight.delete(category));
    inflight.set(category, p);
  }
  return p;
}

async function reload(category: string) {
  cache.delete(category);
  return loadOptions(category);
}

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

export async function addOption(category: string, label: string): Promise<DropdownOption> {
  const l = clean(label);
  if (!l) throw new Error('Enter a name first.');
  const current = await loadOptions(category).catch(() => [] as DropdownOption[]);
  if (current.some((o) => o.label.toLowerCase() === l.toLowerCase())) throw new Error('This option already exists.');
  const next = (current.reduce((m, o) => Math.max(m, o.sort_order), 0) || 0) + 1;
  const { data, error } = await supabase.from('dropdown_options').insert({ category, label: l, sort_order: next }).select().single();
  if (error) throw new Error(error.code === '23505' ? 'This option already exists.' : 'Unable to add the option. Make sure you have permission and the 0022 migration has been applied.');
  await reload(category);
  return data as DropdownOption;
}

export async function renameOption(category: string, id: string, label: string) {
  const l = clean(label);
  if (!l) throw new Error('Name cannot be empty.');
  const { error } = await supabase.from('dropdown_options').update({ label: l }).eq('id', id);
  if (error) throw new Error(error.code === '23505' ? 'This option already exists.' : 'Unable to rename the option.');
  await reload(category);
}

export async function deleteOption(category: string, id: string) {
  const { error } = await supabase.from('dropdown_options').delete().eq('id', id);
  if (error) throw new Error('Unable to delete the option.');
  await reload(category);
}

export async function moveOption(category: string, id: string, dir: -1 | 1) {
  const rows = [...(await loadOptions(category))];
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  const results = await Promise.all(rows.map((r, idx) => supabase.from('dropdown_options').update({ sort_order: idx + 1 }).eq('id', r.id)));
  if (results.some((r) => r.error)) throw new Error('Unable to reorder.');
  await reload(category);
}
