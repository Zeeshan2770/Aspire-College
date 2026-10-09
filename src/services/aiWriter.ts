import { supabase } from '@/lib/supabase';

export type AiKind =
  | 'faculty_bio'
  | 'list_item_description'
  | 'site_tagline'
  | 'site_footer'
  | 'news_summary'
  | 'news_body'
  | 'event_description'
  | 'program_description'
  | 'program_eligibility'
  | 'principal_message'
  | 'page_text'
  | 'page_block';

export type AiMode = 'write' | 'improve' | 'shorter';

export interface AiResult {
  text: string;
  suggestions: string[];
  warnings: string[];
}

/** supabase-js hides the server's message behind a generic error; read the real one. */
async function explain(error: unknown): Promise<string> {
  const e = error as { name?: string; context?: Response };
  if (e.context && typeof e.context.json === 'function') {
    try {
      const body = await e.context.json();
      if (body?.error) return String(body.error);
    } catch {
      /* fall through */
    }
  }
  if (e.name === 'FunctionsFetchError') return 'Could not reach the AI service. Check your internet connection and try again.';
  return 'The AI writer could not be reached. Please try again.';
}

export async function aiWrite(input: {
  kind: AiKind;
  mode: AiMode;
  context: Record<string, string>;
  notes: string;
  draft: string;
}): Promise<AiResult> {
  const { data, error } = await supabase.functions.invoke('ai-writer', { body: input });
  if (error) throw new Error(await explain(error));
  if (!data || typeof data.text !== 'string') throw new Error('The AI returned an unexpected answer. Please try again.');
  return {
    text: data.text,
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };
}
