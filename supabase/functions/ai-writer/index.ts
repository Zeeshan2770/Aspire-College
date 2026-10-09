import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { handleRequest, type Deps } from './logic.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Secrets set in Supabase > Edge Functions > Secrets. Never put these in the browser code.
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// Google retires model names over time. The first name is used; if Google answers "not found" the next is tried.
const MODELS = [Deno.env.get('AI_WRITER_MODEL'), 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest'].filter((m, i, a): m is string => Boolean(m) && a.indexOf(m) === i);

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const deps: Deps = {
  hasApiKey: Boolean(GEMINI_API_KEY),

  async getCaller(authHeader) {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data, error } = await client.auth.getUser();
    return error || !data.user ? null : { id: data.user.id };
  },

  async getProfile(userId) {
    const { data } = await admin.from('profiles').select('role, is_active').eq('id', userId).maybeSingle();
    return data ?? null;
  },

  async getPermissions(userId) {
    const { data } = await admin.from('admin_permissions').select('manage_faculty, manage_content').eq('profile_id', userId).maybeSingle();
    return data ?? null;
  },

  async getSite() {
    const { data } = await admin.from('site_settings').select('college_name, campus_name').eq('id', 1).maybeSingle();
    return data ?? null;
  },

  async callModel({ system, user, maxTokens }) {
    const BASE = 'https://generativelanguage.googleapis.com/v1beta';
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    /** One attempt with one model. status 0 = network problem. */
    async function attempt(model: string): Promise<{ ok: true; text: string } | { ok: false; status: number }> {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      try {
        const r = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'x-goog-api-key': GEMINI_API_KEY!, 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            // Generous limit: some models spend part of it on internal reasoning before writing.
            generationConfig: { maxOutputTokens: Math.max(maxTokens, 300) * 4, temperature: 0.4, responseMimeType: 'application/json' },
          }),
        });
        if (!r.ok) {
          const detail = await r.text().catch(() => '');
          console.error('AI WRITER: model API returned', r.status, 'for', model, detail.slice(0, 300));
          return { ok: false, status: r.status === 400 && /API_KEY_INVALID|API key not valid/i.test(detail) ? 401 : r.status };
        }
        const data = await r.json();
        const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
        return { ok: true, text };
      } catch (e) {
        console.error('AI WRITER: model call failed for', model, e instanceof Error ? e.message : e);
        return { ok: false, status: 0 };
      } finally {
        clearTimeout(timer);
      }
    }

    /** Names of the Flash models this key may use right now, newest first (used when the fixed names are all retired). */
    async function discover(): Promise<string[]> {
      try {
        const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': GEMINI_API_KEY! } });
        if (!r.ok) return [];
        const j = await r.json();
        return (j?.models ?? [])
          .filter((m: { name?: string; supportedGenerationMethods?: string[] }) => /flash/i.test(m.name ?? '') && !/image|tts|live|audio|embed/i.test(m.name ?? '') && (m.supportedGenerationMethods ?? []).includes('generateContent'))
          .map((m: { name: string }) => m.name.replace(/^models\//, ''))
          .sort()
          .reverse()
          .slice(0, 3);
      } catch {
        return [];
      }
    }

    let lastStatus = 0;
    const tried = new Set<string>();
    const run = async (models: string[]) => {
      for (const model of models) {
        if (tried.has(model)) continue;
        tried.add(model);
        // Overloaded (503/500) is usually brief: one retry, then move on to the next model.
        for (let i = 0; i < 2; i++) {
          const res = await attempt(model);
          if (res.ok) return res;
          lastStatus = res.status;
          if (res.status === 401 || res.status === 403) return res; // the key itself is the problem
          if (res.status === 503 || res.status === 500) { await sleep(1200); continue; }
          break; // 404, 429, 400...: go to the next model
        }
      }
      return null;
    };

    const first = await run(MODELS);
    if (first) return first;
    if (lastStatus === 404) {
      const second = await run(await discover());
      if (second) return second;
    }
    // Overload and quota problems are temporary: report them as "busy".
    return { ok: false as const, status: lastStatus === 503 || lastStatus === 500 ? 429 : lastStatus };
  },
};

Deno.serve((req) => handleRequest(req, deps));
