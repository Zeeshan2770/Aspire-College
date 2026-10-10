-- 0017_college_site_and_admissions
-- Public college website tables (site settings, page content, programs, faculty, news, events), admissions and
-- contact messages, the can_manage() permission helper, audit triggers and the site-media storage bucket.
-- This file was recovered from the Aspire Query project migration history (version 20260930172626) and is
-- byte-for-byte what was applied there (MD5 3f93b984... verified).

-- ===== Enums =====
create type admission_status as enum ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED');
create type content_status as enum ('DRAFT', 'PUBLISHED');

-- ===== New per-account permission flags (Administration role), all off by default =====
alter table admin_permissions add column if not exists manage_admissions boolean not null default false;
alter table admin_permissions add column if not exists manage_faculty boolean not null default false;
alter table admin_permissions add column if not exists manage_content boolean not null default false;

-- Generic check: Super Admin always; Administration only with the named flag.
create or replace function can_manage(perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('MAIN_SUPER_ADMIN','SUB_SUPER_ADMIN'), false) and has_permission(perm);
$$;

-- Internal audit helper (not callable by clients)
create or replace function log_activity(p_action text, p_target text, p_description text) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text; v_role app_role;
begin
  if auth.uid() is null then return; end if;
  select full_name, role into v_name, v_role from profiles where id = auth.uid();
  if not found then return; end if;
  insert into admin_activity_logs (admin_id, admin_name, admin_role, action, target, description)
  values (auth.uid(), v_name, v_role, p_action, p_target, p_description);
end;
$$;
revoke all on function log_activity(text, text, text) from public, anon, authenticated;

-- Generic audit trigger for content tables
create or replace function log_table_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; v_label text := TG_ARGV[0]; v_target text; v_verb text;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  r := to_jsonb(coalesce(new, old));
  v_target := coalesce(r->>'title', r->>'full_name', r->>'name', r->>'key', v_label);
  v_verb := case TG_OP when 'INSERT' then 'Created' when 'UPDATE' then 'Updated' else 'Deleted' end;
  perform log_activity(v_label || ' ' || v_verb, v_target, format('%s %s: %s', v_label, lower(v_verb), v_target));
  return coalesce(new, old);
end;
$$;

-- ===== Public-safe site settings (branding + contact). Private settings stay in system_settings =====
create table site_settings (
  id int primary key default 1,
  college_name text not null default 'Aspire Group of Colleges',
  campus_name text not null default 'Taunsa Sharif',
  tagline text,
  logo_url text,
  secondary_logo_url text,
  favicon_url text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  hero_image_url text,
  address text,
  phone text,
  email text,
  map_url text,
  facebook_url text,
  instagram_url text,
  youtube_url text,
  footer_text text,
  admissions_open boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint site_settings_single_row check (id = 1)
);
insert into site_settings (id) values (1);
create trigger trg_site_settings_updated before update on site_settings for each row execute function set_updated_at();

-- Structured page content (vision, mission, principal message, admission info, student life...)
create table site_content (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger trg_site_content_updated before update on site_content for each row execute function set_updated_at();

-- ===== Academics =====
create table programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text,
  description text,
  duration text,
  eligibility text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uniq_programs_name_ci on programs (lower(trim(name)));
create trigger trg_programs_updated before update on programs for each row execute function set_updated_at();

create table faculty (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  designation text,
  department text,
  subject text,
  qualification text,
  bio text,
  photo_url text,
  email text,
  phone text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  is_public boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_faculty_dept on faculty(department);
create trigger trg_faculty_updated before update on faculty for each row execute function set_updated_at();

create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  created_at timestamptz not null default now()
);
create unique index uniq_subjects_name_ci on subjects (lower(trim(name)));

create table class_subjects (
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  faculty_id uuid references faculty(id) on delete set null,
  primary key (class_id, subject_id)
);

alter table classes add column if not exists academic_session text;
alter table sections add column if not exists class_teacher_id uuid references faculty(id) on delete set null;

-- ===== Student record: fields carried over from an admission (all optional) =====
alter table students add column if not exists date_of_birth date;
alter table students add column if not exists gender text check (gender is null or gender in ('Male','Female','Other'));
alter table students add column if not exists address text;
alter table students add column if not exists guardian_name text;
alter table students add column if not exists guardian_relationship text;
alter table students add column if not exists guardian_phone text;

-- ===== Admissions =====
create sequence admission_no_seq;

create table admissions (
  id uuid primary key default gen_random_uuid(),
  application_no text not null unique,
  full_name text not null,
  father_name text not null,
  date_of_birth date not null,
  gender text not null check (gender in ('Male','Female','Other')),
  phone text not null,
  email text,
  address text not null,
  previous_institution text,
  previous_class text,
  percentage numeric(5,2) check (percentage is null or (percentage >= 0 and percentage <= 100)),
  board text,
  passing_year int,
  program_applied text not null,
  preferred_class text,
  guardian_name text not null,
  guardian_relationship text,
  guardian_phone text not null,
  status admission_status not null default 'SUBMITTED',
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  student_id uuid unique references students(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_admissions_status on admissions(status, created_at desc);
create trigger trg_admissions_updated before update on admissions for each row execute function set_updated_at();

create table admission_notes (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references admissions(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_admission_notes_adm on admission_notes(admission_id);

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  subject text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_contact_created on contact_messages(created_at desc);

-- ===== News & events =====
create table news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  body text,
  image_url text,
  category text not null default 'General' check (category in ('Announcement','Achievement','Academic','General')),
  status content_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_news_pub on news(status, published_at desc);
create trigger trg_news_updated before update on news for each row execute function set_updated_at();

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status content_status not null default 'DRAFT',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_dates check (ends_at is null or ends_at >= starts_at)
);
create index idx_events_start on events(status, starts_at);
create trigger trg_events_updated before update on events for each row execute function set_updated_at();

-- ===== Audit triggers =====
create trigger trg_log_faculty after insert or update or delete on faculty for each row execute function log_table_change('Faculty');
create trigger trg_log_programs after insert or update or delete on programs for each row execute function log_table_change('Program');
create trigger trg_log_news after insert or update or delete on news for each row execute function log_table_change('News');
create trigger trg_log_events after insert or update or delete on events for each row execute function log_table_change('Event');
create trigger trg_log_site_content after insert or update or delete on site_content for each row execute function log_table_change('Site Content');
create trigger trg_log_site_settings after update on site_settings for each row execute function log_table_change('Site Settings');
create trigger trg_log_subjects after insert or update or delete on subjects for each row execute function log_table_change('Subject');

-- ===== RLS =====
alter table site_settings enable row level security;
alter table site_content enable row level security;
alter table programs enable row level security;
alter table faculty enable row level security;
alter table subjects enable row level security;
alter table class_subjects enable row level security;
alter table admissions enable row level security;
alter table admission_notes enable row level security;
alter table contact_messages enable row level security;
alter table news enable row level security;
alter table events enable row level security;

-- site_settings: public read, Super Admin only write
create policy site_settings_select on site_settings for select to anon, authenticated using (true);
create policy site_settings_update on site_settings for update to authenticated using (is_main_super_admin()) with check (is_main_super_admin());

-- site_content
create policy site_content_select on site_content for select to anon, authenticated using (true);
create policy site_content_write on site_content for all to authenticated
  using (can_manage('manage_content')) with check (can_manage('manage_content'));

-- programs
create policy programs_select on programs for select to anon, authenticated
  using (is_active or can_manage('manage_content') or is_principal());
create policy programs_write on programs for all to authenticated
  using (can_manage('manage_content')) with check (can_manage('manage_content'));

-- news
create policy news_select on news for select to anon, authenticated
  using ((status = 'PUBLISHED' and published_at <= now()) or can_manage('manage_content') or is_principal());
create policy news_write on news for all to authenticated
  using (can_manage('manage_content')) with check (can_manage('manage_content'));

-- events
create policy events_select on events for select to anon, authenticated
  using (status = 'PUBLISHED' or can_manage('manage_content') or is_principal());
create policy events_write on events for all to authenticated
  using (can_manage('manage_content')) with check (can_manage('manage_content'));

-- faculty: anon sees only public+active rows and only non-contact columns
revoke all on faculty from anon;
grant select (id, full_name, designation, department, subject, qualification, bio, photo_url, display_order) on faculty to anon;
create policy faculty_select_anon on faculty for select to anon using (is_public and status = 'ACTIVE');
create policy faculty_select_auth on faculty for select to authenticated
  using (auth_role() is distinct from 'STUDENT' or (is_public and status = 'ACTIVE'));
create policy faculty_write on faculty for all to authenticated
  using (can_manage('manage_faculty')) with check (can_manage('manage_faculty'));

-- subjects / class_subjects: staff read, permission-based write
create policy subjects_select on subjects for select to authenticated using (auth_role() is distinct from 'STUDENT');
create policy subjects_write on subjects for all to authenticated
  using (can_manage('manage_faculty')) with check (can_manage('manage_faculty'));
create policy class_subjects_select on class_subjects for select to authenticated using (auth_role() is distinct from 'STUDENT');
create policy class_subjects_write on class_subjects for all to authenticated
  using (can_manage('manage_classes')) with check (can_manage('manage_classes'));

-- admissions / notes / contact: read by managers + Principal; writes only through functions (messages: mark read)
create policy admissions_select on admissions for select to authenticated
  using (can_manage('manage_admissions') or is_principal());
create policy admission_notes_select on admission_notes for select to authenticated
  using (can_manage('manage_admissions') or is_principal());
create policy contact_select on contact_messages for select to authenticated
  using (can_manage('manage_admissions') or is_principal());
create policy contact_update on contact_messages for update to authenticated
  using (can_manage('manage_admissions')) with check (can_manage('manage_admissions'));

-- ===== Public submission functions (validated; the only anonymous write path) =====
create or replace function submit_admission(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name text := trim(coalesce(payload->>'full_name',''));
  v_father text := trim(coalesce(payload->>'father_name',''));
  v_dob date;
  v_gender text := trim(coalesce(payload->>'gender',''));
  v_phone text := trim(coalesce(payload->>'phone',''));
  v_email text := nullif(trim(coalesce(payload->>'email','')),'');
  v_address text := trim(coalesce(payload->>'address',''));
  v_program text := trim(coalesce(payload->>'program_applied',''));
  v_g_name text := trim(coalesce(payload->>'guardian_name',''));
  v_g_phone text := trim(coalesce(payload->>'guardian_phone',''));
  v_pct numeric;
  v_year int;
  v_no text;
  v_id uuid;
begin
  if coalesce(payload->>'website','') <> '' then
    raise exception 'Unable to submit the application.';
  end if;
  if v_name = '' or v_father = '' or v_address = '' or v_program = '' or v_g_name = '' then
    raise exception 'Please fill in all required fields.';
  end if;
  if length(v_name) > 120 or length(v_father) > 120 or length(v_g_name) > 120 or length(v_address) > 500 or length(v_program) > 120 then
    raise exception 'One or more fields are too long.';
  end if;
  begin v_dob := (payload->>'date_of_birth')::date; exception when others then v_dob := null; end;
  if v_dob is null or v_dob > current_date - interval '5 years' or v_dob < current_date - interval '45 years' then
    raise exception 'Please enter a valid date of birth.';
  end if;
  if v_gender not in ('Male','Female','Other') then raise exception 'Please select a gender.'; end if;
  if v_phone !~ '^[0-9+\-\s]{10,16}$' or v_g_phone !~ '^[0-9+\-\s]{10,16}$' then
    raise exception 'Please enter valid phone numbers (10 to 16 digits).';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.';
  end if;
  if nullif(payload->>'percentage','') is not null then
    begin v_pct := (payload->>'percentage')::numeric; exception when others then v_pct := -1; end;
    if v_pct < 0 or v_pct > 100 then raise exception 'Percentage must be between 0 and 100.'; end if;
  end if;
  if nullif(payload->>'passing_year','') is not null then
    begin v_year := (payload->>'passing_year')::int; exception when others then v_year := 0; end;
    if v_year < 1990 or v_year > extract(year from now())::int + 1 then raise exception 'Please enter a valid passing year.'; end if;
  end if;

  if exists (
    select 1 from admissions
    where lower(trim(full_name)) = lower(v_name) and date_of_birth = v_dob and phone = v_phone
      and status in ('SUBMITTED','UNDER_REVIEW')
  ) then
    raise exception 'An application for this applicant is already under review.';
  end if;
  if (select count(*) from admissions where created_at > now() - interval '1 hour') > 100 then
    raise exception 'Too many submissions right now. Please try again later.';
  end if;

  v_no := 'ADM-' || to_char(now(),'YYYY') || '-' || lpad(nextval('admission_no_seq')::text, 5, '0');
  insert into admissions (
    application_no, full_name, father_name, date_of_birth, gender, phone, email, address,
    previous_institution, previous_class, percentage, board, passing_year,
    program_applied, preferred_class, guardian_name, guardian_relationship, guardian_phone
  ) values (
    v_no, v_name, v_father, v_dob, v_gender, v_phone, v_email, v_address,
    nullif(trim(coalesce(payload->>'previous_institution','')),''),
    nullif(trim(coalesce(payload->>'previous_class','')),''),
    v_pct,
    nullif(trim(coalesce(payload->>'board','')),''),
    v_year,
    v_program,
    nullif(trim(coalesce(payload->>'preferred_class','')),''),
    v_g_name,
    nullif(trim(coalesce(payload->>'guardian_relationship','')),''),
    v_g_phone
  ) returning id into v_id;

  return jsonb_build_object('application_no', v_no);
end;
$$;

create or replace function submit_contact(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name text := trim(coalesce(payload->>'name',''));
  v_email text := nullif(trim(coalesce(payload->>'email','')),'');
  v_phone text := nullif(trim(coalesce(payload->>'phone','')),'');
  v_msg text := trim(coalesce(payload->>'message',''));
begin
  if coalesce(payload->>'website','') <> '' then raise exception 'Unable to send the message.'; end if;
  if v_name = '' or v_msg = '' then raise exception 'Please enter your name and message.'; end if;
  if length(v_name) > 120 or length(v_msg) > 3000 then raise exception 'Your message is too long.'; end if;
  if v_email is null and v_phone is null then raise exception 'Please provide an email address or phone number.'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email address.'; end if;
  if v_phone is not null and v_phone !~ '^[0-9+\-\s]{10,16}$' then raise exception 'Please enter a valid phone number.'; end if;
  if (select count(*) from contact_messages where created_at > now() - interval '1 hour') > 100 then
    raise exception 'Too many messages right now. Please try again later.';
  end if;
  insert into contact_messages (name, email, phone, subject, message)
  values (v_name, v_email, v_phone, nullif(left(trim(coalesce(payload->>'subject','')),200),''), v_msg);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function submit_admission(jsonb) from public;
revoke all on function submit_contact(jsonb) from public;
grant execute on function submit_admission(jsonb) to anon, authenticated;
grant execute on function submit_contact(jsonb) to anon, authenticated;

-- ===== Internal admission workflow =====
create or replace function update_admission_status(p_id uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_adm admissions; v_new admission_status; v_name text; v_note text := nullif(trim(coalesce(p_note,'')),'');
begin
  if not can_manage('manage_admissions') then raise exception 'PERMISSION_DENIED: you cannot manage admissions.'; end if;
  begin v_new := p_status::admission_status; exception when others then raise exception 'Invalid status.'; end;
  select * into v_adm from admissions where id = p_id for update;
  if not found then raise exception 'Application not found.'; end if;
  if v_adm.student_id is not null and v_new <> 'ACCEPTED' then
    raise exception 'This applicant already has a student record, so the status cannot be changed.';
  end if;
  if v_new = v_adm.status then return jsonb_build_object('ok', true, 'unchanged', true); end if;

  update admissions set status = v_new, reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  select full_name into v_name from profiles where id = auth.uid();
  if v_note is not null then
    insert into admission_notes (admission_id, author_id, author_name, body)
    values (p_id, auth.uid(), coalesce(v_name,'Unknown'), v_note);
  end if;
  perform log_activity('Admission Status Changed', v_adm.application_no,
    format('%s (%s): %s to %s', v_adm.full_name, v_adm.application_no, v_adm.status, v_new));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function add_admission_note(p_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_body text := trim(coalesce(p_body,'')); v_name text;
begin
  if not can_manage('manage_admissions') then raise exception 'PERMISSION_DENIED: you cannot manage admissions.'; end if;
  if v_body = '' then raise exception 'Note cannot be empty.'; end if;
  if not exists (select 1 from admissions where id = p_id) then raise exception 'Application not found.'; end if;
  select full_name into v_name from profiles where id = auth.uid();
  insert into admission_notes (admission_id, author_id, author_name, body) values (p_id, auth.uid(), coalesce(v_name,'Unknown'), v_body);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function create_student_from_admission(
  p_admission_id uuid, p_class_id uuid, p_section_id uuid, p_roll_number text, p_session_label text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_adm admissions; v_roll text := trim(coalesce(p_roll_number,'')); v_student uuid;
begin
  if not (can_manage('manage_admissions') and can_manage('manage_students')) then
    raise exception 'PERMISSION_DENIED: creating a student from an admission needs both admissions and student management permission.';
  end if;
  if v_roll = '' then raise exception 'A roll number is required.'; end if;
  select * into v_adm from admissions where id = p_admission_id for update;
  if not found then raise exception 'Application not found.'; end if;
  if v_adm.status <> 'ACCEPTED' then raise exception 'Only accepted applications can be converted to students.'; end if;
  if v_adm.student_id is not null then raise exception 'A student record already exists for this application.'; end if;
  if not exists (select 1 from sections where id = p_section_id and class_id = p_class_id) then
    raise exception 'The selected section does not belong to the selected class.';
  end if;

  begin
    insert into students (
      full_name, father_name, roll_number, class_id, section_id, phone, status, session_label,
      date_of_birth, gender, address, guardian_name, guardian_relationship, guardian_phone
    ) values (
      v_adm.full_name, v_adm.father_name, v_roll, p_class_id, p_section_id, v_adm.phone, 'ACTIVE',
      nullif(trim(coalesce(p_session_label,'')),''),
      v_adm.date_of_birth, v_adm.gender, v_adm.address, v_adm.guardian_name, v_adm.guardian_relationship, v_adm.guardian_phone
    ) returning id into v_student;
  exception when unique_violation then
    raise exception 'Roll number % is already used in that class and section.', v_roll;
  end;

  update admissions set student_id = v_student where id = p_admission_id;
  perform log_activity('Student Created From Admission', v_adm.application_no,
    format('Created student record for %s (%s), roll %s', v_adm.full_name, v_adm.application_no, v_roll));
  return jsonb_build_object('ok', true, 'student_id', v_student);
end;
$$;

revoke all on function update_admission_status(uuid, text, text) from public, anon;
revoke all on function add_admission_note(uuid, text) from public, anon;
revoke all on function create_student_from_admission(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function update_admission_status(uuid, text, text) to authenticated;
grant execute on function add_admission_note(uuid, text) to authenticated;
grant execute on function create_student_from_admission(uuid, uuid, uuid, text, text) to authenticated;

-- ===== Storage: public site media =====
insert into storage.buckets (id, name, public) values ('site-media', 'site-media', true) on conflict (id) do nothing;
create policy site_media_read on storage.objects for select using (bucket_id = 'site-media');
create policy site_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and (is_main_super_admin() or can_manage('manage_content') or can_manage('manage_faculty')));
create policy site_media_update on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and (is_main_super_admin() or can_manage('manage_content') or can_manage('manage_faculty')));
create policy site_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and (is_main_super_admin() or can_manage('manage_content') or can_manage('manage_faculty')));
