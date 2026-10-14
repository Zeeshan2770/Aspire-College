// Supabase Edge Function: notify-applicant
// Staff press "Email automatically" on an application (body: {application_id}) or an Ask Us question (body: {query_id}).
// It sends the decision / reply email automatically (via Resend).
// Setup (once):
//   supabase secrets set RESEND_API_KEY=re_xxx FROM_EMAIL="Aspire College <admissions@yourdomain.com>" SITE_URL=https://yoursite.com
//   supabase functions deploy notify-applicant
// The caller's own login is used to read the application, so only staff who can see it can trigger an email.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...cors } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('FROM_EMAIL');
    if (!key || !from) return json({ error: 'Automatic email is not set up yet (RESEND_API_KEY / FROM_EMAIL missing).' }, 503);

    const auth = req.headers.get('Authorization') ?? '';
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await db.auth.getUser();
    if (!u?.user) return json({ error: 'Please sign in again.' }, 401);

    const { application_id, query_id } = await req.json();
    const { data: s } = await db.from('site_settings').select('college_name,campus_name,phone,email').limit(1).maybeSingle();
    const college = s?.college_name ?? 'the college';
    const site = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');
    const footer = ['Regards,', `${college}${s?.campus_name ? ', ' + s.campus_name : ''}`, [s?.phone, s?.email].filter(Boolean).join(' | ')];
    let to: string; let subject: string; let lines: string[];

    if (query_id) {
      // Ask Us: email the latest public reply to the person who asked.
      const { data: q, error } = await db.from('public_queries').select('name,email,code,subject').eq('id', query_id).single();
      if (error || !q) return json({ error: 'Question not found, or you do not have access.' }, 404);
      if (!q.email) return json({ error: 'This person gave no email address.' }, 400);
      const { data: rs } = await db.from('query_replies').select('body').eq('query_id', query_id).eq('is_public', true).order('created_at', { ascending: false }).limit(1);
      if (!rs?.length) return json({ error: 'Write a public reply first, then email it.' }, 400);
      to = q.email; subject = `Reply to your question ${q.code} · ${college}`;
      lines = [`Dear ${q.name ?? 'there'},`, '', `Thank you for writing to ${college}. About your question "${q.subject}":`, '', rs[0].body, '',
        `Your tracking code is ${q.code}.`, site ? `You can also read the reply here: ${site}/ask/track` : ''];
    } else {
      const { data: app, error } = await db.from('admissions').select('full_name,email,application_no,program_applied,status').eq('id', application_id).single();
      if (error || !app) return json({ error: 'Application not found, or you do not have access.' }, 404);
      if (!app.email) return json({ error: 'This applicant gave no email address.' }, 400);
      const statusLine: Record<string, string> = {
        ACCEPTED: `Congratulations! Your application for ${app.program_applied} has been accepted. Please visit the admissions office to complete your admission.`,
        REJECTED: `After reviewing your application for ${app.program_applied}, we are sorry to tell you that we cannot offer you admission at this time.`,
        UNDER_REVIEW: `Your application for ${app.program_applied} is now under review. We will let you know once a decision is made.`,
        SUBMITTED: `We have received your application for ${app.program_applied}. We will contact you after it is reviewed.`,
      };
      to = app.email; subject = `Your application ${app.application_no} · ${college}`;
      lines = [`Dear ${app.full_name},`, '', statusLine[app.status] ?? statusLine.SUBMITTED, '', `Application number: ${app.application_no}`,
        site ? `Check your status any time: ${site}/admissions/status (use your application number and phone number).` : ''];
    }
    const text = [...lines, '', ...footer].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!r.ok) return json({ error: 'The email service refused the message.', detail: (await r.text()).slice(0, 300) }, 502);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error.' }, 500);
  }
});
