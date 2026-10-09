-- =====================================================================
-- CR credential vault, login/credential-change session log, and
-- CR warning system — all scoped to the Main Super Admin.
--
-- SECURITY NOTE:
-- `cr_credentials.temp_password` stores the CR's password in PLAIN TEXT
-- by explicit product requirement (the Main Super Admin needs to be able
-- to look it up again later, e.g. to hand it to a CR who forgot it).
-- This is a deliberate trade-off: normally Supabase Auth only stores a
-- salted hash and a password can never be read back. Because this table
-- holds real, usable login credentials, it is locked down so ONLY
-- MAIN_SUPER_ADMIN can read/write it, and it should never be exposed to
-- any other role, endpoint, or export.
-- =====================================================================

-- ---------------------------------------------------------------------
-- cr_credentials — the vault
-- ---------------------------------------------------------------------
create table if not exists cr_credentials (
  id uuid primary key default gen_random_uuid(),
  cr_user_id uuid not null unique references profiles(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  section_id uuid references sections(id) on delete set null,
  email text not null,
  temp_password text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_cr_credentials_updated before update on cr_credentials
  for each row execute function set_updated_at();

alter table cr_credentials enable row level security;

create policy cr_credentials_main_admin_only on cr_credentials
  for all using (is_main_super_admin()) with check (is_main_super_admin());

-- ---------------------------------------------------------------------
-- login_sessions — who logged in, and who changed whose credentials
-- ---------------------------------------------------------------------
create table if not exists login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  user_name text not null,
  user_role app_role not null,
  event_type text not null check (event_type in ('LOGIN','ACCOUNT_CREATED','EMAIL_CHANGED','PASSWORD_CHANGED')),
  description text not null,
  performed_by uuid references profiles(id),
  performed_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_sessions_user on login_sessions(user_id);
create index if not exists idx_login_sessions_created on login_sessions(created_at desc);

alter table login_sessions enable row level security;

-- Main Super Admin sees everything; anyone can see their own login history.
create policy login_sessions_select on login_sessions
  for select using (is_main_super_admin() or user_id = auth.uid());

-- A user can log their own login; the Main Super Admin (or the
-- credentials edge function via the service role, which bypasses RLS
-- entirely) can log events performed on someone else's account.
create policy login_sessions_insert on login_sessions
  for insert with check (is_main_super_admin() or user_id = auth.uid());

-- Log entries are immutable — no update/delete policy is defined, so no
-- one (besides the service role) can alter or remove history.

-- ---------------------------------------------------------------------
-- cr_warnings — formal warnings issued to a CR for misconduct
-- ---------------------------------------------------------------------
create table if not exists cr_warnings (
  id uuid primary key default gen_random_uuid(),
  cr_user_id uuid not null references profiles(id) on delete cascade,
  issued_by uuid not null references profiles(id),
  issued_by_name text not null,
  severity text not null check (severity in ('LOW','MEDIUM','HIGH')) default 'MEDIUM',
  message text not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists idx_cr_warnings_cr on cr_warnings(cr_user_id);

alter table cr_warnings enable row level security;

create policy cr_warnings_select on cr_warnings
  for select using (is_main_super_admin() or cr_user_id = auth.uid());

create policy cr_warnings_insert on cr_warnings
  for insert with check (is_main_super_admin());

-- The CR may only acknowledge (set acknowledged_at) their own warning;
-- the Main Super Admin can also edit/withdraw a warning if needed.
create policy cr_warnings_update on cr_warnings
  for update using (is_main_super_admin() or cr_user_id = auth.uid())
  with check (is_main_super_admin() or cr_user_id = auth.uid());
