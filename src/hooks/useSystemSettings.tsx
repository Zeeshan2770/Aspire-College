import { useEffect, useState } from 'react';
import { getSettings } from '@/services/settings';
import { SystemSettings } from '@/types';

// Module-level cache: every consumer on the page shares one fetch instead of
// each component (sidebar, settings page, login page) hitting Supabase
// separately. Settings.tsx calls refreshSystemSettingsCache() after a
// successful save so the rest of the app picks up the change immediately.
let cache: SystemSettings | null = null;
let inflight: Promise<SystemSettings> | null = null;
const listeners = new Set<(s: SystemSettings) => void>();

function load(): Promise<SystemSettings> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = getSettings()
      .then((s) => {
        cache = s;
        inflight = null;
        return s;
      })
      .catch((err) => {
        inflight = null;
        throw err;
      });
  }
  return inflight;
}

export function refreshSystemSettingsCache(next?: SystemSettings) {
  if (next) {
    cache = next;
    listeners.forEach((l) => l(next));
    return;
  }
  cache = null;
  load().then((s) => listeners.forEach((l) => l(s)));
}

/** Read-only, cached access to system_settings. Returns null until the first load resolves. */
export function useSystemSettings(): SystemSettings | null {
  const [settings, setSettings] = useState<SystemSettings | null>(cache);

  useEffect(() => {
    let cancelled = false;
    listeners.add(setSettings);
    if (!cache) {
      load().then((s) => {
        if (!cancelled) setSettings(s);
      });
    }
    return () => {
      cancelled = true;
      listeners.delete(setSettings);
    };
  }, []);

  return settings;
}
