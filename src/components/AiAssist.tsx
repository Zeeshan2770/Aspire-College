import { useRef, useState } from 'react';
import { AlertTriangle, Lightbulb, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Spinner } from '@/components/ui';
import { AiKind, AiMode, AiResult, aiWrite } from '@/services/aiWriter';

interface Props {
  kind: AiKind;
  /** Facts the assistant may use. Empty values are ignored. */
  context?: Record<string, string | null | undefined>;
  /** Current text of the field. */
  value: string;
  onApply: (text: string) => void;
  /** Hard limit of the field, if it has one. */
  maxChars?: number;
  notesHint?: string;
}

const MODES: { id: AiMode; label: string }[] = [
  { id: 'write', label: 'Write from key points' },
  { id: 'improve', label: 'Improve my text' },
  { id: 'shorter', label: 'Make shorter' },
];

/** Cuts text to a character limit at a word boundary, so a word is never sliced in half. */
export function fitToLimit(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  if (/\s/.test(text[max])) return cut; // the cut falls exactly between words
  const lastSpace = cut.search(/\s\S*$/);
  return lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
}

const area =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100';

/**
 * "Write with AI" helper that sits under a text field. It only drafts: the person reviews,
 * edits and chooses to use the text, and nothing is saved until they save the form themselves.
 */
export default function AiAssist({ kind, context, value, onApply, maxChars, notesHint }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AiMode>('write');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [text, setText] = useState('');
  const run = useRef(0); // ignores an answer that arrives after the panel was closed or re-run

  const hasText = value.trim().length >= 5;

  function openPanel() {
    setMode(hasText ? 'improve' : 'write');
    setError(null);
    setResult(null);
    setOpen(true);
  }

  function close() {
    run.current++;
    setOpen(false);
    setBusy(false);
    setResult(null);
    setError(null);
    setNotes('');
  }

  async function generate() {
    const id = ++run.current;
    setBusy(true);
    setError(null);
    setResult(null);
    const ctx: Record<string, string> = {};
    Object.entries(context ?? {}).forEach(([k, v]) => {
      if (v && String(v).trim()) ctx[k] = String(v).trim();
    });
    try {
      const r = await aiWrite({ kind, mode, context: ctx, notes: notes.trim(), draft: value });
      if (id !== run.current) return;
      setResult(r);
      setText(r.text);
    } catch (e) {
      if (id === run.current) setError((e as Error).message);
    } finally {
      if (id === run.current) setBusy(false);
    }
  }

  function apply(append: boolean) {
    const t = (maxChars ? fitToLimit(text, maxChars) : text).trim();
    if (!t) return;
    onApply(append && value.trim() ? `${value.trim()}\n\n${t}` : t);
    toast.success('Text added. Read it through, then save.');
    close();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Sparkles size={14} aria-hidden="true" /> Write with AI
      </button>
    );
  }

  const tooLong = maxChars !== undefined && text.length > maxChars;

  return (
    <div role="region" aria-label="AI writing assistant" className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
          <Sparkles size={14} aria-hidden="true" /> AI writing assistant
        </p>
        <button type="button" onClick={close} aria-label="Close the AI assistant" className="rounded p-1 text-slate-500 hover:bg-slate-200">
          <X size={16} />
        </button>
      </div>

      <div role="group" aria-label="What should the assistant do?" className="flex flex-wrap gap-2">
        {MODES.map((m) => {
          const disabled = m.id !== 'write' && !hasText;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              disabled={disabled}
              title={disabled ? 'Type some text in the field first' : undefined}
              onClick={() => setMode(m.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                mode === m.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {mode !== 'shorter' && (
        <div>
          <label htmlFor={`ai-notes-${kind}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Key points (optional if the form is already filled in)
          </label>
          <textarea
            id={`ai-notes-${kind}`}
            rows={3}
            maxLength={1500}
            className={area}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={notesHint ?? 'Type the facts in any order, even roughly. Only these facts will be used.'}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" size="sm" disabled={busy} onClick={generate}>
          {busy ? 'Working…' : mode === 'write' ? 'Write a draft' : mode === 'improve' ? 'Improve text' : 'Shorten text'}
        </Button>
        {busy && <Spinner className="h-4 w-4" />}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {busy ? 'The assistant is writing.' : result ? 'A draft is ready.' : ''}
      </p>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-3 border-t border-slate-200 pt-3">
          <div>
            <label htmlFor={`ai-result-${kind}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Suggested text (you can edit it before using it)
            </label>
            <textarea id={`ai-result-${kind}`} rows={6} className={area} value={text} onChange={(e) => setText(e.target.value)} />
            {maxChars !== undefined && (
              <p className={`mt-1 text-xs ${tooLong ? 'text-red-600' : 'text-slate-500'}`}>
                {text.length} / {maxChars} characters{tooLong ? ' (it will be cut to fit)' : ''}
              </p>
            )}
          </div>

          {result.warnings.length > 0 && (
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={14} aria-hidden="true" /> Check before using
              </p>
              <ul className="list-disc space-y-0.5 pl-5">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-slate-800">
                <Lightbulb size={14} aria-hidden="true" /> To make it better, you could add
              </p>
              <ul className="list-disc space-y-0.5 pl-5">
                {result.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!text.trim()} onClick={() => apply(false)}>
              {hasText ? 'Replace my text' : 'Use this text'}
            </Button>
            {hasText && mode === 'write' && (
              <Button type="button" size="sm" variant="secondary" disabled={!text.trim()} onClick={() => apply(true)}>
                Add below my text
              </Button>
            )}
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={generate}>
              Try again
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        AI drafts can contain mistakes. Check every name, number and claim before saving. Nothing is saved until you press Save on the form.
      </p>
    </div>
  );
}
