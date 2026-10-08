/**
 * Recovery for "stale build" failures.
 *
 * After a new deploy the old hashed files are deleted. A tab that was opened before the deploy then
 * asks for a file that no longer exists the next time the user navigates. The fix is to reload once
 * so the browser fetches the new index.html, which points at the new files.
 *
 * The guard is time-based, not "once per session": every new deploy gets its own recovery, but a
 * genuinely broken deploy cannot cause a reload loop.
 */
const KEY = 'stale_chunk_reload_at';
const MIN_GAP_MS = 10_000;

/** Reloads the page unless it already did so very recently. Returns true if a reload was started. */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < MIN_GAP_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage blocked (private mode, etc.): still try one reload.
  }
  window.location.reload();
  return true;
}

/** True for errors that mean "the code for this page could not be loaded". */
export function isChunkLoadError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  const msg = String(e?.message ?? '');
  return (
    e?.name === 'ChunkLoadError' ||
    e?.name === 'ReferenceError' ||
    /dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|is not defined|Unexpected token '<'|MIME type|Failed to load page module|reading 'default'|is not a function|is not a constructor/i.test(msg)
  );
}
