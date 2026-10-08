import { OcrAttendanceStatus } from '@/types';

export interface OcrRawRow {
  rollNumber: string;
  detectedStatus: OcrAttendanceStatus;
  confidence: number; // 0-100
}

const PRESENT_MARKS = ['p', 'present', '✓', '✔', 'yes', 'y'];
const ABSENT_MARKS = ['a', 'absent', 'no', 'n', '✗', 'x'];

function classifyMark(token: string): { status: OcrAttendanceStatus; strong: boolean } {
  const t = token.trim().toLowerCase().replace(/[.,]/g, '');
  if (!t) return { status: 'UNCLEAR', strong: false };
  if (PRESENT_MARKS.includes(t)) return { status: 'PRESENT', strong: true };
  if (ABSENT_MARKS.includes(t)) return { status: 'ABSENT', strong: true };
  if (/^l(ate)?$/.test(t)) return { status: 'LATE', strong: true };
  return { status: 'UNCLEAR', strong: false };
}

/**
 * Parses OCR word data into (roll number, status) pairs.
 *
 * Attendance sheets vary a lot in layout, so this looks for a number
 * token (the roll number) followed within a short distance — on the same
 * line, reading order — by a P/A/Present/Absent-style mark, and reports
 * Tesseract's own word confidence for the mark as the row's confidence.
 * Anything that doesn't match this pattern is left out of the result
 * entirely (surfaced to the CR as a line that needs manual entry), rather
 * than guessed — the review screen is the safety net, not this function.
 */
export function parseAttendanceWords(
  words: { text: string; confidence: number; line: number }[]
): OcrRawRow[] {
  const rows: OcrRawRow[] = [];
  const byLine = new Map<number, typeof words>();
  for (const w of words) {
    if (!byLine.has(w.line)) byLine.set(w.line, []);
    byLine.get(w.line)!.push(w);
  }

  for (const lineWords of byLine.values()) {
    const rollToken = lineWords.find((w) => /^\d{1,5}$/.test(w.text.trim()));
    if (!rollToken) continue;
    const rollIndex = lineWords.indexOf(rollToken);
    // Look at the next couple of tokens on the line for a status mark.
    const candidates = lineWords.slice(rollIndex + 1, rollIndex + 4);
    let best: { status: OcrAttendanceStatus; strong: boolean; confidence: number } | null = null;
    for (const c of candidates) {
      const classified = classifyMark(c.text);
      if (classified.strong) { best = { ...classified, confidence: c.confidence }; break; }
    }
    if (!best) {
      rows.push({ rollNumber: rollToken.text.trim(), detectedStatus: 'UNCLEAR', confidence: Math.round(rollToken.confidence) });
    } else {
      rows.push({ rollNumber: rollToken.text.trim(), detectedStatus: best.status, confidence: Math.round(Math.min(rollToken.confidence, best.confidence)) });
    }
  }
  return rows;
}

export interface OcrEngine {
  recognize(image: File | Blob): Promise<{ words: { text: string; confidence: number; line: number }[] }>;
  terminate(): Promise<void>;
}

/** Lazily loads Tesseract.js (kept out of the main bundle until the CR actually opens the scanner) and wraps it in a small, swappable interface. */
export async function createOcrEngine(): Promise<OcrEngine> {
  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker('eng');

  return {
    async recognize(image: File | Blob) {
      const { data } = await worker.recognize(image);
      const words = (data.words ?? []).map((w: any) => ({
        text: w.text as string,
        confidence: w.confidence as number,
        // Group by baseline row so tokens on the same printed line are compared together.
        line: Math.round((w.bbox?.y0 ?? 0) / 20),
      }));
      return { words };
    },
    async terminate() {
      await worker.terminate();
    },
  };
}
