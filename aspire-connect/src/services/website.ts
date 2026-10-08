import { supabase } from '@/lib/supabase';

const fail = (what: string): never => {
  throw new Error(`Unable to ${what}. Please try again.`);
};

/* ------------------------------- Images ------------------------------- */

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function uploadSiteImage(file: File, folder: string): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Please choose a JPG, PNG or WebP image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('The image is larger than 2 MB. Please choose a smaller file.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('site-media').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) throw new Error('Image upload failed. Please try again.');
  return supabase.storage.from('site-media').getPublicUrl(path).data.publicUrl;
}

/* ------------------------- Extra photographs & Gallery ------------------------- */

export type ImageOwner = 'news' | 'event' | 'album';
export interface SiteImage { url: string; caption: string }
export const MAX_PHOTOS = 30;

export async function listSiteImages(owner: ImageOwner, ownerId: string): Promise<SiteImage[]> {
  const { data, error } = await supabase.from('site_images').select('url, caption').eq('owner_type', owner).eq('owner_id', ownerId).order('sort_order').order('created_at');
  if (error) throw new Error('Unable to load the photographs.');
  return (data ?? []).map((r) => ({ url: r.url as string, caption: (r.caption as string | null) ?? '' }));
}

/** Makes the stored photographs of an item equal to the given list (order is kept). */
export async function replaceSiteImages(owner: ImageOwner, ownerId: string, images: SiteImage[]) {
  const del = await supabase.from('site_images').delete().eq('owner_type', owner).eq('owner_id', ownerId);
  if (del.error) throw new Error('Unable to save the photographs.');
  if (!images.length) return;
  const rows = images.slice(0, MAX_PHOTOS).map((im, i) => ({ owner_type: owner, owner_id: ownerId, url: im.url, caption: im.caption.trim() || null, sort_order: i }));
  const ins = await supabase.from('site_images').insert(rows);
  if (ins.error) throw new Error('Unable to save the photographs.');
}

export interface AlbumRow {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  created_at: string;
}
export type AlbumInput = Pick<AlbumRow, 'title' | 'description' | 'event_date' | 'status'>;

export async function listAlbums(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  const { data, count, error } = await supabase.from('gallery_albums').select('*', { count: 'exact' }).order('event_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).range(from, from + pageSize - 1);
  if (error) return fail('load the gallery');
  return { rows: (data ?? []) as AlbumRow[], total: count ?? 0 };
}
export async function saveAlbum(id: string | null, input: AlbumInput): Promise<string> {
  if (id) {
    const { error } = await supabase.from('gallery_albums').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error('Unable to save the album.');
    return id;
  }
  const { data, error } = await supabase.from('gallery_albums').insert(input).select('id').single();
  if (error || !data) throw new Error('Unable to save the album.');
  return data.id as string;
}
export async function deleteAlbum(id: string) {
  const { error } = await supabase.from('gallery_albums').delete().eq('id', id);
  if (error) throw new Error('Unable to delete the album.');
}

/* ------------------------------- Faculty ------------------------------ */

export interface FacultyRow {
  id: string;
  full_name: string;
  designation: string | null;
  department: string | null;
  subject: string | null;
  qualification: string | null;
  bio: string | null;
  photo_url: string | null;
  email: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  is_public: boolean;
  display_order: number;
}
export type FacultyInput = Omit<FacultyRow, 'id'>;

export async function listFaculty(): Promise<FacultyRow[]> {
  const { data, error } = await supabase.from('faculty').select('*').order('display_order').order('full_name').range(0, 499);
  if (error) return fail('load faculty');
  return (data ?? []) as FacultyRow[];
}
export async function saveFaculty(id: string | null, input: FacultyInput) {
  const q = id ? supabase.from('faculty').update(input).eq('id', id) : supabase.from('faculty').insert(input);
  const { error } = await q;
  if (error) throw new Error('Unable to save the faculty member. Please check the details and try again.');
}

/* ------------------------------ Programs ------------------------------ */

export interface ProgramRow {
  id: string;
  name: string;
  level: string | null;
  description: string | null;
  duration: string | null;
  eligibility: string | null;
  display_order: number;
  is_active: boolean;
}
export type ProgramInput = Omit<ProgramRow, 'id'>;

export async function listPrograms(): Promise<ProgramRow[]> {
  const { data, error } = await supabase.from('programs').select('*').order('display_order').order('name');
  if (error) return fail('load programs');
  return (data ?? []) as ProgramRow[];
}
export async function saveProgram(id: string | null, input: ProgramInput) {
  const q = id ? supabase.from('programs').update(input).eq('id', id) : supabase.from('programs').insert(input);
  const { error } = await q;
  if (error) throw new Error(error.code === '23505' ? 'A program with this name already exists.' : 'Unable to save the program.');
}

/* -------------------------------- News -------------------------------- */

export const NEWS_CATEGORIES = ['Announcement', 'Achievement', 'Academic', 'General'];
export interface NewsRow {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  image_url: string | null;
  category: string;
  status: 'DRAFT' | 'PUBLISHED';
  published_at: string | null;
  created_at: string;
}
export type NewsInput = Pick<NewsRow, 'title' | 'summary' | 'body' | 'image_url' | 'category' | 'status'>;

export async function listNews(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  const { data, count, error } = await supabase.from('news').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + pageSize - 1);
  if (error) return fail('load news');
  return { rows: (data ?? []) as NewsRow[], total: count ?? 0 };
}
export async function saveNews(id: string | null, input: NewsInput): Promise<string> {
  if (id) {
    const { error } = await supabase.from('news').update(input).eq('id', id);
    if (error) throw new Error('Unable to save the news item.');
    return id;
  }
  const { data, error } = await supabase.from('news').insert(input).select('id').single();
  if (error || !data) throw new Error('Unable to save the news item.');
  return data.id as string;
}
export async function deleteNews(id: string) {
  const { error } = await supabase.from('news').delete().eq('id', id);
  if (error) throw new Error('Unable to delete the news item.');
}

/* ------------------------------- Events ------------------------------- */

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  status: 'DRAFT' | 'PUBLISHED';
}
export type EventInput = Omit<EventRow, 'id'>;

export async function listEvents(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  const { data, count, error } = await supabase.from('events').select('*', { count: 'exact' }).order('starts_at', { ascending: false }).range(from, from + pageSize - 1);
  if (error) return fail('load events');
  return { rows: (data ?? []) as EventRow[], total: count ?? 0 };
}
export async function saveEvent(id: string | null, input: EventInput): Promise<string> {
  const fail2 = (code?: string) => new Error(code === '23514' ? 'The end date cannot be before the start date.' : 'Unable to save the event.');
  if (id) {
    const { error } = await supabase.from('events').update(input).eq('id', id);
    if (error) throw fail2(error.code);
    return id;
  }
  const { data, error } = await supabase.from('events').insert(input).select('id').single();
  if (error || !data) throw fail2(error?.code);
  return data.id as string;
}
export async function deleteEvent(id: string) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw new Error('Unable to delete the event.');
}

/* --------------------------- Page content (CMS) ------------------------ */

export type ContentValue = { text?: string; items?: unknown[] };

export async function loadContent(): Promise<Record<string, ContentValue>> {
  const { data, error } = await supabase.from('site_content').select('key, value');
  if (error) return fail('load page content');
  const out: Record<string, ContentValue> = {};
  (data ?? []).forEach((r) => { out[r.key as string] = r.value as ContentValue; });
  return out;
}
export async function saveContent(key: string, value: ContentValue) {
  const { error } = await supabase.from('site_content').upsert({ key, value }, { onConflict: 'key' });
  if (error) throw new Error('Unable to save this section.');
}

/* ----------------------------- Site settings -------------------------- */

export interface SiteSettingsRow {
  college_name: string;
  campus_name: string;
  website_title: string | null;
  tagline: string | null;
  logo_url: string | null;
  secondary_logo_url: string | null;
  favicon_url: string | null;
  hero_image_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  map_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  footer_text: string | null;
  admissions_open: boolean;
  principal_name: string | null;
  principal_photo_url: string | null;
  principal_message: string | null;
}

export async function loadSiteSettings(): Promise<SiteSettingsRow> {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();
  if (error || !data) return fail('load website settings');
  return data as SiteSettingsRow;
}
export async function saveSiteSettings(patch: Partial<SiteSettingsRow>) {
  const { error } = await supabase.from('site_settings').update(patch).eq('id', 1);
  if (error) throw new Error(error.code === '23514' ? 'One of the colors is not a valid hex value (for example #1F3A5F).' : 'Unable to save the settings.');
}
