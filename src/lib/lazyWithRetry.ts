import { ComponentType, lazy } from 'react';
import { reloadOnce } from './staleChunk';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * React.lazy() that survives failed page loads.
 * 1. A flaky network gets one quick retry.
 * 2. If it still fails the build is almost certainly stale (a new deploy removed the old files),
 *    so reload once to pick up the new build.
 * 3. If a reload just happened and it still fails, the error is shown by the ErrorBoundary.
 */
export function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  const load = async () => {
    const mod = await factory();
    // If something suppresses Vite's preload error, import() resolves to undefined instead of failing.
    // Treat that as the failure it is, so it is handled here and never reaches React as "undefined.default".
    if (!mod || !('default' in mod)) throw new Error('Failed to load page module');
    return mod;
  };

  return lazy(async () => {
    try {
      return await load();
    } catch {
      await sleep(600);
      try {
        return await load();
      } catch (err) {
        if (reloadOnce()) return new Promise<never>(() => {}); // the page is reloading; keep the spinner
        throw err;
      }
    }
  });
}
