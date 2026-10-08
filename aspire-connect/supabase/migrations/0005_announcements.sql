-- =====================================================================
-- ASPIRE CR CONNECT — Announcements
--
-- Hierarchy for who can announce to whom (enforced in can_announce_to()):
--   MAIN_SUPER_ADMIN  -> PRINCIPAL, SUB_SUPER_ADMIN, CR (any combination)
--   PRINCIPAL         -> SUB_SUPER_ADMIN, CR
--   SUB_SUPER_ADMIN   -> CR
--   CR                -> cannot post announcements (inbox only)
-- =====================================================================

create type announcement_priority as enum ('LOW', 'NORMAL', 'HIGH', 'URGENT');

create table announcements (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles(id) on delete cascade,
  created_by_name text not null,
  created_by_role app_role not null,
  title text not null,
  message text not null,
  priority announcement_priority not null default 'NORMAL',
  target_roles app_role[] not null,
  is_pinned boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_has_targets check (array_length(target_roles, 1) > 0)
);
create index idx_announcements_created on announcements(created_at desc);
create index idx_announcements_target_roles on announcements using gin(target_roles);

create trigger trg_announcements_updated before update on announcements
  for each row execute function set_updated_at();

-- ---------- announcement_reads ----------
-- One row per (announcement, recipient) once they've opened it.
create table announcement_reads (
  announcement_id uuid not null references announcements(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);

-- ---------- can_announce_to() ----------
-- Enforces the hierarchy above at the database level, not just in the UI.
create or replace function can_announce_to(targets app_role[]) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  caller app_role;
  t app_role;
begin
  caller := auth_role();
  if targets is null or array_length(targets, 1) is null then
    return false;
  end if;

  if caller = 'MAIN_SUPER_ADMIN' then
    return true;
  elsif caller = 'PRINCIPAL' then
    foreach t in array targets loop
      if t not in ('SUB_SUPER_ADMIN', 'CR') then
        return false;
      end if;
    end loop;
    return true;
  elsif caller = 'SUB_SUPER_ADMIN' then
    foreach t in array targets loop
      if t <> 'CR' then
        return false;
      end if;
    end loop;
    return true;
  else
    return false;
  end if;
end;
$$;

alter table announcements enable row level security;
alter table announcement_reads enable row level security;

-- announcements: visible to its creator always, and to anyone whose role
-- is in target_roles as long as it hasn't expired.
create policy announcements_select on announcements for select using (
  created_by = auth.uid()
  or (auth_role() = any(target_roles) and (expires_at is null or expires_at > now()))
);

create policy announcements_insert on announcements for insert with check (
  created_by = auth.uid() and can_announce_to(target_roles)
);

-- Only the author (or Main Super Admin, for moderation) can edit/delete.
create policy announcements_update on announcements for update using (
  created_by = auth.uid() or is_main_super_admin()
) with check (
  (created_by = auth.uid() and can_announce_to(target_roles)) or is_main_super_admin()
);
create policy announcements_delete on announcements for delete using (
  created_by = auth.uid() or is_main_super_admin()
);

-- announcement_reads: a recipient can mark their own read; the author of
-- the announcement (or Main Super Admin) can see everyone's read receipts.
create policy announcement_reads_select on announcement_reads for select using (
  profile_id = auth.uid()
  or is_main_super_admin()
  or exists (select 1 from announcements a where a.id = announcement_id and a.created_by = auth.uid())
);
create policy announcement_reads_insert on announcement_reads for insert with check (
  profile_id = auth.uid()
  and exists (
    select 1 from announcements a
    where a.id = announcement_id
      and (auth_role() = any(a.target_roles) or a.created_by = auth.uid())
  )
);
