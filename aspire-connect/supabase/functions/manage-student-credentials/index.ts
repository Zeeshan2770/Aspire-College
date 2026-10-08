// ============================================================
// ASPIRE GROUP OF COLLEGES — MANAGEMENT PORTAL
// Supabase Edge Function: manage-student-credentials
//
// Lets the MAIN_SUPER_ADMIN:
//   - "create"          : link a student record to a brand-new Supabase
//                          Auth login — generates a permanent Student ID
//                          (STU-YY-NNNNNNN), a synthetic username email,
//                          and a human-readable temporary password.
//   - "reset_password"   : issue a new temporary password for an
//                          existing student account.
//   - "regenerate"        : alias of reset_password, kept as a separate
//                          action name to match the "regenerate temporary
//                          credentials" wording in the spec.
//   - "disable" / "enable": flip profiles.is_active for a student login.
//   - "delete"            : permanently remove a student's login (the
//                          underlying student record is NOT deleted —
//                          only the account, exactly like removing a
//                          CR's login leaves the roster intact).
//
// SECURITY:
// Restricted to MAIN_SUPER_ADMIN only. Uses the service role key, which
// never leaves this server-side function. Never stores a real, usable
// password in a normal table without RLS locking it to MAIN_SUPER_ADMIN
// only (see student_credentials RLS in 0015_student_portal.sql).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Required Supabase environment variables are missing.');
}

// Supabase Auth needs an email-shaped identifier. Students log in with a
// human "Student ID / Username" on the login page instead — the frontend
// translates that into <username>@STUDENT_EMAIL_DOMAIN before calling
// signInWithPassword. This mirrors exactly how CR accounts already use a
// synthetic @aspiretaunsa.com email under the hood (see
// manage-cr-credentials) while presenting a friendlier identifier to the
// person actually typing it in.
const STUDENT_EMAIL_DOMAIN = 'students.aspiretaunsa.com';

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

// Produces a temporary password shaped like "Acr7-Xm92-Kp" — three
// hyphen-separated groups, never derived from any personal data.
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const groupLengths = [4, 4, 2];

  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  let bi = 0;
  const rand = (max: number) => bytes[bi++ % bytes.length] % max;

  const groups = groupLengths.map((len) => {
    let group = upper[rand(upper.length)]; // first char always a capital letter, for readability
    const pool = lower + digits;
    for (let i = 1; i < len; i++) group += pool[rand(pool.length)];
    return group;
  });
  return groups.join('-');
}

function studentUsername(studentUid: string): string {
  return `${studentUid.toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
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
      return json({ error: 'Only the Main Super Admin can manage student accounts.' }, 403);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON request body.' }, 400);
    }

    const action = body?.action;

    // ============================================================
    // ACTION: create — link a student record to a new login
    // ============================================================
    if (action === 'create') {
      const studentId = typeof body.studentId === 'string' ? body.studentId : '';
      if (!studentId) return json({ error: 'studentId is required.' }, 400);

      const { data: student, error: studentError } = await adminClient
        .from('students')
        .select('id, full_name, roll_number, class_id, section_id, user_id, student_uid')
        .eq('id', studentId)
        .single();
      if (studentError || !student) return json({ error: 'Student not found.' }, 404);

      // Prevent duplicate accounts — the whole point of this check.
      if (student.user_id) {
        return json({ error: `${student.full_name} already has a Student Portal account.` }, 400);
      }

      const admissionYear = typeof body.admissionYear === 'string' && /^\d{2}$/.test(body.admissionYear)
        ? body.admissionYear
        : new Date().getFullYear().toString().slice(-2);

      const { data: uidData, error: uidError } = await adminClient.rpc('next_student_uid', { admission_year: admissionYear });
      if (uidError || !uidData) return json({ error: uidError?.message || 'Failed to generate a Student ID.' }, 400);
      const studentUid = uidData as string;

      const username = studentUsername(studentUid);
      const password = generateTempPassword();

      const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
        email: username, password, email_confirm: true,
      });
      if (createUserError || !createdUserData.user) {
        return json({ error: createUserError?.message || 'Failed to create the student account.' }, 400);
      }
      const newUser = createdUserData.user;

      const { error: createProfileError } = await adminClient.from('profiles').insert({
        id: newUser.id, full_name: student.full_name, email: username, phone: '—', role: 'STUDENT', is_active: true,
        must_change_password: true,
      });
      if (createProfileError) {
        await adminClient.auth.admin.deleteUser(newUser.id);
        return json({ error: createProfileError.message }, 400);
      }

      const { error: linkError } = await adminClient
        .from('students')
        .update({ user_id: newUser.id, student_uid: studentUid })
        .eq('id', studentId);
      if (linkError) {
        await adminClient.from('profiles').delete().eq('id', newUser.id);
        await adminClient.auth.admin.deleteUser(newUser.id);
        return json({ error: linkError.message }, 400);
      }

      const { error: credError } = await adminClient.from('student_credentials').insert({
        student_id: studentId, user_id: newUser.id, student_uid: studentUid,
        username, temp_password: password, created_by: caller.id,
      });
      if (credError) {
        await adminClient.from('students').update({ user_id: null, student_uid: null }).eq('id', studentId);
        await adminClient.from('profiles').delete().eq('id', newUser.id);
        await adminClient.auth.admin.deleteUser(newUser.id);
        return json({ error: 'Failed to save credentials: ' + credError.message }, 400);
      }

      await adminClient.from('login_sessions').insert({
        user_id: newUser.id, user_name: student.full_name, user_role: 'STUDENT',
        event_type: 'ACCOUNT_CREATED',
        description: `Student Portal account created (${studentUid}) by ${callerProfile.full_name}.`,
        performed_by: caller.id, performed_by_name: callerProfile.full_name,
      });

      return json({
        success: true,
        user: { id: newUser.id, full_name: student.full_name, student_uid: studentUid, username },
        password,
      }, 201);
    }

    // ============================================================
    // ACTION: reset_password / regenerate — issue a new temp password
    // ============================================================
    if (action === 'reset_password' || action === 'regenerate') {
      const studentUserId = typeof body.userId === 'string' ? body.userId : '';
      if (!studentUserId) return json({ error: 'userId is required.' }, 400);

      const { data: target } = await adminClient.from('profiles').select('full_name, role').eq('id', studentUserId).single();
      if (!target || target.role !== 'STUDENT') return json({ error: 'Student account not found.' }, 404);

      const password = generateTempPassword();
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(studentUserId, { password });
      if (authUpdateError) return json({ error: authUpdateError.message }, 400);

      await adminClient.from('profiles').update({ must_change_password: true }).eq('id', studentUserId);

      await adminClient
        .from('student_credentials')
        .update({ temp_password: password, must_change_password: true, updated_at: new Date().toISOString() })
        .eq('user_id', studentUserId);

      await adminClient.from('login_sessions').insert({
        user_id: studentUserId, user_name: target.full_name, user_role: 'STUDENT',
        event_type: 'PASSWORD_CHANGED',
        description: `Password reset by ${callerProfile.full_name}.`,
        performed_by: caller.id, performed_by_name: callerProfile.full_name,
      });

      return json({ success: true, password });
    }

    // ============================================================
    // ACTION: disable / enable — flip login access
    // ============================================================
    if (action === 'disable' || action === 'enable') {
      const studentUserId = typeof body.userId === 'string' ? body.userId : '';
      if (!studentUserId) return json({ error: 'userId is required.' }, 400);
      const isActive = action === 'enable';

      const { data: target } = await adminClient.from('profiles').select('full_name, role').eq('id', studentUserId).single();
      if (!target || target.role !== 'STUDENT') return json({ error: 'Student account not found.' }, 404);

      const { error: updateError } = await adminClient.from('profiles').update({ is_active: isActive }).eq('id', studentUserId);
      if (updateError) return json({ error: updateError.message }, 400);

      await adminClient.from('login_sessions').insert({
        user_id: studentUserId, user_name: target.full_name, user_role: 'STUDENT',
        event_type: isActive ? 'ACCOUNT_CREATED' : 'ACCOUNT_CREATED', // no dedicated enum value; description carries the real meaning
        description: `Account ${isActive ? 'enabled' : 'disabled'} by ${callerProfile.full_name}.`,
        performed_by: caller.id, performed_by_name: callerProfile.full_name,
      });

      return json({ success: true, is_active: isActive });
    }

    // ============================================================
    // ACTION: delete — remove a student's login only (roster intact)
    // ============================================================
    if (action === 'delete') {
      const studentUserId = typeof body.userId === 'string' ? body.userId : '';
      if (!studentUserId) return json({ error: 'userId is required.' }, 400);

      const { data: target } = await adminClient.from('profiles').select('full_name, role').eq('id', studentUserId).single();
      if (!target || target.role !== 'STUDENT') return json({ error: 'Student account not found.' }, 404);

      await adminClient.from('students').update({ user_id: null, student_uid: null }).eq('user_id', studentUserId);
      await adminClient.from('profiles').delete().eq('id', studentUserId);
      await adminClient.auth.admin.deleteUser(studentUserId);

      return json({ success: true, deletedName: target.full_name });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error('MANAGE STUDENT CREDENTIALS FUNCTION ERROR:', error);
    return json({ error: 'An unexpected server error occurred.' }, 500);
  }
});
