-- =====================================================================
-- ASPIRE CR CONNECT — Student Portal
--
-- Additive only. Reuses existing tables wherever the schema already
-- supports the need (students, profiles, attendance_sessions,
-- attendance_records, student_concerns + its comments/history/
-- notifications machinery, login_sessions). New tables are created only
-- where genuinely required: student_credentials (a vault, mirroring the
-- existing cr_credentials pattern exactly, for the same reason — Main
-- Super Admin needs to be able to hand a forgotten temporary password
-- back to a student).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Student identity columns
-- ---------------------------------------------------------------------

-- Links a student record to its optional Supabase Auth login. Most
-- existing students will have no login (user_id null) until an account
-- is created for them — that's fine, this is nullable and unique only
-- among non-null values (Postgres allows any number of NULLs in a
-- unique column).
alter table students add column if not exists user_id uuid unique references profiles(id) on delete set null;
create index if not exists idx_students_user on students(user_id);

-- The permanent, never-reused identifier requested in place of roll
-- number (which can change or be reused). Populated only when a login
-- is created — a student without a portal account simply has no UID.
alter table students add column if not exists student_uid text unique;

-- Academic session/batch (e.g. "2024-26"), shown on the student profile
-- alongside class/section. Optional — purely informational.
alter table students add column if not exists session_label text;

-- Shown once after a Student Portal account is first created — the
-- student must set their own password before continuing. Self-updatable
-- (see profiles_update_self in 0002) since it isn't role/is_active/email,
-- so the portal can clear it right after a successful password change.
alter table profiles add column if not exists must_change_password boolean not null default false;

comment on column students.user_id is 'Links to profiles.id when this student has a Student Portal login. Null = no account yet.';
comment on column students.student_uid is 'Permanent unique Student ID, e.g. STU-26-0001280. Never reused, unrelated to roll_number.';

-- ---------------------------------------------------------------------
-- 2. Student ID generator
--
-- A global sequence (not per-year) padded to 7 digits keeps generation
-- atomic and collision-free under concurrent account creation, unlike
-- "count existing rows + 1" which can race. Called only from the
-- manage-student-credentials Edge Function via the service-role client.
-- ---------------------------------------------------------------------

create sequence if not exists student_uid_seq;

create or replace function next_student_uid(admission_year text default to_char(now(), 'YY'))
returns text
language sql
volatile
security definer set search_path = public as $$
  select 'STU-' || admission_year || '-' || lpad(nextval('student_uid_seq')::text, 7, '0');
$$;

revoke all on function next_student_uid(text) from public;
grant execute on function next_student_uid(text) to service_role;

-- ---------------------------------------------------------------------
-- 3. student_credentials — the vault (mirrors cr_credentials exactly)
--
-- SECURITY NOTE: temp_password is plaintext by the same deliberate,
-- narrowly-scoped trade-off as cr_credentials (see 0007) — the Main
-- Super Admin needs to be able to look it up again to hand it to a
-- student who lost it. Locked to MAIN_SUPER_ADMIN only.
-- ---------------------------------------------------------------------

create table if not exists student_credentials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references students(id) on delete cascade,
  user_id uuid not null unique references profiles(id) on delete cascade,
  student_uid text not null unique,
  username text not null, -- the synthetic login email, e.g. stu-26-0001280@students.aspiretaunsa.com
  temp_password text not null,
  must_change_password boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_student_credentials_updated before update on student_credentials
  for each row execute function set_updated_at();

alter table student_credentials enable row level security;

create policy student_credentials_main_admin_only on student_credentials
  for all using (is_main_super_admin()) with check (is_main_super_admin());

-- ---------------------------------------------------------------------
-- 4. RLS helper: the signed-in student's own student_id
-- ---------------------------------------------------------------------

create or replace function is_student() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'STUDENT' from profiles where id = auth.uid()), false);
$$;

create or replace function my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from students where user_id = auth.uid();
$$;

create or replace function my_student_section_id() returns uuid
language sql stable security definer set search_path = public as $$
  select section_id from students where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 5. RLS: extend existing SELECT policies with student self-access
--
-- Every policy below is dropped and recreated with one additional
-- clause — the same technique 0004_principal_rls.sql used to add
-- Principal access without touching anyone else's existing rules.
-- Students get READ-ONLY access to exactly their own row(s); no write
-- policy is added anywhere for the STUDENT role, so a student can
-- never modify attendance, their own student record, or anyone else's
-- data — enforced here, not just hidden in the UI.
-- ---------------------------------------------------------------------

drop policy if exists students_select on students;
create policy students_select on students for select using (
  can_view_all() or section_id in (select my_assigned_sections()) or user_id = auth.uid()
);

drop policy if exists sessions_select on attendance_sessions;
create policy sessions_select on attendance_sessions for select using (
  can_view_all() or section_id in (select my_assigned_sections()) or section_id = my_student_section_id()
);

drop policy if exists records_select on attendance_records;
create policy records_select on attendance_records for select using (
  exists (
    select 1 from attendance_sessions s
    where s.id = attendance_session_id
      and (can_view_all() or s.section_id in (select my_assigned_sections()))
  )
  or student_id = my_student_id()
);

-- profiles: a student already reads their own row via the existing
-- profiles_select_self policy (id = auth.uid()) — no change needed.

-- ---------------------------------------------------------------------
-- 6. Student queries — extend the existing concern/query RPCs
--
-- Reuses student_concerns end-to-end (per spec: extend, don't
-- duplicate). A student's query is a student_concerns row with
-- created_by_role = 'STUDENT', student_id/class_id/section_id forced
-- (server-side, never trusting the client) to the caller's own record,
-- and scope forced to PERSONAL so it is never exposed merely by class/
-- section membership. concern_visible() already grants the reporter
-- (reported_by = auth.uid()) visibility into their own row, and
-- concern_comments_select already hides is_internal notes from anyone
-- who isn't a concern manager or the assignee — so students automatically
-- see their own queries and replies, and never see internal notes,
-- with no changes needed to either of those.
-- ---------------------------------------------------------------------

create or replace function create_concern(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := auth_role();
  v_my_student students;
  v_section_id uuid := nullif(payload->>'section_id', '')::uuid;
  v_class_id uuid := nullif(payload->>'class_id', '')::uuid;
  v_student_id uuid := nullif(payload->>'student_id', '')::uuid;
  v_priority concern_priority := coalesce(nullif(payload->>'priority', '')::concern_priority, 'MEDIUM');
  v_scope concern_scope := coalesce(nullif(payload->>'scope', '')::concern_scope, 'PERSONAL');
  v_category text := trim(coalesce(payload->>'category', ''));
  v_subject text := trim(coalesce(payload->>'subject', ''));
  v_description text := nullif(trim(coalesce(payload->>'description', '')), '');
  v_id uuid;
  v_recipient uuid;
begin
  if v_category = '' or v_subject = '' then
    raise exception 'A category and subject are required.';
  end if;

  if v_role = 'STUDENT' then
    select * into v_my_student from students where user_id = auth.uid();
    if not found then
      raise exception 'PERMISSION_DENIED: no student record is linked to this account.';
    end if;
    -- A student can only ever raise a query about themselves, in their
    -- own class/section, regardless of what the client sends.
    v_student_id := v_my_student.id;
    v_class_id := v_my_student.class_id;
    v_section_id := v_my_student.section_id;
    v_scope := 'PERSONAL';
    if v_priority = 'URGENT' then
      v_priority := 'HIGH';
    end if;
  elsif not (
    is_main_super_admin()
    or v_role = 'PRINCIPAL'
    or (v_role = 'SUB_SUPER_ADMIN' and has_permission('raise_concerns'))
    or (
      v_role = 'CR'
      and (v_section_id is null or v_section_id in (select my_assigned_sections()))
      and (v_class_id is null or v_class_id in (select se.class_id from sections se where se.id in (select my_assigned_sections())))
    )
  ) then
    raise exception 'PERMISSION_DENIED: you are not permitted to raise a concern.';
  end if;

  -- Ordinary CRs cannot self-classify URGENT — quietly cap to HIGH rather
  -- than rejecting the whole submission.
  if v_priority = 'URGENT' and v_role = 'CR' then
    v_priority := 'HIGH';
  end if;

  insert into student_concerns (
    student_id, class_id, section_id, reported_by, created_by_role,
    concern_type, short_description, additional_notes, priority, scope, status
  ) values (
    v_student_id, v_class_id, v_section_id, auth.uid(), v_role,
    v_category, v_subject, v_description, v_priority, v_scope, 'SUBMITTED'
  ) returning id into v_id;

  insert into concern_history (concern_id, actor_id, actor_role, action, to_value)
  values (v_id, auth.uid(), v_role, 'CREATED', 'SUBMITTED');

  -- Notification recipients: the usual concern managers, plus every
  -- active Principal specifically when a student raised this — per
  -- spec, students' queries must reach Main Super Admin, authorized Sub
  -- Super Admins, AND the Principal. This does not change who gets
  -- notified about any other kind of concern.
  for v_recipient in
    select * from concern_manager_profile_ids()
    union
    select id from profiles where v_role = 'STUDENT' and role = 'PRINCIPAL' and is_active
  loop
    if v_recipient <> auth.uid() then
      insert into concern_notifications (profile_id, concern_id, type, message)
      values (
        v_recipient, v_id, 'NEW_CONCERN',
        case when v_role = 'STUDENT'
          then format('New student query submitted by %s: %s', v_my_student.full_name, v_category)
          else format('New concern raised: "%s"', v_subject)
        end
      );
    end if;
  end loop;

  return jsonb_build_object('id', v_id, 'status', 'SUBMITTED', 'priority', v_priority);
end;
$$;

-- update_concern: unchanged for every existing caller, with one addition
-- — the original reporter may reopen their own RESOLVED/CLOSED query
-- (status -> REOPENED only; nothing else in the same call), matching
-- "students can reopen a resolved/closed query" from the spec, without
-- granting them any other mutation right over concerns they don't own.
create or replace function update_concern(p_concern_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_concern student_concerns;
  v_can_mutate boolean;
  v_is_self_reopen boolean;
  v_new_status concern_status;
  v_new_assignee uuid;
  v_new_priority concern_priority;
  v_note text := nullif(trim(coalesce(p_patch->>'note', '')), '');
  v_recipient uuid;
begin
  select * into v_concern from student_concerns where id = p_concern_id for update;
  if not found then
    raise exception 'Concern not found.';
  end if;

  v_is_self_reopen :=
    v_concern.reported_by = auth.uid()
    and v_concern.status in ('RESOLVED', 'CLOSED')
    and (p_patch - 'status' - 'note') = '{}'::jsonb
    and coalesce(p_patch->>'status', '') = 'REOPENED';

  v_can_mutate := is_main_super_admin() or can_manage_concerns() or v_concern.assigned_to = auth.uid() or v_is_self_reopen;
  if not v_can_mutate then
    raise exception 'PERMISSION_DENIED: you cannot manage this concern.';
  end if;

  if p_patch ? 'priority' then
    v_new_priority := (p_patch->>'priority')::concern_priority;
    if v_new_priority = 'URGENT' and not (is_main_super_admin() or auth_role() in ('PRINCIPAL', 'SUB_SUPER_ADMIN')) then
      raise exception 'Only administrators or the Principal may set URGENT priority.';
    end if;
    if v_new_priority <> v_concern.priority then
      insert into concern_history (concern_id, actor_id, actor_role, action, from_value, to_value, note)
      values (p_concern_id, auth.uid(), auth_role(), 'PRIORITY_CHANGED', v_concern.priority::text, v_new_priority::text, v_note);
      update student_concerns set priority = v_new_priority where id = p_concern_id;
      v_concern.priority := v_new_priority;
    end if;
  end if;

  if p_patch ? 'assigned_to' then
    if not (is_main_super_admin() or can_manage_concerns()) then
      raise exception 'PERMISSION_DENIED: only concern managers can assign concerns.';
    end if;
    v_new_assignee := nullif(p_patch->>'assigned_to', '')::uuid;
    if v_new_assignee is distinct from v_concern.assigned_to then
      insert into concern_history (concern_id, actor_id, actor_role, action, from_value, to_value, note)
      values (p_concern_id, auth.uid(), auth_role(), 'ASSIGNED', v_concern.assigned_to::text, v_new_assignee::text, v_note);
      update student_concerns
        set assigned_to = v_new_assignee,
            status = case when status = 'SUBMITTED' then 'ACKNOWLEDGED' else status end
        where id = p_concern_id;
      v_concern.assigned_to := v_new_assignee;
      if v_new_assignee is not null and v_new_assignee <> auth.uid() then
        insert into concern_notifications (profile_id, concern_id, type, message)
        values (v_new_assignee, p_concern_id, 'ASSIGNED', 'A concern has been assigned to you.');
      end if;
    end if;
  end if;

  if p_patch ? 'status' then
    v_new_status := (p_patch->>'status')::concern_status;
    if v_new_status <> v_concern.status then
      insert into concern_history (concern_id, actor_id, actor_role, action, from_value, to_value, note)
      values (p_concern_id, auth.uid(), auth_role(), 'STATUS_CHANGED', v_concern.status::text, v_new_status::text, v_note);

      update student_concerns
        set status = v_new_status,
            resolved_at = case when v_new_status = 'RESOLVED' then now()
                               when v_new_status = 'REOPENED' then null
                               else resolved_at end,
            closed_at = case when v_new_status = 'CLOSED' then now()
                             when v_new_status = 'REOPENED' then null
                             else closed_at end
        where id = p_concern_id;

      if v_new_status = 'RESOLVED' and v_concern.reported_by <> auth.uid() then
        insert into concern_notifications (profile_id, concern_id, type, message)
        values (v_concern.reported_by, p_concern_id, 'RESOLVED', 'Your concern has been marked resolved.');
      elsif v_new_status = 'REOPENED' then
        if v_concern.assigned_to is not null and v_concern.assigned_to <> auth.uid() then
          insert into concern_notifications (profile_id, concern_id, type, message)
          values (v_concern.assigned_to, p_concern_id, 'REOPENED', 'A resolved/closed concern was reopened.');
        end if;
        for v_recipient in select * from concern_manager_profile_ids() loop
          if v_recipient <> auth.uid() and v_recipient is distinct from v_concern.assigned_to then
            insert into concern_notifications (profile_id, concern_id, type, message)
            values (v_recipient, p_concern_id, 'REOPENED', 'A resolved/closed concern was reopened by the person who raised it.');
          end if;
        end loop;
      elsif v_concern.reported_by <> auth.uid() then
        insert into concern_notifications (profile_id, concern_id, type, message)
        values (v_concern.reported_by, p_concern_id, 'STATUS_CHANGE', format('Your concern status changed to %s.', v_new_status));
      end if;
    end if;
  end if;

  return jsonb_build_object('id', p_concern_id, 'ok', true);
end;
$$;

revoke all on function create_concern(jsonb) from public;
revoke all on function update_concern(uuid, jsonb) from public;
grant execute on function create_concern(jsonb) to authenticated;
grant execute on function update_concern(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 7. CR permissions are unaffected
--
-- No CR-facing policy or RPC branch above was altered — every existing
-- CR condition is copied verbatim from 0011_concerns_upgrade.sql. CRs
-- are NOT added to concern_manager_profile_ids or given any new
-- visibility into student queries by this migration, matching "Do not
-- automatically give CRs access to every student query."
-- =====================================================================
