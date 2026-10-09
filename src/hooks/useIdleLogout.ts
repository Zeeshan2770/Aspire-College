import { useEffect, useRef } from 'react';

// How long a user can be inactive (no mouse/keyboard/touch/scroll) before
// being automatically signed out. Change this single constant to adjust
// the timeout for the whole app.
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

/**
 * Calls `onIdle` once the user has been inactive for `timeoutMs`. Only
 * mount this while the user is actually authenticated (e.g. inside
 * DashboardLayout) — it does nothing on the login screen.
 */
export function useIdleLogout(onIdle: () => void, timeoutMs: number = IDLE_TIMEOUT_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onIdleRef.current(), timeoutMs);
    }

    reset();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
    document.addEventListener('visibilitychange', reset);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
      document.removeEventListener('visibilitychange', reset);
    };
  }, [timeoutMs]);
}
