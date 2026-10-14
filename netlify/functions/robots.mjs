// Serves /robots.txt (see netlify.toml). Generated so the Sitemap line carries the real domain.
export default async (req) => {
  const origin = new URL(req.url).origin;
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Private portals and personal tracking pages: not for search results',
    'Disallow: /admin',
    'Disallow: /cr',
    'Disallow: /student',
    'Disallow: /sub-admin',
    'Disallow: /principal',
    'Disallow: /dashboard',
    'Disallow: /login',
    'Disallow: /profile',
    'Disallow: /announcements',
    'Disallow: /concerns',
    'Disallow: /admissions/status',
    'Disallow: /ask/track',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  });
};
