import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { ContentMap, SiteSettings, fetchSiteContent, fetchSiteSettings } from './api';

// Neutral placeholder palette. Replace from Settings once the official colors are provided.
const DEFAULTS = { primary: '#1F3A5F', secondary: '#3B4A5C', accent: '#A67C2E' };
export const TBP = '[TO BE PROVIDED]';

function hexToTriplet(hex: string | null | undefined, fallback: string): string {
  const h = /^#[0-9A-Fa-f]{6}$/.test(hex ?? '') ? (hex as string) : fallback;
  return `${parseInt(h.slice(1, 3), 16)} ${parseInt(h.slice(3, 5), 16)} ${parseInt(h.slice(5, 7), 16)}`;
}

interface SiteValue {
  settings: SiteSettings | null;
  content: ContentMap;
  loading: boolean;
  error: string | null;
  text: (key: string) => string | undefined;
  items: <T = unknown>(key: string) => T[];
}

const SiteContext = createContext<SiteValue | undefined>(undefined);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [content, setContent] = useState<ContentMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchSiteSettings(), fetchSiteContent()])
      .then(([s, c]) => {
        if (!alive) return;
        setSettings(s);
        setContent(c);
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--c-primary', hexToTriplet(settings?.primary_color, DEFAULTS.primary));
    root.style.setProperty('--c-secondary', hexToTriplet(settings?.secondary_color, DEFAULTS.secondary));
    root.style.setProperty('--c-accent', hexToTriplet(settings?.accent_color, DEFAULTS.accent));
  }, [settings]);

  useEffect(() => {
    if (!settings) return;
    const previousTitle = document.title;
    document.title = settings.website_title || `${settings.college_name}, ${settings.campus_name}`;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const previousIcon = link?.href;
    if (link && settings.favicon_url) link.href = settings.favicon_url;
    return () => {
      document.title = previousTitle;
      if (link && previousIcon) link.href = previousIcon;
    };
  }, [settings]);

  const value = useMemo<SiteValue>(
    () => ({
      settings,
      content,
      loading,
      error,
      text: (key) => {
        const t = content[key]?.text?.trim();
        return t ? t : undefined;
      },
      items: <T,>(key: string) => ((content[key]?.items as T[] | undefined) ?? []),
    }),
    [settings, content, loading, error]
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteValue {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used within SiteProvider');
  return ctx;
}
