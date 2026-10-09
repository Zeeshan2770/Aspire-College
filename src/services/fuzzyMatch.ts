// Small, dependency-free fuzzy string matcher used to catch typos in CSV
// class/section names ("1st Yaer" -> "1st Year") without ever silently
// auto-correcting — callers always surface the suggestion for a human to
// accept.

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (!al) return bl;
  if (!bl) return al;

  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;

  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

/** 1.0 = identical, 0.0 = nothing in common. */
export function similarity(a: string, b: string): number {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return 0;
  if (x === y) return 1;
  const dist = levenshtein(x, y);
  return 1 - dist / Math.max(x.length, y.length);
}

/**
 * Finds the closest candidate to `input` that is NOT an exact match
 * (callers should exact-match first). Returns null if nothing clears the
 * threshold — a near-miss is only worth surfacing when it's actually close,
 * short strings need a stricter bar so "1A" doesn't "correct" to "1B".
 */
export function closestMatch(input: string, candidates: string[]): { value: string; score: number } | null {
  const trimmed = input.trim();
  if (!trimmed || !candidates.length) return null;

  let best: { value: string; score: number } | null = null;
  for (const c of candidates) {
    if (c.trim().toLowerCase() === trimmed.toLowerCase()) continue; // exact matches aren't "suggestions"
    const score = similarity(trimmed, c);
    if (!best || score > best.score) best = { value: c, score };
  }

  const threshold = trimmed.length <= 3 ? 0.74 : 0.6;
  return best && best.score >= threshold ? best : null;
}
