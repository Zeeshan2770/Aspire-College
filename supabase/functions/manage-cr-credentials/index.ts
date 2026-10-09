// ============================================================
// ASPIRE GROUP OF COLLEGES — MANAGEMENT PORTAL
// Supabase Edge Function: manage-cr-credentials
//
// Lets the MAIN_SUPER_ADMIN:
//   - "generate"       : create a CR account with a structured,
//                          non-random name but an auto-generated
//                          email + random password.
//   - "update_email"    : change an existing CR's login email.
//   - "reset_password"  : issue a new password for an existing CR.
//
// Every action is written to `login_sessions` so the Main Super
// Admin can see who changed which account, and when.
//
// SECURITY:
// Restricted to MAIN_SUPER_ADMIN only. Uses the service role key,
// which never leaves this server-side function.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Required Supabase environment variables are missing.');
}

const CR_EMAIL_DOMAIN = 'aspiretaunsa.com';

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

// Turns "BCS" / "Part 2" into "bcs" / "part2" for use in an email's local part.
function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function generatePassword(length = 10): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%';
  const all = upper + lower + digits + symbols;

  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);

  // Guarantee at least one char from each category, then fill the rest.
  const required = [upper, lower, digits, symbols].map(
    (set, i) => set[bytes[i] % set.length]
  );
  const rest = Array.from({ length: length - required.length }, (_, i) =>
    all[bytes[i + required.length] % all.length]
  );

  const chars = [...required, ...rest];
  // Simple shuffle using the same random bytes.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i % bytes.length] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
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
      .select('id, role, full_name, is_active')
      .eq('id', caller.id)
      .single();

    if (profileError || !callerProfile) return json({ error: 'Your profile could not be found.' }, 403);
    if (callerProfile.is_active === false) return json({ error: 'Your account has been disabled.' }, 403);
    if (callerProfile.role !== 'MAIN_SUPER_ADMIN') {
      return json({ error: 'Only the Main Super Admin can manage CR credentials.' }, 403);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON request body.' }, 400);
    }

    const action = body?.action;

    // ============================================================
    // ACTION: generate — create a new CR account
    // ============================================================
    if (action === 'generate') {
      const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
      const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
      const classId = typeof body.classId === 'string' ? body.classId : '';
      const sectionId = typeof body.sectionId === 'string' ? body.sectionId : '';

      if (!fullName) return json({ error: "The CR's full name is required." }, 400);
      if (!classId || !sectionId) return json({ error: 'Class and section are required.' }, 400);

      const { data: classRow } = await adminClient.from('classes').select('name').eq('id', classId).single();
      const { data: sectionRow } = await adminClient.from('sections').select('name').eq('id', sectionId).single();
      if (!classRow || !sectionRow) return json({ error: 'Class or section not found.' }, 400);

      const base = `cr${slug(sectionRow.name)}${slug(classRow.name)}`;
      if (!base || base === 'cr') {
        return json({ error: 'Could not derive an email from this class/section name.' }, 400);
      }

      // Allow the caller to override the generated local-part or domain,
      // but fall back to the auto-generated one if not provided.
      let email = typeof body.email === 'string' && body.email.trim()
        ? body.email.trim().toLowerCase()
        : `${base}@${CR_EMAIL_DOMAIN}`;

      // Resolve collisions by appending 2, 3, 4... to the local part.
      if (!(typeof body.email === 'string' && body.email.trim())) {
        for (let attempt = 1; attempt <= 25; attempt++) {
          const candidate = attempt === 1 ? `${base}@${CR_EMAIL_DOMAIN}` : `${base}${attempt}@${CR_EMAIL_DOMAIN}`;
          const { data: existing } = await adminClient.from('profiles').select('id').eq('email', candidate).maybeSingle();
          if (!existing) { email = candidate; break; }
          if (attempt === 25) return json({ error: 'Could not find a free email after 25 attempts. Please set one manually.' }, 400);
        }
      }

      const password = generatePassword(10);

      const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (createUserError || !createdUserData.user) {
        return json({ error: createUserError?.message || 'Failed to create the CR account.' }, 400);
      }
      const newUser = createdUserData.user;

      const { error: createProfileError } = await adminClient.from('profiles').insert({
        id: newUser.id, full_name: fullName, email, phone: phone || null, role: 'CR', is_active: true,
      });
      if (createProfileError) {
        await adminClient.auth.admin.deleteUser(newUser.id);
        return json({ error: createProfileError.message }, 400);
      }

      const { error: credError } = await adminClient.from('cr_credentials').insert({
        cr_user_id: newUser.id, class_id: classId, section_id: sectionId,
        email, temp_password: password, created_by: caller.id,
      });
      if (credError) {
        await adminClient.from('profiles').delete().eq('id', newUser.id);
        await adminClient.auth.admin.deleteUser(newUser.id);
        return json({ error: 'Failed to save credentials: ' + credError.message }, 400);
      }

      await adminClient.from('login_sessions').insert({
        user_id: newUser.id, user_name: fullName, user_role: 'CR',
        event_type: 'ACCOUNT_CREATED',
        description: `CR account generated for ${sectionRow.name} — ${classRow.name} by ${callerProfile.full_name}.`,
        performed_by: caller.id, performed_by_name: callerProfile.full_name,
      });

      return json({
        success: true,
        user: { id: newUser.id, full_name: fullName, email, phone },
        password,
      }, 201);
    }

    // ============================================================
    // ACTION: update_email — change a CR's login email
    // ============================================================
    if (action === 'update_email') {
      const crUserId = typeof body.crUserId === 'string' ? body.crUserId : '';
      const newEmail = typeof body.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : '';
      if (!crUserId || !newEmail) return json({ error: 'crUserId and newEmail are required.' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return json({ error: 'That does not look like a valid email address.' }, 400);

      const { data: existing } = await adminClient.from('profiles').select('id').eq('email', newEmail).maybeSingle();
      if (existing && existing.id !== crUserId) return json({ error: 'That email is already in use.' }, 400);

      const { data: target } = await adminClient.from('profiles').select('full_name, role').eq('id', crUserId).single();
      if (!target) return json({ error: 'CR account not found.' }, 404);

      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(crUserId, {
        email: newEmail, email_confirm: true,
      });
      if (authUpdateError) return json({ error: authUpdateError.message }, 400);

      await adminClient.from('profiles').update({ email: newEmail }).eq('id', crUserId);
      await adminClient.from('cr_credentials').update({ email: newEmail, updated_at: new Date().toISOString() }).eq('cr_user_id', crUserId);

      await adminClient.from('login_sessions').insert({
        user_id: crUserId, user_name: target.full_name, user_role: target.role,
        event_type: 'EMAIL_CHANGED',
        description: `Login email changed to ${newEmail} by ${callerProfile.full_name}.`,
        performed_by: caller.id, performed_by_name: callerProfile.full_name,
      });

      return json({ success: true, email: newEmail });
    }

    // ============================================================
    // ACTION: reset_password — issue a new password for a CR
    // ============================================================
    if (action === 'reset_password') {
      const crUserId = typeof body.crUserId === 'string' ? body.crUserId : '';
      if (!crUserId) return json({ error: 'crUserId is required.' }, 400);

      const requestedPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
      if (requestedPassword && requestedPassword.length < 8) {
        return json({ error: 'Password must be at least 8 characters.' }, 400);
      }
      const password = requestedPassword || generatePassword(10);

      const { data: target } = await adminClient.from('profiles').select('full_name, role').eq('id', crUserId).single();
      if (!target) return json({ error: 'CR account not found.' }, 404);

      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(crUserId, { password });
      if (authUpdateError) return json({ error: authUpdateError.message }, 400);

      await adminClient.from('cr_credentials').update({ temp_password: password, updated_at: new Date().toISOString() }).eq('cr_user_id', crUserId);

      await adminClient.from('login_sessions').insert({
        user_id: crUserId, user_name: target.full_name, user_role: target.role,
        event_type: 'PASSWORD_CHANGED',
        description: `Password reset by ${callerProfile.full_name}.`,
        performed_by: caller.id, performed_by_name: callerProfile.full_name,
      });

      return json({ success: true, password });
    }

    // ============================================================
    // ACTION: delete — permanently remove a CR account
    //
    // Deleting the auth user cascades (via `on delete cascade` FKs) to
    // remove their profile, section assignment(s), credentials-vault
    // row, warnings, and session log entries automatically.
    // ============================================================
    if (action === 'delete') {
      const crUserId = typeof body.crUserId === 'string' ? body.crUserId : '';
      if (!crUserId) return json({ error: 'crUserId is required.' }, 400);

      const { data: target } = await adminClient.from('profiles').select('full_name, role').eq('id', crUserId).single();
      if (!target) return json({ error: 'CR account not found.' }, 404);
      if (target.role !== 'CR') return json({ error: 'Only CR accounts can be deleted with this action.' }, 400);

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(crUserId);
      if (deleteError) return json({ error: deleteError.message }, 400);

      return json({ success: true, deletedName: target.full_name });
    }

    return json({ error: `Unknown action "${action}".` }, 400);
  } catch (error) {
    console.error('MANAGE CR CREDENTIALS FUNCTION ERROR:', error);
    return json({ error: 'An unexpected server error occurred.' }, 500);
  }
});
