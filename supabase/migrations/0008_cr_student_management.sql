-- =====================================================================
-- Allow a CR to add and remove students within their own assigned
-- section(s) only. Previously the only write policy on `students` was
-- `students_write_admin` (Main/Sub Super Admin with manage_students
-- permission) — CRs had no insert/update/delete access at all.
--
-- These are additive, permissive policies (Postgres OR's them together
-- with the existing admin policy), so admin access is unaffected.
-- =====================================================================

-- Insert: a CR may add a student only into a (class_id, section_id) pair
-- that matches one of their own active assignments. This blocks a CR
-- from creating a student row in someone else's section by forging the
-- section_id/class_id in the request.
create policy students_insert_cr on students for insert
  with check (
    exists (
      select 1 from cr_assignments cr
      where cr.cr_user_id = auth.uid()
        and cr.is_active
        and cr.section_id = students.section_id
        and cr.class_id = students.class_id
    )
  );

-- Delete: a CR may remove only a student currently sitting in one of
-- their own active sections.
create policy students_delete_cr on students for delete
  using (
    section_id in (select my_assigned_sections())
  );

-- Note: no update policy is granted here — CRs can add or remove
-- students, but editing an existing student's details remains an
-- admin-only action (students_write_admin).
