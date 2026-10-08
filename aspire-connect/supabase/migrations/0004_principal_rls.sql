-- =====================================================================
-- ASPIRE CR CONNECT — Principal read-only access + logs restriction
-- =====================================================================

create or replace function is_principal() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'PRINCIPAL' from profiles where id = auth.uid()), false);
$$;

-- Anyone with oversight (admins + principal) — used for read-only
-- visibility checks below so we don't repeat "is_admin() or is_principal()"
-- everywhere.
create or replace function can_view_all() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or is_principal();
$$;

-- profiles: principal can read every profile (read-only — needed to show
-- CR/admin names in reports, statistics and the announcements audience).
create policy profiles_select_principal on profiles for select using (is_principal());

-- students: principal can view every student, read-only.
drop policy if exists students_select on students;
create policy students_select on students for select using (
  can_view_all() or section_id in (select my_assigned_sections())
);

-- cr_assignments: principal can view every active assignment, read-only.
drop policy if exists cr_assign_select on cr_assignments;
create policy cr_assign_select on cr_assignments for select using (
  can_view_all() or cr_user_id = auth.uid()
);

-- attendance_sessions: principal can view every session, read-only.
drop policy if exists sessions_select on attendance_sessions;
create policy sessions_select on attendance_sessions for select using (
  can_view_all() or section_id in (select my_assigned_sections())
);

-- attendance_records: follow the parent session's access, principal included.
drop policy if exists records_select on attendance_records;
create policy records_select on attendance_records for select using (
  exists (
    select 1 from attendance_sessions s
    where s.id = attendance_session_id
      and (can_view_all() or s.section_id in (select my_assigned_sections()))
  )
);

-- student_concerns: principal can view every concern, read-only.
drop policy if exists concerns_select on student_concerns;
create policy concerns_select on student_concerns for select using (
  can_view_all() or section_id in (select my_assigned_sections())
);

-- admin_activity_logs: Main Super Admin only. Sub Super Admins no longer
-- see even their own entries, and Principal never sees logs at all.
drop policy if exists logs_select on admin_activity_logs;
create policy logs_select on admin_activity_logs for select using (is_main_super_admin());
