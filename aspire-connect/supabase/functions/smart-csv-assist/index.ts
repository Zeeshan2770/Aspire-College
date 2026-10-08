// ============================================================
// ASPIRE GROUP OF COLLEGES — MANAGEMENT PORTAL
// Supabase Edge Function: smart-csv-assist
//
// Optional AI-assisted fallback for the Smart CSV Import Wizard.
// The wizard already resolves most problems deterministically (required
// fields, exact + typo-fuzzy class/section matching, roll-number
// duplicate/conflict detection) entirely client-side and instantly. This
// function only runs when the admin explicitly clicks "AI Assist" for
// rows that are STILL unresolved after that — messy names, roll numbers
// buried in the wrong column, abbreviations that don't fuzzy-match
// ("FSC-I" vs "1st Year"), etc.
//
// It never writes anything and never touches the database — it only
// returns *suggestions*. The wizard always shows each suggestion to the
// admin and applies it only on a click. Nothing here is authoritative.
//
// SECURITY:
// Restricted to accounts allowed to import students (Main Super Admin, or
// a Sub Admin with the import_students permission) — the same rule
// apply_student_import() enforces in Postgres. Uses the service role key
// only to check the caller's own permissions; row data sent to the AI
// provider is whatever the admin already has open in the wizard.
//
// CONFIGURATION:
// Requires an OPENAI_API_KEY secret, set via:
//   supabase secrets set OPENAI_API_KEY=sk-...
// Never hardcode the key here — secrets set this way are injected at
// runtime only and are never part of the source you deploy or download.
// If it isn't set, this returns a clear, actionable error instead of a
// generic failure — AI Assist is an optional enhancement, not a
// requirement for importing students.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Required Supabase environment variables are missing.');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

interface ProblemRow {
  csvRowNumber: number;
  name: string;
  fatherName: string;
  rollNumber: string;
  className: string;
  sectionName: string;
  phone: string;
  issue: string; // human-readable reason it needs a fix, e.g. "Roll Number Missing."
}

interface Suggestion {
  csvRowNumber: number;
  name?: string;
  fatherName?: string;
  rollNumber?: string;
  className?: string;
  sectionName?: string;
  phone?: string;
  note: string;
  confidence: 'high' | 'medium' | 'low';
}

const MAX_ROWS_PER_CALL = 40; // keep the prompt small and the response fast

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    if (!OPENAI_API_KEY) {
      return json({
        error: 'AI Assist isn\u2019t configured yet. Ask your developer to add an OPENAI_API_KEY secret to the Supabase project (supabase secrets set OPENAI_API_KEY=sk-...).',
      }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not authenticated.' }, 401);

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Invalid or expired session.' }, 401);
    const caller = authData.user;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, is_active')
      .eq('id', caller.id)
      .single();
    if (profileError || !callerProfile) return json({ error: 'Your profile could not be found.' }, 403);
    if (callerProfile.is_active === false) return json({ error: 'Your account has been disabled.' }, 403);

    let allowed = callerProfile.role === 'MAIN_SUPER_ADMIN';
    if (!allowed) {
      const { data: perms } = await adminClient
        .from('admin_permissions')
        .select('import_students')
        .eq('profile_id', caller.id)
        .single();
      allowed = !!perms?.import_students;
    }
    if (!allowed) return json({ error: "You don't have permission to import students." }, 403);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON request body.' }, 400);
    }

    const rows: ProblemRow[] = Array.isArray(body?.rows) ? body.rows.slice(0, MAX_ROWS_PER_CALL) : [];
    const knownClasses: string[] = Array.isArray(body?.knownClasses) ? body.knownClasses : [];
    const knownSections: { class: string; section: string }[] = Array.isArray(body?.knownSections) ? body.knownSections : [];

    if (!rows.length) return json({ error: 'No rows to analyze.' }, 400);

    const structureText = knownClasses.length
      ? knownClasses.map((c) => {
          const secs = knownSections.filter((s) => s.class === c).map((s) => s.section);
          return `- ${c}${secs.length ? `: ${secs.join(', ')}` : ''}`;
        }).join('\n')
      : '(no classes/sections exist yet — this may be the first import)';

    const rowsText = rows.map((r) =>
      `Row ${r.csvRowNumber} | Name="${r.name}" | Father="${r.fatherName}" | Roll="${r.rollNumber}" | Class="${r.className}" | Section="${r.sectionName}" | Phone="${r.phone}" | Issue: ${r.issue}`
    ).join('\n');

    const prompt = `You are helping a school admin fix messy rows in a student-roster CSV import for a college. Below is the school's EXISTING class/section structure, followed by CSV rows that a deterministic validator flagged as needing attention.

EXISTING STRUCTURE:
${structureText}

PROBLEM ROWS:
${rowsText}

For each row, suggest corrected values ONLY for fields that plausibly need fixing (e.g. a class name that's an abbreviation or typo of an existing one, a name that's clearly "Last, First" instead of "First Last", whitespace/OCR artifacts). Do NOT invent a roll number, name, or any data that isn't reasonably inferable from what's given — leave that field out of your suggestion instead of guessing. Prefer matching className/sectionName to the EXISTING STRUCTURE when the row is plausibly one of those, but if it looks like a genuinely new class/section, suggest a cleaned-up version of what's in the row instead.

Respond with ONLY a JSON object (no markdown fences, no prose) shaped exactly like:
{"suggestions": [{"csvRowNumber": 1, "name": "...", "className": "...", "sectionName": "...", "note": "short human-readable reason", "confidence": "high"|"medium"|"low"}]}
One entry per row you have a suggestion for (skip rows you can't help with). Only include the fields you're actually suggesting a change for, always include csvRowNumber, note, and confidence.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You output ONLY a JSON object shaped like {"suggestions": [...]}. No markdown, no prose outside the JSON.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => '');
      console.error('SMART CSV ASSIST — OpenAI API error:', aiResponse.status, errText);
      return json({ error: 'AI Assist is temporarily unavailable. You can still fix rows manually.' }, 502);
    }

    const aiData = await aiResponse.json();
    const raw = (aiData?.choices?.[0]?.message?.content ?? '').trim();

    let suggestions: Suggestion[];
    try {
      const parsed = JSON.parse(raw);
      // response_format:json_object forces a top-level object, so we ask the
      // model to nest the array under "suggestions" rather than return a
      // bare array (which that mode doesn't allow).
      suggestions = Array.isArray(parsed) ? parsed : parsed.suggestions;
      if (!Array.isArray(suggestions)) throw new Error('not an array');
    } catch {
      console.error('SMART CSV ASSIST — could not parse AI response:', raw);
      return json({ error: 'AI Assist could not analyze these rows. You can still fix them manually.' }, 502);
    }

    // Defensive cleanup: only pass through rows that were actually asked about.
    const validRowNumbers = new Set(rows.map((r) => r.csvRowNumber));
    suggestions = suggestions.filter((s) => validRowNumbers.has(s.csvRowNumber));

    return json({ success: true, suggestions });
  } catch (error) {
    console.error('SMART CSV ASSIST FUNCTION ERROR:', error);
    return json({ error: 'An unexpected server error occurred.' }, 500);
  }
});
