-- 0028_message_templates
-- Shared custom templates for the Message Center (Admin > Message Center), so every admin sees the same ones.
-- Optional: without this table the Message Center keeps working and stores templates in the browser only.
-- Run in the Supabase SQL Editor after 0027.

create table if not exists public.message_templates (
  id text primary key check (char_length(id) between 1 and 80),
  name text not null check (char_length(name) between 1 and 120),
  subject text not null default '' check (char_length(subject) <= 300),
  body text not null check (char_length(body) between 1 and 4000),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.message_templates enable row level security;

drop policy if exists message_templates_staff on public.message_templates;
create policy message_templates_staff on public.message_templates for all to authenticated
  using (is_main_super_admin() or is_principal() or can_manage('manage_admissions'))
  with check (is_main_super_admin() or is_principal() or can_manage('manage_admissions'));
