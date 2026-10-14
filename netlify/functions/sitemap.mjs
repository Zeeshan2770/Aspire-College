// Serves /sitemap.xml (see netlify.toml). Built on request so new news posts and photo albums
// appear automatically, with no rebuild. The domain is read from the request, so it works on
// the netlify.app address and on a custom domain alike.

const STATIC_PAGES = [
  // [path, changefreq, priority]
  ['/', 'daily', '1.0'],
  ['/admissions', 'weekly', '0.9'],
  ['/admissions/apply', 'weekly', '0.9'],
  ['/academics', 'monthly', '0.8'],
  ['/about', 'monthly', '0.7'],
  ['/faculty', 'monthly', '0.7'],
  ['/news', 'daily', '0.8'],
  ['/student-life', 'monthly', '0.6'],
  ['/gallery', 'weekly', '0.6'],
  ['/contact', 'monthly', '0.7'],
  ['/ask', 'monthly', '0.5'],
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const day = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

async function rows(table, select, order) {
  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) return [];
  try {
    const url = `${base.replace(/\/$/, '')}/rest/v1/${table}?select=${select}&status=eq.PUBLISHED&order=${order}&limit=1000`;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export default async (req) => {
  const origin = new URL(req.url).origin;
  const [news, albums] = await Promise.all([
    rows('news', 'id,published_at', 'published_at.desc'),
    rows('gallery_albums', 'id,event_date,created_at', 'created_at.desc'),
  ]);

  const entries = STATIC_PAGES.map(([p, freq, pri]) => ({ loc: origin + p, freq, pri, mod: null }));
  news.forEach((n) => entries.push({ loc: `${origin}/news/${n.id}`, freq: 'monthly', pri: '0.6', mod: day(n.published_at) }));
  albums.forEach((a) => entries.push({ loc: `${origin}/gallery/${a.id}`, freq: 'monthly', pri: '0.4', mod: day(a.event_date) || day(a.created_at) }));

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map((e) => `  <url>\n    <loc>${esc(e.loc)}</loc>\n${e.mod ? `    <lastmod>${e.mod}</lastmod>\n` : ''}    <changefreq>${e.freq}</changefreq>\n    <priority>${e.pri}</priority>\n  </url>`)
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
};
