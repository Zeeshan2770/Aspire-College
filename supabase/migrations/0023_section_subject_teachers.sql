-- Teachers per section.
-- A section can have several teachers, and a subject in a section can have more than one teacher
-- (for example theory and practical). class_subjects.faculty_id stays as the optional default
-- teacher of a subject for the whole class.
create table if not exists public.section_subject_teachers (
  section_id uuid not null references public.sections(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  faculty_id uuid not null references public.faculty(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (section_id, subject_id, faculty_id)
);

create index if not exists section_subject_teachers_section_idx on public.section_subject_teachers (section_id);
create index if not exists section_subject_teachers_faculty_idx on public.section_subject_teachers (faculty_id);

alter table public.section_subject_teachers enable row level security;

drop policy if exists section_subject_teachers_select on public.section_subject_teachers;
create policy section_subject_teachers_select on public.section_subject_teachers
  for select to authenticated using (auth_role() is distinct from 'STUDENT'::app_role);

drop policy if exists section_subject_teachers_write on public.section_subject_teachers;
create policy section_subject_teachers_write on public.section_subject_teachers
  for all to authenticated
  using (can_manage('manage_classes') or can_manage('manage_sections'))
  with check (can_manage('manage_classes') or can_manage('manage_sections'));

revoke all on public.section_subject_teachers from anon;

-- A section can only have a teacher for a subject that its class actually has.
create or replace function public.section_subject_teachers_check()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from sections s join class_subjects cs on cs.class_id = s.class_id
    where s.id = new.section_id and cs.subject_id = new.subject_id
  ) then
    raise exception 'This subject is not part of the section''s class.' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists section_subject_teachers_check_trg on public.section_subject_teachers;
create trigger section_subject_teachers_check_trg before insert or update on public.section_subject_teachers
  for each row execute function public.section_subject_teachers_check();

-- Removing a subject from a class also removes its per-section teachers.
create or replace function public.class_subject_removed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from section_subject_teachers
  where subject_id = old.subject_id and section_id in (select id from sections where class_id = old.class_id);
  return old;
end $$;

drop trigger if exists class_subject_removed_trg on public.class_subjects;
create trigger class_subject_removed_trg after delete on public.class_subjects
  for each row execute function public.class_subject_removed();

revoke all on function public.section_subject_teachers_check() from public, anon, authenticated;
revoke all on function public.class_subject_removed() from public, anon, authenticated;
