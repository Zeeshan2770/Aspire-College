/** Recognises video links (YouTube, Vimeo, Facebook) so they can be shown as embedded players. No database change is needed: links are stored as ordinary text. */
export interface VideoInfo {
  provider: 'youtube' | 'vimeo' | 'facebook' | 'instagram' | 'tiktok';
  /** width ÷ height of the player: 16/9 for landscape video, about 0.5 for vertical reels/TikToks. */
  ratio: number;
  embed: string;
  thumb: string | null;
  watch: string;
}

export function parseVideo(raw: string | null | undefined): VideoInfo | null {
  const url = (raw ?? '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^(www\.|m\.)/, '');

  if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (u.pathname === '/watch') id = u.searchParams.get('v');
    else { const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/); id = m ? m[1] : null; }
    if (id && /^[\w-]{11}$/.test(id)) {
      return { provider: 'youtube', ratio: id && u.pathname.startsWith('/shorts/') ? 9 / 16 : 16 / 9, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, watch: `https://www.youtube.com/watch?v=${id}` };
    }
    return null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/(\d{5,})/);
    if (m) return { provider: 'vimeo', ratio: 16 / 9, embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, thumb: null, watch: `https://vimeo.com/${m[1]}` };
    return null;
  }
  if (host === 'facebook.com' || host === 'fb.watch') {
    if (host === 'fb.watch' || /\/(videos?|reel|watch)\b/.test(u.pathname)) {
      return { provider: 'facebook', ratio: 16 / 9, embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`, thumb: null, watch: url };
    }
  }
  if (host === 'instagram.com') {
    const m = u.pathname.match(/^\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/);
    if (m) {
      const kind = m[1] === 'p' ? 'p' : 'reel';
      return { provider: 'instagram', ratio: kind === 'p' ? 0.62 : 0.52, embed: `https://www.instagram.com/${kind}/${m[2]}/embed/`, thumb: null, watch: url };
    }
    return null;
  }
  if (host === 'tiktok.com') {
    const m = u.pathname.match(/\/video\/(\d{8,})/);
    if (m) return { provider: 'tiktok', ratio: 0.46, embed: `https://www.tiktok.com/embed/v2/${m[1]}`, thumb: null, watch: url };
    return null;
  }
  return null;
}

export const isVideoUrl = (u: string | null | undefined) => parseVideo(u) !== null;

/** Finds video links inside free text (announcements, news body, event descriptions). */
export function extractVideoUrls(text: string | null | undefined, max = 3): string[] {
  const found = (text ?? '').match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return Array.from(new Set(found.filter(isVideoUrl))).slice(0, max);
}
