-- =====================================================================
-- Adds Father Name support to the Smart CSV Import pipeline.
--
-- The importer already accepted "Father Name" in the spec's expected
-- column list, but 0009_smart_csv_import.sql's apply_student_import
-- never read or wrote it — students.father_name (added in
-- 0013_quick_reports_and_settings.sql) simply wasn't part of the import
-- payload. This migration is a straight copy of that function with
-- father_name added to the insert/update statements only. Every other
-- line — authorization, class/section resolution, activity logging,
-- return shape — is unchanged.
-- =====================================================================

create or replace function apply_student_import(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_name text;
  v_admin_role app_role;

  v_class_name text;
  v_class_id uuid;
  v_classes_created text[] := '{}';

  v_pair jsonb;
  v_section_name text;
  v_section_id uuid;
  v_sections_created jsonb := '[]'::jsonb;

  v_row jsonb;
  v_action text;
  v_row_class_id uuid;
  v_row_section_id uuid;
  v_student_id uuid;
  v_full_name text;
  v_father_name text;
  v_roll_number text;
  v_phone text;

  v_created int := 0;
  v_updated int := 0;
  v_moved int := 0;
  v_skipped int := 0;
  v_total int := 0;
begin
  -- ---------- Authorization ----------
  if not (is_main_super_admin() or has_permission('import_students')) then
    raise exception 'PERMISSION_DENIED: you do not have permission to import students';
  end if;

  -- ---------- Resolve / create classes ----------
  for v_class_name in select jsonb_array_elements_text(coalesce(payload->'classes', '[]'::jsonb))
  loop
    v_class_name := trim(v_class_name);
    continue when v_class_name = '';

    select id into v_class_id from classes
      where lower(trim(name)) = lower(v_class_name)
      limit 1;

    if not found then
      begin
        insert into classes (name) values (v_class_name) returning id into v_class_id;
        v_classes_created := array_append(v_classes_created, v_class_name);
      exception when unique_violation then
        -- another session created it a moment ago; just reuse it
        select id into v_class_id from classes
          where lower(trim(name)) = lower(v_class_name)
          limit 1;
      end;
    end if;
  end loop;

  -- ---------- Resolve / create sections ----------
  for v_pair in select jsonb_array_elements(coalesce(payload->'sections', '[]'::jsonb))
  loop
    v_class_name := trim(v_pair->>'class');
    v_section_name := trim(v_pair->>'section');
    continue when v_class_name = '' or v_section_name = '';

    select id into v_class_id from classes
      where lower(trim(name)) = lower(v_class_name)
      limit 1;

    if not found then
      raise exception 'Class "%" was not prepared before its sections.', v_class_name;
    end if;

    select id into v_section_id from sections
      where class_id = v_class_id and lower(trim(name)) = lower(v_section_name)
      limit 1;

    if not found then
      begin
        insert into sections (class_id, name) values (v_class_id, v_section_name)
          returning id into v_section_id;
        v_sections_created := v_sections_created || jsonb_build_object('class', v_class_name, 'section', v_section_name);
      exception when unique_violation then
        select id into v_section_id from sections
          where class_id = v_class_id and lower(trim(name)) = lower(v_section_name)
          limit 1;
      end;
    end if;
  end loop;

  -- ---------- Process student rows ----------
  for v_row in select jsonb_array_elements(coalesce(payload->'rows', '[]'::jsonb))
  loop
    v_total := v_total + 1;
    v_action := v_row->>'action';
    v_full_name := trim(v_row->>'full_name');
    v_father_name := nullif(trim(coalesce(v_row->>'father_name', '')), '');
    v_roll_number := trim(v_row->>'roll_number');
    v_phone := nullif(trim(coalesce(v_row->>'phone', '')), '');
    v_student_id := nullif(v_row->>'student_id', '')::uuid;

    if v_action = 'skip' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_class_name := trim(v_row->>'class');
    v_section_name := trim(v_row->>'section');

    select id into v_row_class_id from classes
      where lower(trim(name)) = lower(v_class_name) limit 1;
    if not found then
      raise exception 'Class "%" for roll number % was not created before import.', v_class_name, v_roll_number;
    end if;

    select id into v_row_section_id from sections
      where class_id = v_row_class_id and lower(trim(name)) = lower(v_section_name) limit 1;
    if not found then
      raise exception 'Section "%" under "%" for roll number % was not created before import.', v_section_name, v_class_name, v_roll_number;
    end if;

    if v_action = 'insert' then
      begin
        insert into students (full_name, father_name, roll_number, class_id, section_id, phone, status)
          values (v_full_name, v_father_name, v_roll_number, v_row_class_id, v_row_section_id, v_phone, 'ACTIVE');
        v_created := v_created + 1;
      exception when unique_violation then
        raise exception 'Roll number % already exists in % → %.', v_roll_number, v_class_name, v_section_name;
      end;

    elsif v_action in ('update', 'move') then
      if v_student_id is null then
        raise exception 'Missing student_id for % action on roll number %.', v_action, v_roll_number;
      end if;

      begin
        update students
          set full_name = v_full_name,
              father_name = coalesce(v_father_name, father_name), -- never blanks out a name already on file just because this import's column was empty
              phone = v_phone,
              class_id = v_row_class_id,
              section_id = v_row_section_id
          where id = v_student_id;
      exception when unique_violation then
        raise exception 'Roll number % already exists in % → %.', v_roll_number, v_class_name, v_section_name;
      end;

      if not found then
        raise exception 'Student % (roll %) could not be found to update — it may have been removed.', v_full_name, v_roll_number;
      end if;

      if v_action = 'update' then
        v_updated := v_updated + 1;
      else
        v_moved := v_moved + 1;
      end if;

    else
      raise exception 'Unknown import action "%" for roll number %.', v_action, v_roll_number;
    end if;
  end loop;

  -- ---------- Activity log (part of the same transaction) ----------
  select full_name, role into v_admin_name, v_admin_role from profiles where id = auth.uid();

  insert into admin_activity_logs (admin_id, admin_name, admin_role, action, target, description)
  values (
    auth.uid(),
    coalesce(v_admin_name, 'Unknown Admin'),
    coalesce(v_admin_role, 'MAIN_SUPER_ADMIN'),
    'CSV Imported',
    v_total || ' students',
    format(
      'Imported %s from CSV "%s": %s new, %s updated, %s moved, %s skipped. %s new class(es), %s new section(s).',
      v_total, coalesce(payload->>'source_filename', 'upload.csv'),
      v_created, v_updated, v_moved, v_skipped,
      array_length(v_classes_created, 1), jsonb_array_length(v_sections_created)
    )
  );

  return jsonb_build_object(
    'total_rows', v_total,
    'students_created', v_created,
    'students_updated', v_updated,
    'students_moved', v_moved,
    'students_skipped', v_skipped,
    'classes_created', to_jsonb(v_classes_created),
    'sections_created', v_sections_created
  );
end;
$$;

revoke all on function apply_student_import(jsonb) from public;
grant execute on function apply_student_import(jsonb) to authenticated;
