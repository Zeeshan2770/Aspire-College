-- Adding a subject to a class is class management, so holders of manage_classes may also create subjects.
drop policy if exists subjects_write on public.subjects;
create policy subjects_write on public.subjects for all to authenticated
  using (can_manage('manage_faculty') or can_manage('manage_classes'))
  with check (can_manage('manage_faculty') or can_manage('manage_classes'));
