import { supabase } from '@/lib/supabase';
import { ReportBranding } from '@/types';

/**
 * Resolves the branding that should be used for a report: a section-level
 * override wins, then a class-level override, then null (caller falls
 * back to the global system_settings values).
 */
export async function resolveBranding(classId?: string | null, sectionId?: string | null): Promise<ReportBranding | null> {
  if (sectionId) {
    const { data } = await supabase.from('report_branding').select('*').eq('section_id', sectionId).maybeSingle();
    if (data) return data as ReportBranding;
  }
  if (classId) {
    const { data } = await supabase.from('report_branding').select('*').eq('class_id', classId).maybeSingle();
    if (data) return data as ReportBranding;
  }
  return null;
}

export async function listBranding(): Promise<ReportBranding[]> {
  const { data, error } = await supabase.from('report_branding').select('*, classes(name), sections(name, class_id)');
  if (error) throw error;
  return data as any;
}

export interface BrandingPatch {
  header_text?: string | null;
  footer_text?: string | null;
  header_image_url?: string | null;
  footer_image_url?: string | null;
  logo_url?: string | null;
}

export async function upsertClassBranding(classId: string, patch: BrandingPatch) {
  const { data, error } = await supabase
    .from('report_branding')
    .upsert({ class_id: classId, section_id: null, ...patch }, { onConflict: 'class_id' })
    .select()
    .single();
  if (error) throw error;
  return data as ReportBranding;
}

/** Section-level override. class_id is intentionally left null on this row
 *  (its class relation is looked up via `sections.class_id` if needed) —
 *  see migration 0002 for why class_id/section_id are mutually exclusive. */
export async function upsertSectionBranding(sectionId: string, patch: BrandingPatch) {
  const { data, error } = await supabase
    .from('report_branding')
    .upsert({ class_id: null, section_id: sectionId, ...patch }, { onConflict: 'section_id' })
    .select()
    .single();
  if (error) throw error;
  return data as ReportBranding;
}

export async function deleteBranding(id: string) {
  const { error } = await supabase.from('report_branding').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Uploads a report image — logo, header banner, or footer banner — to the
 * `report-logos` bucket (shared across all three; the filename prefix
 * keeps them apart). `scopeKey` should identify the owner, e.g.
 * `class-<id>`, `section-<id>`, or `global` for system-wide settings.
 */
export async function uploadReportImage(
  file: File,
  scopeKey: string,
  kind: 'logo' | 'header' | 'footer' = 'logo'
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${scopeKey}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('report-logos').upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw error;
  const { data } = supabase.storage.from('report-logos').getPublicUrl(path);
  return data.publicUrl;
}

/** @deprecated use uploadReportImage(file, scopeKey, 'logo') */
export async function uploadReportLogo(file: File, scopeKey: string): Promise<string> {
  return uploadReportImage(file, scopeKey, 'logo');
}
