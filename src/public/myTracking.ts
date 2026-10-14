/** Remembers (on this device only) the application number / question code a visitor was given, so the site can remind them to check for a decision or reply. The phone number is never stored. */
const KEY = 'aspire.tracking.v1';
export interface MyTracking { app?: string; q?: string }

export function readTracking(): MyTracking {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as MyTracking; } catch { return {}; }
}
export function saveTracking(kind: 'app' | 'q', value: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readTracking(), [kind]: value })); } catch { /* storage unavailable: ignore */ }
}
export function clearTracking(kind: 'app' | 'q') {
  try { const t = readTracking(); delete t[kind]; localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* ignore */ }
}
