import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPages, renderHtml } from '../scripts/prerender-lib.mjs';
import { injectMeta } from '../netlify/edge-functions/og.js';

const TEMPLATE = '<!doctype html><html lang="en"><head><title>x</title><meta name="description" content="x" /></head><body><div id="root"></div></body></html>';
const data = {
  projects: [{ slug: 'cs-compass', name: 'CS <Compass>', short_description: 'A "portal"', status: 'Live', year: 2026, category: 'Education', featured: true,
    problem: 'P1\n\nP2', solution: 'S', project_features: [{ title: 'Labs', description: 'd', sort_order: 2 }, { title: 'Exams', description: '', sort_order: 1 }], thumbnail_url: '/assets/a.webp' }],
  services: [{ title: 'Web', summary: 'Sites', what_it_is: 'w', who_for: 'f', includes: ['a', 'b'] }],
  journey: [{ title: 'Start', description: 'began', period: '' }],
  insights: [{ slug: 'post', title: 'A post', excerpt: 'ex', content: '## Head\n\nText\n\n- a\n- b' }],
};
const { settings, pages } = buildPages({ name: 'Zeeshan Haider', email: 'a@b.c' }, data);

test('every public route is prerendered, including each project and article', () => {
  const paths = pages.map((p) => p.path);
  for (const r of ['/', '/about', '/projects', '/services', '/experience', '/blog', '/testimonials', '/contact', '/book', '/start-project', '/projects/cs-compass', '/blog/post']) assert.ok(paths.includes(r), `missing ${r}`);
});

test('each page has exactly one h1, a short title, a description, headings and internal links (what crawlers check)', () => {
  for (const p of pages) {
    const html = renderHtml(TEMPLATE, p, settings, 'https://example.com');
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${p.path}: h1 count`);
    assert.ok(p.title.length <= 60, `${p.path}: title too long (${p.title.length})`);
    assert.ok(p.description.length >= 40 && p.description.length <= 160, `${p.path}: description length ${p.description.length}`);
    assert.ok((html.match(/<a href="\//g) || []).length >= 8, `${p.path}: too few internal links`);
    assert.match(html, /<html lang="en">/);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://example.com${p.path === '/' ? '/' : p.path}" />`));
    assert.equal((html.match(/<title>/g) || []).length, 1);
    assert.equal((html.match(/name="description"/g) || []).length, 1);
    assert.ok(html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length > 35, `${p.path}: too little text`);
  }
});

test('home page is the name + positioning and has substantive headings', () => {
  const home = renderHtml(TEMPLATE, pages.find((p) => p.path === '/'), settings, 'https://example.com');
  assert.match(home, /<h1>Zeeshan Haider<\/h1>/);
  assert.match(home, /<h2>Selected work<\/h2>/);
  assert.match(home, /application\/ld\+json/);
});

test('content is escaped (no HTML injection from database text) and project sections are rendered in order', () => {
  const html = renderHtml(TEMPLATE, pages.find((p) => p.path === '/projects/cs-compass'), settings, 'https://example.com');
  assert.ok(!html.includes('<Compass>'));
  assert.match(html, /CS &lt;Compass&gt;/);
  assert.ok(html.indexOf('Exams') < html.indexOf('Labs'), 'features sorted by sort_order');
  assert.match(html, /<h2>The problem<\/h2><p>P1<\/p><p>P2<\/p>/);
  assert.match(html, /og:image" content="https:\/\/example\.com\/assets\/a\.webp"/);
  const art = renderHtml(TEMPLATE, pages.find((p) => p.path === '/blog/post'), settings, 'https://example.com');
  assert.match(art, /<h2>Head<\/h2><p>Text<\/p><ul><li>a<\/li><li>b<\/li><\/ul>/);
});

test('edge-function share-preview injection does not duplicate tags already prerendered', () => {
  const pre = renderHtml(TEMPLATE, pages.find((p) => p.path === '/projects/cs-compass'), settings, 'https://example.com');
  const out = injectMeta(pre, { title: 'T', description: 'D', url: 'https://example.com/projects/cs-compass', image: 'https://example.com/i.png' });
  assert.equal((out.match(/rel="canonical"/g) || []).length, 1);
  assert.equal((out.match(/property="og:title"/g) || []).length, 1);
  assert.equal((out.match(/name="description"/g) || []).length, 1);
  assert.equal((out.match(/twitter:card/g) || []).length, 1);
});

test('prerender honours SEO overrides, verification tags, noindex and sameAs', () => {
  const settings = { seo: { defaultDescription: 'Default description that is long enough to be a sensible meta description for tests.', keywords: 'dev, web', googleVerification: 'gv1', twitterHandle: '@me', pages: { '/about': { title: 'Custom About Title', noindex: true } } }, social: { github: 'https://github.com/x' } };
  const { settings: s, pages } = buildPages(settings, { projects: [{ id: 1, slug: 'p1', name: 'P1', short_description: 'A project description long enough to pass the minimum length rule for descriptions.', published: true, seo_title: 'Rec Title', og_image: '/o.webp', noindex: true, project_features: [] }] });
  const template = '<html><head><title>x</title><meta name="description" content="d" /></head><body><div id="root"></div></body></html>';
  const about = renderHtml(template, pages.find((p) => p.path === '/about'), s, 'https://e.com');
  assert.match(about, /<title>Custom About Title<\/title>/);
  assert.match(about, /name="robots" content="noindex, nofollow"/);
  assert.match(about, /google-site-verification" content="gv1"/);
  assert.match(about, /name="keywords" content="dev, web"/);
  assert.match(about, /twitter:site" content="@me"/);
  const proj = renderHtml(template, pages.find((p) => p.path === '/projects/p1'), s, 'https://e.com');
  assert.match(proj, /<title>Rec Title<\/title>/);
  assert.match(proj, /og:image" content="https:\/\/e.com\/o.webp"/);
  assert.match(proj, /noindex/);
  const home = renderHtml(template, pages.find((p) => p.path === '/'), s, 'https://e.com');
  assert.match(home, /"sameAs":\["https:\/\/github.com\/x"\]/);
  assert.match(home, /index, follow/);
});

// ---------- structured data (JSON-LD) ----------
import { buildJsonLd, ldToString } from '../src/lib/jsonld.js';
const ldOf = (html) => JSON.parse(html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<'));
const types = (ld) => ld['@graph'].map((n) => n['@type']);

test('every prerendered page carries one valid JSON-LD graph with Person, WebSite', () => {
  for (const p of pages) {
    const html = renderHtml(TEMPLATE, p, settings, 'https://example.com');
    assert.equal((html.match(/application\/ld\+json/g) || []).length, 1, `${p.path}: one ld+json`);
    const t = types(ldOf(html));
    assert.ok(t.includes('Person') && t.includes('WebSite'), `${p.path}: ${t}`);
    assert.equal(t.includes('BreadcrumbList'), p.path !== '/', `${p.path}: breadcrumbs`);
  }
});

test('articles become BlogPosting and projects CreativeWork, with a Home > section > page trail', () => {
  const art = ldOf(renderHtml(TEMPLATE, pages.find((p) => p.path === '/blog/post'), settings, 'https://example.com'));
  assert.ok(types(art).includes('BlogPosting'));
  const crumbs = art['@graph'].find((n) => n['@type'] === 'BreadcrumbList').itemListElement.map((c) => c.name);
  assert.deepEqual(crumbs, ['Home', 'Blogs', 'A post']);
  const proj = ldOf(renderHtml(TEMPLATE, pages.find((p) => p.path === '/projects/cs-compass'), settings, 'https://example.com'));
  assert.ok(types(proj).includes('CreativeWork'));
  assert.equal(proj['@graph'].find((n) => n['@type'] === 'CreativeWork').image, 'https://example.com/assets/a.webp');
});

test('JSON-LD never invents data and cannot break out of the script tag', () => {
  const ld = buildJsonLd({ settings: { name: '</script><b>x', social: { github: 'https://github.com/x', extra: [] } }, site: 'https://example.com', path: '/', kind: 'page' });
  const s = ldToString(ld);
  assert.ok(!s.includes('</script>'));
  assert.ok(!/aggregateRating|review|offers|price/i.test(s));
  assert.deepEqual(ld['@graph'].find((n) => n['@type'] === 'Person').sameAs, ['https://github.com/x']);
});
