-- Admin-editable dropdown lists (designation, department, subject, qualification,
-- program level/duration, news category). Staff who can manage the related section
-- can add, rename, reorder and delete options from the dropdown itself.
create table if not exists public.dropdown_options (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  label       text not null check (length(btrim(label)) between 1 and 120),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists dropdown_options_cat_label_uq
  on public.dropdown_options (category, lower(btrim(label)));
create index if not exists dropdown_options_cat_idx on public.dropdown_options (category, sort_order);

alter table public.dropdown_options enable row level security;

drop policy if exists dropdown_options_read on public.dropdown_options;
create policy dropdown_options_read on public.dropdown_options for select to authenticated using (true);

drop policy if exists dropdown_options_write on public.dropdown_options;
create policy dropdown_options_write on public.dropdown_options for all to authenticated
  using (can_manage('manage_faculty') or can_manage('manage_content'))
  with check (can_manage('manage_faculty') or can_manage('manage_content'));

-- Public website filters need to read a few lists without signing in.
grant select on public.dropdown_options to anon;
drop policy if exists dropdown_options_public_read on public.dropdown_options;
create policy dropdown_options_public_read on public.dropdown_options for select to anon
  using (category in ('news_category','program_level','program_duration','faculty_department','faculty_designation','faculty_subject'));

-- Students may read the query-category list; managers edit it (policy above covers writes).
-- Starter values (safe to edit or delete afterwards from the app).
insert into public.dropdown_options (category, label, sort_order) values
  ('faculty_designation','Lecturer',1),('faculty_designation','Senior Lecturer',2),('faculty_designation','Assistant Professor',3),
  ('faculty_designation','Associate Professor',4),('faculty_designation','Professor',5),('faculty_designation','Head of Department',6),
  ('faculty_department','Science',1),('faculty_department','Arts',2),('faculty_department','Computer Science',3),
  ('faculty_department','Commerce',4),('faculty_department','English',5),
  ('faculty_subject','Physics',1),('faculty_subject','Chemistry',2),('faculty_subject','Biology',3),('faculty_subject','Mathematics',4),
  ('faculty_subject','English',5),('faculty_subject','Urdu',6),('faculty_subject','Computer Science',7),('faculty_subject','Islamiyat',8),
  ('faculty_qualification','BS',1),('faculty_qualification','MA',2),('faculty_qualification','MSc',3),
  ('faculty_qualification','M.Phil',4),('faculty_qualification','PhD',5),('faculty_qualification','B.Ed',6),
  ('program_level','Intermediate',1),('program_level','Bachelor',2),('program_level','Short Course',3),
  ('program_duration','2 Years',1),('program_duration','4 Years',2),('program_duration','6 Months',3),
  ('event_location','Main Hall',1),('event_location','Auditorium',2),('event_location','Playground',3),('event_location','Library',4),('event_location','Computer Lab',5),
  ('student_query_category','Academic Issue',1),('student_query_category','Examination Issue',2),('student_query_category','Attendance Issue',3),('student_query_category','Teacher / Faculty Concern',4),('student_query_category','Classroom / Facility Issue',5),('student_query_category','Technical Issue',6),('student_query_category','Scholarship / Financial Guidance',7),('student_query_category','Student Welfare',8),('student_query_category','Safety / Security',9),('student_query_category','General Query',10),('student_query_category','Other',11),
  ('news_category','Announcement',1),('news_category','Achievement',2),('news_category','Academic',3),('news_category','General',4)
on conflict do nothing;
