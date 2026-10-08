-- =====================================================================
-- ASPIRE CR CONNECT — Initial schema
-- Smart Classroom Coordination System
-- Aspire Group of Colleges, Taunsa Sharif
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type app_role as enum ('MAIN_SUPER_ADMIN', 'SUB_SUPER_ADMIN', 'CR');
create type student_status as enum ('ACTIVE', 'INACTIVE');
create type attendance_status as enum ('PRESENT', 'ABSENT', 'LATE', 'LEAVE');
create type concern_status as enum ('SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');

-- ---------- profiles ----------
-- One row per Supabase Auth user. Role lives here — never trust client state.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role app_role not null default 'CR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- admin_permissions ----------
-- Fine-grained permissions for SUB_SUPER_ADMIN accounts.
create table admin_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade unique,
  manage_students boolean not null default false,
  manage_classes boolean not null default false,
  manage_sections boolean not null default false,
  manage_crs boolean not null default false,
  view_attendance boolean not null default true,
  manage_attendance boolean not null default false,
  view_concerns boolean not null default true,
  manage_concerns boolean not null default false,
  generate_reports boolean not null default true,
  import_students boolean not null default false,
  export_students boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- classes ----------
create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- sections ----------
create table sections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (class_id, name)
);

-- ---------- students ----------
create table students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  roll_number text not null,
  class_id uuid not null references classes(id) on delete restrict,
  section_id uuid not null references sections(id) on delete restrict,
  phone text,
  status student_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, section_id, roll_number)
);
create index idx_students_section on students(section_id);
create index idx_students_class on students(class_id);
create index idx_students_name on students using gin (to_tsvector('simple', full_name));

-- ---------- cr_assignments ----------
create table cr_assignments (
  id uuid primary key default gen_random_uuid(),
  cr_user_id uuid not null references profiles(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references profiles(id),
  unique (section_id, is_active) deferrable initially immediate
);
-- Only one *active* CR per section is enforced at the application layer
-- (partial unique index below handles the DB-level guarantee).
create unique index uniq_active_cr_per_section on cr_assignments(section_id) where is_active;
create index idx_cr_assignments_user on cr_assignments(cr_user_id);

-- ---------- attendance_sessions ----------
create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  date date not null,
  lecture_number int not null,
  subject text,
  teacher text,
  taken_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (section_id, date, lecture_number)
);
create index idx_sessions_section_date on attendance_sessions(section_id, date);

-- ---------- attendance_records ----------
create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  attendance_session_id uuid not null references attendance_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status attendance_status not null default 'PRESENT',
  created_at timestamptz not null default now(),
  unique (attendance_session_id, student_id)
);
create index idx_records_student on attendance_records(student_id);
create index idx_records_session on attendance_records(attendance_session_id);

-- ---------- student_concerns ----------
create table student_concerns (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  reported_by uuid not null references profiles(id),
  concern_type text not null,
  short_description text not null,
  additional_notes text,
  status concern_status not null default 'SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_concerns_student on student_concerns(student_id);
create index idx_concerns_section on student_concerns(section_id);

-- ---------- admin_activity_logs ----------
create table admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id),
  admin_name text not null,
  admin_role app_role not null,
  action text not null,
  target text,
  description text not null,
  created_at timestamptz not null default now()
);
create index idx_logs_admin on admin_activity_logs(admin_id);
create index idx_logs_created on admin_activity_logs(created_at desc);

-- ---------- system_settings ----------
-- Single-row settings table.
create table system_settings (
  id int primary key default 1,
  college_name text not null default 'Aspire Group of Colleges',
  campus_name text not null default 'Taunsa Sharif',
  system_name text not null default 'Aspire CR Connect',
  logo_url text,
  concern_categories jsonb not null default '[
    "Using Mobile Phone","Disturbing the Class","Bullying","Misbehavior",
    "Excessive Talking","Sleeping During Lecture","Disrespectful Behavior",
    "Repeated Disruption","Other"
  ]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into system_settings (id) values (1);

-- =====================================================================
-- updated_at triggers
-- =====================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();
create trigger trg_students_updated before update on students
  for each row execute function set_updated_at();
create trigger trg_concerns_updated before update on student_concerns
  for each row execute function set_updated_at();
create trigger trg_settings_updated before update on system_settings
  for each row execute function set_updated_at();
create trigger trg_permissions_updated before update on admin_permissions
  for each row execute function set_updated_at();

-- =====================================================================
-- Helper functions (used by RLS policies)
-- =====================================================================
create or replace function auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_main_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'MAIN_SUPER_ADMIN' from profiles where id = auth.uid()), false);
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('MAIN_SUPER_ADMIN','SUB_SUPER_ADMIN') from profiles where id = auth.uid()), false);
$$;

-- Sections a CR is actively assigned to.
create or replace function my_assigned_sections() returns setof uuid
language sql stable security definer set search_path = public as $$
  select section_id from cr_assignments where cr_user_id = auth.uid() and is_active;
$$;

create or replace function has_permission(perm text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  result boolean;
begin
  if is_main_super_admin() then
    return true;
  end if;
  execute format('select %I from admin_permissions where profile_id = $1', perm)
    into result using auth.uid();
  return coalesce(result, false);
end;
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table profiles enable row level security;
alter table admin_permissions enable row level security;
alter table classes enable row level security;
alter table sections enable row level security;
alter table students enable row level security;
alter table cr_assignments enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;
alter table student_concerns enable row level security;
alter table admin_activity_logs enable row level security;
alter table system_settings enable row level security;

-- profiles: everyone can read their own profile; admins can read/manage all;
-- a user can never edit their own role.
create policy profiles_select_self on profiles for select using (id = auth.uid());
create policy profiles_select_admin on profiles for select using (is_admin());
create policy profiles_update_admin on profiles for update using (is_admin())
  with check (is_main_super_admin() or role <> 'MAIN_SUPER_ADMIN');
create policy profiles_insert_admin on profiles for insert with check (is_admin());

-- admin_permissions: main admin manages all; sub admin can read own row.
create policy perms_select on admin_permissions for select
  using (is_main_super_admin() or profile_id = auth.uid());
create policy perms_write on admin_permissions for all
  using (is_main_super_admin()) with check (is_main_super_admin());

-- classes / sections: readable by all authenticated users; writable by
-- users with manage_classes / manage_sections permission.
create policy classes_select on classes for select using (auth.uid() is not null);
create policy classes_write on classes for all
  using (is_main_super_admin() or has_permission('manage_classes'))
  with check (is_main_super_admin() or has_permission('manage_classes'));

create policy sections_select on sections for select using (auth.uid() is not null);
create policy sections_write on sections for all
  using (is_main_super_admin() or has_permission('manage_sections'))
  with check (is_main_super_admin() or has_permission('manage_sections'));

-- students: admins see all; CRs see only their assigned section(s).
create policy students_select on students for select using (
  is_admin() or section_id in (select my_assigned_sections())
);
create policy students_write_admin on students for all
  using (is_main_super_admin() or has_permission('manage_students'))
  with check (is_main_super_admin() or has_permission('manage_students'));

-- cr_assignments: admins manage; CR can read their own assignment.
create policy cr_assign_select on cr_assignments for select using (
  is_admin() or cr_user_id = auth.uid()
);
create policy cr_assign_write on cr_assignments for all
  using (is_main_super_admin() or has_permission('manage_crs'))
  with check (is_main_super_admin() or has_permission('manage_crs'));

-- attendance_sessions: admins see all; CR sees/creates only for their section.
create policy sessions_select on attendance_sessions for select using (
  is_admin() or section_id in (select my_assigned_sections())
);
create policy sessions_insert on attendance_sessions for insert with check (
  is_main_super_admin() or has_permission('manage_attendance')
  or section_id in (select my_assigned_sections())
);
create policy sessions_update on attendance_sessions for update using (
  is_main_super_admin() or has_permission('manage_attendance')
);
create policy sessions_delete on attendance_sessions for delete using (
  is_main_super_admin() or has_permission('manage_attendance')
);

-- attendance_records: follow the parent session's access.
create policy records_select on attendance_records for select using (
  exists (
    select 1 from attendance_sessions s
    where s.id = attendance_session_id
      and (is_admin() or s.section_id in (select my_assigned_sections()))
  )
);
create policy records_write on attendance_records for all using (
  exists (
    select 1 from attendance_sessions s
    where s.id = attendance_session_id
      and (is_main_super_admin() or has_permission('manage_attendance')
           or s.section_id in (select my_assigned_sections()))
  )
) with check (
  exists (
    select 1 from attendance_sessions s
    where s.id = attendance_session_id
      and (is_main_super_admin() or has_permission('manage_attendance')
           or s.section_id in (select my_assigned_sections()))
  )
);

-- student_concerns: admins see all; CR sees/creates only for their section.
create policy concerns_select on student_concerns for select using (
  is_admin() or section_id in (select my_assigned_sections())
);
create policy concerns_insert on student_concerns for insert with check (
  is_admin() or section_id in (select my_assigned_sections())
);
create policy concerns_update on student_concerns for update using (
  is_main_super_admin() or has_permission('manage_concerns')
  or (reported_by = auth.uid() and section_id in (select my_assigned_sections()))
);

-- admin_activity_logs: main admin sees all; sub admin sees own; insert by any admin.
create policy logs_select on admin_activity_logs for select using (
  is_main_super_admin() or admin_id = auth.uid()
);
create policy logs_insert on admin_activity_logs for insert with check (is_admin());

-- system_settings: readable by all logged-in users; writable by main admin only.
create policy settings_select on system_settings for select using (auth.uid() is not null);
create policy settings_write on system_settings for update using (is_main_super_admin());

-- =====================================================================
-- Bootstrap note:
-- After a user signs up via Supabase Auth, insert a matching row into
-- `profiles`. The very first Main Super Admin must be inserted manually
-- (see README "Create the first Main Super Admin").
-- =====================================================================
