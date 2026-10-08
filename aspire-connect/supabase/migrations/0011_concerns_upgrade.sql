-- =====================================================================
-- ASPIRE CR CONNECT — Universal Concern & Complaint System (phase 2/2)
--
-- Evolves the existing CR-only "report a student's misbehavior" feature
-- into a role-aware institutional concern & complaint system, WITHOUT
-- touching the meaning or data of existing rows:
--   - student_id / class_id / section_id become optional (a concern no
--     longer has to be about a specific student).
--   - reported_by keeps meaning "who raised this" for every concern, old
--     and new alike.
--   - concern_type keeps meaning "category" (short_description keeps
--     meaning "subject", additional_notes keeps meaning "description") —
--     no columns are duplicated, per the instruction to extend rather
--     than duplicate existing structure.
--   - Existing CR-submitted concerns keep working exactly as before
--     through src/pages/CR/Concerns.tsx and the same table.
--
-- Requires 0010_concern_status_enum.sql to have already been run and
-- committed (separate transaction — see that file's header).
-- =====================================================================

-- ---------- New enums ----------
create type concern_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
create type concern_scope as enum ('PERSONAL', 'SECTION', 'CLASS', 'INSTITUTION');

-- ---------- Extend student_concerns ----------
alter table student_concerns
  alter column student_id drop not null,
  alter column class_id drop not null,
  alter column section_id drop not null,
  add column created_by_role app_role not null default 'CR',
  add column priority concern_priority not null default 'MEDIUM',
  add column scope concern_scope not null default 'SECTION',
  add column assigned_to uuid references profiles(id) on delete set null,
  add column resolved_at timestamptz,
  add column closed_at timestamptz;

comment on column student_concerns.reported_by is 'Who raised this concern — the CR, student-on-behalf-of submitter, Sub Super Admin, Principal, or Main Super Admin.';
comment on column student_concerns.concern_type is 'Category — e.g. a disciplinary category for older CR reports, or one of the broader institutional categories (Academic Issue, Infrastructure/Facility, etc.) for general concerns.';
comment on column student_concerns.short_description is 'Subject line.';
comment on column student_concerns.additional_notes is 'Description / body of the concern.';

-- Backfill created_by_role accurately from the actual reporting profile
-- (rather than trusting the new column's default) for every existing row.
update student_concerns sc
set created_by_role = p.role
from profiles p
where p.id = sc.reported_by;

create index idx_concerns_assigned on student_concerns(assigned_to);
create index idx_concerns_status on student_concerns(status);
create index idx_concerns_scope on student_concerns(scope);
create index idx_concerns_priority on student_concerns(priority);

-- ---------- Expand the configurable category list ----------
-- Old disciplinary categories are kept (existing CR flow still uses them);
-- the new institutional categories are appended.
alter table system_settings alter column concern_categories set default '[
  "Using Mobile Phone","Disturbing the Class","Bullying","Misbehavior",
  "Excessive Talking","Sleeping During Lecture","Disrespectful Behavior",
  "Repeated Disruption",
  "Academic Issue","Attendance Issue","Student Welfare","Classroom Issue",
  "Teacher/Faculty Concern","Administrative Issue","Infrastructure/Facility",
  "Examination Issue","Scholarship / Financial Guidance","Safety / Security",
  "Technical Issue","General Concern","Other"
]'::jsonb;

update system_settings
set concern_categories = '[
  "Using Mobile Phone","Disturbing the Class","Bullying","Misbehavior",
  "Excessive Talking","Sleeping During Lecture","Disrespectful Behavior",
  "Repeated Disruption",
  "Academic Issue","Attendance Issue","Student Welfare","Classroom Issue",
  "Teacher/Faculty Concern","Administrative Issue","Infrastructure/Facility",
  "Examination Issue","Scholarship / Financial Guidance","Safety / Security",
  "Technical Issue","General Concern","Other"
]'::jsonb
where id = 1;

-- ---------- New permission: raise_concerns (Sub Super Admin, configurable) ----------
-- Main Super Admin, Principal and CR keep their fixed (non-toggleable)
-- ability to raise concerns, matching how every other role's baseline
-- ability works in this app — only Sub Super Admin has per-account
-- configurable permissions.
alter table admin_permissions add column raise_concerns boolean not null default true;

-- ---------- Supporting tables ----------

create table concern_comments (
  id uuid primary key default gen_random_uuid(),
  concern_id uuid not null references student_concerns(id) on delete cascade,
  author_id uuid not null references profiles(id),
  author_role app_role not null,
  body text not null,
  is_internal boolean not null default false, -- true = admin-only note, never shown to the submitter
  created_at timestamptz not null default now()
);
create index idx_concern_comments_concern on concern_comments(concern_id);

create table concern_history (
  id uuid primary key default gen_random_uuid(),
  concern_id uuid not null references student_concerns(id) on delete cascade,
  actor_id uuid references profiles(id),
  actor_role app_role,
  action text not null, -- CREATED, ACKNOWLEDGED, ASSIGNED, STATUS_CHANGED, COMMENT_ADDED, PRIORITY_CHANGED, RESOLVED, CLOSED, REOPENED
  from_value text,
  to_value text,
  note text,
  created_at timestamptz not null default now()
);
create index idx_concern_history_concern on concern_history(concern_id);

create table concern_attachments (
  id uuid primary key default gen_random_uuid(),
  concern_id uuid not null references student_concerns(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  storage_path text not null,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);
create index idx_concern_attachments_concern on concern_attachments(concern_id);

create table concern_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  concern_id uuid not null references student_concerns(id) on delete cascade,
  type text not null, -- NEW_CONCERN, ASSIGNED, COMMENT, STATUS_CHANGE, RESOLVED, REOPENED
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_concern_notifications_profile on concern_notifications(profile_id, is_read);

alter table concern_comments enable row level security;
alter table concern_history enable row level security;
alter table concern_attachments enable row level security;
alter table concern_notifications enable row level security;

-- ---------- Visibility & permission helpers ----------

-- Global (not-section-scoped) concern visibility: Main Super Admin always;
-- Sub Super Admin only if explicitly granted view_concerns; Principal
-- always (matches its existing read-only-oversight role elsewhere).
create or replace function can_view_concerns_globally() returns boolean
language sql stable security definer set search_path = public as $$
  select is_main_super_admin()
    or auth_role() = 'PRINCIPAL'
    or (auth_role() = 'SUB_SUPER_ADMIN' and has_permission('view_concerns'));
$$;

-- Whether the signed-in user may act on (assign/change status/priority
-- of) concerns generally. Principal is deliberately excluded — it keeps
-- its existing read-only-oversight role; it can raise concerns but not
-- manage other people's.
create or replace function can_manage_concerns() returns boolean
language sql stable security definer set search_path = public as $$
  select is_main_super_admin()
    or (auth_role() = 'SUB_SUPER_ADMIN' and has_permission('manage_concerns'));
$$;

-- Row-level visibility for a single concern. Scope controls how far a
-- section/class assignment reaches; PERSONAL and INSTITUTION concerns are
-- never exposed merely by class/section membership.
create or replace function concern_visible(c student_concerns) returns boolean
language sql stable security definer set search_path = public as $$
  select
    can_view_concerns_globally()
    or c.reported_by = auth.uid()
    or c.assigned_to = auth.uid()
    or (
      c.scope = 'SECTION' and c.section_id is not null
      and c.section_id in (select my_assigned_sections())
    )
    or (
      c.scope = 'CLASS' and c.class_id is not null
      and c.class_id in (
        select se.class_id from sections se
        where se.id in (select my_assigned_sections())
      )
    );
$$;

-- ---------- student_concerns RLS: replace select/insert/update ----------

drop policy if exists concerns_select on student_concerns;
create policy concerns_select on student_concerns for select using (concern_visible(student_concerns));

drop policy if exists concerns_insert on student_concerns;
create policy concerns_insert on student_concerns for insert with check (
  reported_by = auth.uid()
  and (
    is_main_super_admin()
    or auth_role() = 'PRINCIPAL'
    or (auth_role() = 'SUB_SUPER_ADMIN' and has_permission('raise_concerns'))
    or (
      auth_role() = 'CR'
      and (section_id is null or section_id in (select my_assigned_sections()))
      and (
        class_id is null
        or class_id in (select se.class_id from sections se where se.id in (select my_assigned_sections()))
      )
    )
  )
);

-- All status/assignment/priority changes go through update_concern() below
-- (SECURITY DEFINER) so every change is authorized consistently and always
-- produces a concern_history entry + notifications. Direct table updates
-- are limited to Main Super Admin as a break-glass fallback.
drop policy if exists concerns_update on student_concerns;
create policy concerns_update on student_concerns for update using (is_main_super_admin());

-- ---------- concern_comments RLS ----------

create policy concern_comments_select on concern_comments for select using (
  exists (select 1 from student_concerns sc where sc.id = concern_id and concern_visible(sc))
  and (
    not is_internal
    or can_manage_concerns()
    or exists (select 1 from student_concerns sc where sc.id = concern_id and sc.assigned_to = auth.uid())
  )
);
create policy concern_comments_insert on concern_comments for insert with check (
  author_id = auth.uid()
  and exists (select 1 from student_concerns sc where sc.id = concern_id and concern_visible(sc))
  and (not is_internal or can_manage_concerns() or is_main_super_admin())
);

-- ---------- concern_history RLS (written only by the RPC functions below) ----------

create policy concern_history_select on concern_history for select using (
  exists (select 1 from student_concerns sc where sc.id = concern_id and concern_visible(sc))
);
create policy concern_history_insert on concern_history for insert with check (is_main_super_admin());

-- ---------- concern_attachments RLS ----------

create policy concern_attachments_select on concern_attachments for select using (
  exists (select 1 from student_concerns sc where sc.id = concern_id and concern_visible(sc))
);
create policy concern_attachments_insert on concern_attachments for insert with check (
  uploaded_by = auth.uid()
  and exists (select 1 from student_concerns sc where sc.id = concern_id and concern_visible(sc))
);
create policy concern_attachments_delete on concern_attachments for delete using (
  uploaded_by = auth.uid() or can_manage_concerns() or is_main_super_admin()
);

-- ---------- concern_notifications RLS (written only by the RPC functions below) ----------

create policy concern_notifications_select on concern_notifications for select using (profile_id = auth.uid());
create policy concern_notifications_update on concern_notifications for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy concern_notifications_insert on concern_notifications for insert with check (is_main_super_admin());

-- ---------- Storage bucket for attachments ----------
-- Private bucket — objects are only reachable through signed URLs the
-- client requests after passing the concern_attachments RLS check above.
insert into storage.buckets (id, name, public)
values ('concern-attachments', 'concern-attachments', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

-- Path convention enforced by the application: {concern_id}/{uuid}-{filename}
create policy concern_attachments_storage_select on storage.objects for select using (
  bucket_id = 'concern-attachments'
  and exists (
    select 1 from student_concerns sc
    where sc.id::text = (storage.foldername(name))[1]
      and concern_visible(sc)
  )
);
create policy concern_attachments_storage_insert on storage.objects for insert with check (
  bucket_id = 'concern-attachments'
  and exists (
    select 1 from student_concerns sc
    where sc.id::text = (storage.foldername(name))[1]
      and concern_visible(sc)
  )
);
create policy concern_attachments_storage_delete on storage.objects for delete using (
  bucket_id = 'concern-attachments'
  and (
    can_manage_concerns() or is_main_super_admin()
    or owner = auth.uid()
  )
);

-- =====================================================================
-- RPC functions — every real mutation goes through one of these so the
-- audit trail (concern_history) and notifications can never drift out
-- of sync with the data, and so authorization is enforced once, in one
-- place, instead of being re-derived by every caller.
-- =====================================================================

-- Everyone with manage_concerns rights (+ Main Super Admin), used to
-- decide who gets notified about a brand-new concern. Not hardcoded to
-- category — see spec note "do not hard-code these assignments".
create or replace function concern_manager_profile_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where role = 'MAIN_SUPER_ADMIN' and is_active
  union
  select ap.profile_id from admin_permissions ap
  join profiles p on p.id = ap.profile_id
  where ap.manage_concerns and p.is_active;
$$;

create or replace function create_concern(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := auth_role();
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

  if not (
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

  for v_recipient in select * from concern_manager_profile_ids() loop
    if v_recipient <> auth.uid() then
      insert into concern_notifications (profile_id, concern_id, type, message)
      values (v_recipient, v_id, 'NEW_CONCERN', format('New concern raised: "%s"', v_subject));
    end if;
  end loop;

  return jsonb_build_object('id', v_id, 'status', 'SUBMITTED', 'priority', v_priority);
end;
$$;

create or replace function add_concern_comment(p_concern_id uuid, p_body text, p_is_internal boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_concern student_concerns;
  v_body text := trim(coalesce(p_body, ''));
  v_id uuid;
begin
  select * into v_concern from student_concerns where id = p_concern_id;
  if not found or not concern_visible(v_concern) then
    raise exception 'Concern not found.';
  end if;
  if v_body = '' then
    raise exception 'Comment cannot be empty.';
  end if;
  if p_is_internal and not (can_manage_concerns() or is_main_super_admin()) then
    raise exception 'PERMISSION_DENIED: only concern managers can add internal notes.';
  end if;

  insert into concern_comments (concern_id, author_id, author_role, body, is_internal)
  values (p_concern_id, auth.uid(), auth_role(), v_body, p_is_internal)
  returning id into v_id;

  insert into concern_history (concern_id, actor_id, actor_role, action)
  values (p_concern_id, auth.uid(), auth_role(), 'COMMENT_ADDED');

  if not p_is_internal then
    if v_concern.reported_by <> auth.uid() then
      insert into concern_notifications (profile_id, concern_id, type, message)
      values (v_concern.reported_by, p_concern_id, 'COMMENT', 'New reply on your concern.');
    end if;
  end if;
  if v_concern.assigned_to is not null and v_concern.assigned_to <> auth.uid() then
    insert into concern_notifications (profile_id, concern_id, type, message)
    values (v_concern.assigned_to, p_concern_id, 'COMMENT', 'New comment on a concern assigned to you.');
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

-- Generic updater: patch may include any of status / assigned_to / priority.
create or replace function update_concern(p_concern_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_concern student_concerns;
  v_can_mutate boolean;
  v_new_status concern_status;
  v_new_assignee uuid;
  v_new_priority concern_priority;
  v_note text := nullif(trim(coalesce(p_patch->>'note', '')), '');
begin
  select * into v_concern from student_concerns where id = p_concern_id for update;
  if not found then
    raise exception 'Concern not found.';
  end if;

  v_can_mutate := is_main_super_admin() or can_manage_concerns() or v_concern.assigned_to = auth.uid();
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
revoke all on function add_concern_comment(uuid, text, boolean) from public;
revoke all on function update_concern(uuid, jsonb) from public;
grant execute on function create_concern(jsonb) to authenticated;
grant execute on function add_concern_comment(uuid, text, boolean) to authenticated;
grant execute on function update_concern(uuid, jsonb) to authenticated;
