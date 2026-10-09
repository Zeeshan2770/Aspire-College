-- =====================================================================
-- ASPIRE CR CONNECT — 0002: Profile fields, report branding, storage
-- Adds: phone + avatar_url on profiles, self-service profile update
-- (without privilege escalation), per-class/section report branding
-- (header/footer/logo), and Storage buckets for avatars + report logos.
-- =====================================================================

-- ---------- profiles: phone + avatar ----------
alter table profiles add column if not exists phone text not null default '';
alter table profiles add column if not exists avatar_url text;

-- Going forward every new CR / Sub Super Admin must be created with a
-- phone number (enforced in the app + the create-user Edge Function).
-- Existing rows default to '' so this migration never fails.

-- ---------- self-service profile update, without privilege escalation ----------
-- Users may update their own full_name / phone / avatar_url, but a trigger
-- blocks changes to role, is_active, or email unless done by an admin.
create or replace function prevent_self_privilege_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.id and not is_admin() then
    if new.role <> old.role or new.is_active <> old.is_active or new.email <> old.email then
      raise exception 'You are not allowed to change your role, active status, or email.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_escalation on profiles;
create trigger trg_prevent_self_escalation before update on profiles
  for each row execute function prevent_self_privilege_escalation();

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- report_branding ----------
-- Optional per-class or per-section header/footer/logo override for
-- generated reports. Falls back to system_settings when no row exists.
-- Note: a section-level row stores ONLY section_id (class_id left null);
-- class name/relations for display are resolved via a join through
-- sections.class_id in the app, not stored redundantly here. This keeps
-- class_id and section_id as plain (non-partial) unique columns so
-- `upsert(... , { onConflict })` works without needing a partial-index
-- arbiter.
create table if not exists report_branding (
  id uuid primary key default gen_random_uuid(),
  class_id uuid unique references classes(id) on delete cascade,
  section_id uuid unique references sections(id) on delete cascade,
  header_text text,
  footer_text text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_branding_scope check (
    (class_id is not null and section_id is null) or (class_id is null and section_id is not null)
  )
);

drop trigger if exists trg_report_branding_updated on report_branding;
create trigger trg_report_branding_updated before update on report_branding
  for each row execute function set_updated_at();

alter table report_branding enable row level security;

drop policy if exists report_branding_select on report_branding;
create policy report_branding_select on report_branding for select using (auth.uid() is not null);

drop policy if exists report_branding_write on report_branding;
create policy report_branding_write on report_branding for all
  using (is_main_super_admin() or has_permission('manage_classes'))
  with check (is_main_super_admin() or has_permission('manage_classes'));

-- =====================================================================
-- Storage buckets
-- =====================================================================
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('report-logos', 'report-logos', true)
  on conflict (id) do nothing;

-- avatars: publicly readable, each user manages only files inside a
-- folder named after their own uid, e.g. avatars/<uid>/photo.jpg
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- report-logos: publicly readable, only Main Super Admin (or an admin
-- with manage_classes permission) can upload/replace/remove
drop policy if exists "report_logos_public_read" on storage.objects;
create policy "report_logos_public_read" on storage.objects for select
  using (bucket_id = 'report-logos');

drop policy if exists "report_logos_admin_insert" on storage.objects;
create policy "report_logos_admin_insert" on storage.objects for insert
  with check (bucket_id = 'report-logos' and (is_main_super_admin() or has_permission('manage_classes')));

drop policy if exists "report_logos_admin_update" on storage.objects;
create policy "report_logos_admin_update" on storage.objects for update
  using (bucket_id = 'report-logos' and (is_main_super_admin() or has_permission('manage_classes')));

drop policy if exists "report_logos_admin_delete" on storage.objects;
create policy "report_logos_admin_delete" on storage.objects for delete
  using (bucket_id = 'report-logos' and (is_main_super_admin() or has_permission('manage_classes')));
