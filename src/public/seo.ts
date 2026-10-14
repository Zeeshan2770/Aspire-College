import { useEffect } from 'react';

/**
 * Search-engine and social-share tags for the public website.
 * Edit KEYWORDS and PAGES below to change what each page says about itself in search results.
 */

export const KEYWORDS = [
  'Aspire Group of Colleges', 'Aspire College Taunsa Sharif', 'college in Taunsa Sharif',
  'college in Dera Ghazi Khan', 'intermediate college', 'admissions open', 'college admission',
  'FSc', 'ICS', 'FA', 'I.Com', 'faculty', 'student life', 'college news', 'Punjab Pakistan',
].join(', ');

// Description shown under each page's title in Google (keep to about 155 characters).
export const PAGES: Record<string, string> = {
  '/': 'Official website of Aspire Group of Colleges, Taunsa Sharif. Explore programs, admissions, faculty, news and campus life, and apply online.',
  '/about': 'About Aspire Group of Colleges, Taunsa Sharif: our story, mission, values and the principal\'s message.',
  '/academics': 'Programs and academic departments at Aspire Group of Colleges, Taunsa Sharif, with duration, levels and course details.',
  '/faculty': 'Meet the teachers and staff of Aspire Group of Colleges, Taunsa Sharif: qualifications, subjects and departments.',
  '/admissions': 'Admissions at Aspire Group of Colleges, Taunsa Sharif: eligibility, process, important dates and how to apply.',
  '/admissions/apply': 'Apply online for admission to Aspire Group of Colleges, Taunsa Sharif. Fill in the form and track your application.',
  '/student-life': 'Student life at Aspire Group of Colleges, Taunsa Sharif: activities, events, societies and campus facilities.',
  '/news': 'Latest news, announcements and events from Aspire Group of Colleges, Taunsa Sharif.',
  '/gallery': 'Photo and video gallery of events and campus life at Aspire Group of Colleges, Taunsa Sharif.',
  '/ask': 'Ask Aspire Group of Colleges, Taunsa Sharif a question about admissions, programs or the campus and get a reply.',
  '/contact': 'Contact Aspire Group of Colleges, Taunsa Sharif: address, phone, email and map.',
};

function upsert(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) { el = create(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
}
const metaName = (name: string, content: string) =>
  upsert(`meta[name="${name}"]`, () => { const m = document.createElement('meta'); m.setAttribute('name', name); return m; }, 'content', content);
const metaProp = (prop: string, content: string) =>
  upsert(`meta[property="${prop}"]`, () => { const m = document.createElement('meta'); m.setAttribute('property', prop); return m; }, 'content', content);

export interface SeoInput {
  title: string;
  description: string;
  image?: string | null;
  type?: 'website' | 'article';
  keywords?: string;
}

/** Updates title, description, keywords, Open Graph and Twitter tags in one go. */
export function applySeo({ title, description, image, type = 'website', keywords = KEYWORDS }: SeoInput) {
  const desc = description.replace(/\s+/g, ' ').trim().slice(0, 160);
  document.title = title;
  metaName('description', desc);
  metaName('keywords', keywords);
  metaProp('og:title', title);
  metaProp('og:description', desc);
  metaProp('og:type', type);
  metaProp('og:url', window.location.origin + window.location.pathname);
  metaName('twitter:title', title);
  metaName('twitter:description', desc);
  if (image) {
    metaProp('og:image', image);
    metaName('twitter:image', image);
    metaName('twitter:card', 'summary_large_image');
  }
}

/** Set (or replace) a JSON-LD structured-data block. Pass null to remove it. */
export function setJsonLd(id: string, data: object | null) {
  const sel = `script[data-seo="${id}"]`;
  let el = document.head.querySelector<HTMLScriptElement>(sel);
  if (!data) { el?.remove(); return; }
  if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.setAttribute('data-seo', id); document.head.appendChild(el); }
  el.textContent = JSON.stringify(data);
}

/** For a detail page (one news article, one album): set its tags once the content has loaded. */
export function useSeo(input: SeoInput | null, jsonLd?: { id: string; data: object } | null) {
  const key = input ? JSON.stringify([input, jsonLd]) : '';
  useEffect(() => {
    if (!input) return;
    applySeo(input);
    if (jsonLd) setJsonLd(jsonLd.id, jsonLd.data);
    return () => { if (jsonLd) setJsonLd(jsonLd.id, null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
