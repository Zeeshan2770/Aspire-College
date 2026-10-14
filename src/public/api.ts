import { supabase } from '@/lib/supabase';
import { parseVideo } from '@/lib/video';

export interface SiteSettings {
  college_name: string;
  campus_name: string;
  website_title: string | null;
  tagline: string | null;
  logo_url: string | null;
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

export interface Program {
  id: string;
  name: string;
  level: string | null;
  description: string | null;
  duration: string | null;
  eligibility: string | null;
}

export interface FacultyPublic {
  id: string;
  full_name: string;
  designation: string | null;
  department: string | null;
  subject: string | null;
  qualification: string | null;
  bio: string | null;
  photo_url: string | null;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  image_url: string | null;
  category: string;
  published_at: string | null;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
}

export type ContentMap = Record<string, { text?: string; items?: unknown[] }>;

function fail(message: string): never {
  throw new Error(message);
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();
  if (error || !data) fail('Unable to load site settings.');
  return data as SiteSettings;
}

export async function fetchSiteContent(): Promise<ContentMap> {
  const { data, error } = await supabase.from('site_content').select('key, value');
  if (error) fail('Unable to load page content.');
  const map: ContentMap = {};
  (data ?? []).forEach((r) => {
    map[r.key as string] = r.value as ContentMap[string];
  });
  return map;
}

export async function fetchPrograms(): Promise<Program[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, level, description, duration, eligibility')
    .eq('is_active', true)
    .order('display_order')
    .order('name');
  if (error) fail('Unable to load programs.');
  return (data ?? []) as Program[];
}

export async function fetchFaculty(): Promise<FacultyPublic[]> {
  const { data, error } = await supabase
    .from('faculty')
    .select('id, full_name, designation, department, subject, qualification, bio, photo_url')
    .order('display_order')
    .order('full_name')
    .range(0, 299);
  if (error) fail('Unable to load faculty.');
  return (data ?? []) as FacultyPublic[];
}

const NEWS_COLS = 'id, title, summary, body, image_url, category, published_at';

export async function fetchNews(limit: number, offset = 0, category?: string): Promise<NewsItem[]> {
  let q = supabase
    .from('news')
    .select(NEWS_COLS)
    .eq('status', 'PUBLISHED')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (category) q = q.eq('category', category);
  const { data, error } = await q;
  if (error) fail('Unable to load news.');
  return (data ?? []) as NewsItem[];
}

export async function fetchNewsItem(id: string): Promise<NewsItem | null> {
  const { data, error } = await supabase.from('news').select(NEWS_COLS).eq('id', id).eq('status', 'PUBLISHED').maybeSingle();
  if (error) fail('Unable to load this article.');
  return (data as NewsItem) ?? null;
}

export async function fetchEvents(): Promise<EventItem[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, description, image_url, location, starts_at, ends_at')
    .eq('status', 'PUBLISHED')
    .order('starts_at', { ascending: false })
    .range(0, 99);
  if (error) fail('Unable to load events.');
  return (data ?? []) as EventItem[];
}

export async function submitRpc(fn: 'submit_admission' | 'submit_contact', payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, { payload });
  if (error) throw new Error(error.message || 'Submission failed. Please try again.');
  return data as { application_no?: string; ok?: boolean };
}

/* ----------------------- Photographs & Gallery (tables may not exist yet) ----------------------- */

export interface PublicImage { url: string; caption: string | null }
export interface Album { id: string; title: string; description: string | null; event_date: string | null; cover: string | null; count: number }

/** Extra photographs of a news item or event. Returns an empty list if the photo tables are not set up. */
export async function fetchSiteImages(owner: 'news' | 'event', ownerId: string): Promise<PublicImage[]> {
  const { data, error } = await supabase.from('site_images').select('url, caption').eq('owner_type', owner).eq('owner_id', ownerId).order('sort_order').order('created_at');
  if (error) return [];
  return (data ?? []) as PublicImage[];
}

export async function fetchAlbums(): Promise<Album[]> {
  const { data, error } = await supabase.from('gallery_albums').select('id, title, description, event_date').eq('status', 'PUBLISHED').order('event_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).range(0, 99);
  if (error) return [];
  const albums = (data ?? []) as { id: string; title: string; description: string | null; event_date: string | null }[];
  if (!albums.length) return [];
  const { data: imgs } = await supabase.from('site_images').select('owner_id, url, sort_order').eq('owner_type', 'album').in('owner_id', albums.map((a) => a.id)).order('sort_order').range(0, 2999);
  const first = new Map<string, string>();
  const counts = new Map<string, number>();
  (imgs ?? []).forEach((i) => {
    const k = i.owner_id as string;
    const u = i.url as string;
    const thumb = parseVideo(u) ? parseVideo(u)!.thumb : u;
    if (!first.has(k) && thumb) first.set(k, thumb);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  return albums.map((a) => ({ ...a, cover: first.get(a.id) ?? null, count: counts.get(a.id) ?? 0 }));
}

export async function fetchAlbum(id: string): Promise<{ album: Omit<Album, 'cover' | 'count'>; images: PublicImage[] } | null> {
  const { data, error } = await supabase.from('gallery_albums').select('id, title, description, event_date').eq('id', id).eq('status', 'PUBLISHED').maybeSingle();
  if (error || !data) return null;
  const { data: imgs } = await supabase.from('site_images').select('url, caption').eq('owner_type', 'album').eq('owner_id', id).order('sort_order').order('created_at');
  return { album: data as Omit<Album, 'cover' | 'count'>, images: (imgs ?? []) as PublicImage[] };
}
