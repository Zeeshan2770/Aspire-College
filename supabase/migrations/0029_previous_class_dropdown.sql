-- Previous class becomes a dropdown on the admission form (see src/lib/previousClass.ts).
-- No table change: admissions.previous_class stays a text column holding the chosen label,
-- or 'Other: <qualification>' when the applicant picks Other. Existing free-text records are untouched.
-- submit_admission now rejects values that are not in the list or do not fit the selected program.
-- Run once in the Supabase SQL Editor after 0028. Safe to run again.

-- Choices offered for a program level (programs.level). KEEP IN SYNC with src/lib/previousClass.ts.
create or replace function allowed_previous_classes(p_level text) returns text[]
language sql immutable set search_path = public as $$
  select case lower(trim(coalesce(p_level, '')))
    when 'matric' then array['Class 8 (Middle)', 'Class 9 (Matric Part I)', 'Other']
    when 'intermediate' then array['Class 10 (Matric Part II)', '1st Year / Class 11 (Intermediate Part I)', 'Other']
    when 'intermediate equivalent' then array['Class 10 (Matric Part II)', '1st Year / Class 11 (Intermediate Part I)', '2nd Year / Class 12 (Intermediate Part II)', 'Other']
    else array['Class 8 (Middle)', 'Class 9 (Matric Part I)', 'Class 10 (Matric Part II)', '1st Year / Class 11 (Intermediate Part I)', '2nd Year / Class 12 (Intermediate Part II)', 'DIT (Diploma in Information Technology)', 'Other']
  end;
$$;
revoke all on function allowed_previous_classes(text) from public, anon;

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
  v_prev text := nullif(trim(coalesce(payload->>'previous_class','')),'');
  v_prev_choice text;
  v_level text;
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

  -- Previous class: optional, but when given it must be one of the dropdown choices for the selected program.
  -- "Other" arrives as 'Other: <qualification>' and the qualification must not be blank.
  if v_prev is not null then
    if v_prev = 'Other' or v_prev like 'Other:%' then
      v_prev := 'Other: ' || trim(substr(v_prev, 7));
      if v_prev = 'Other: ' then raise exception 'Please specify your previous qualification.'; end if;
      if length(v_prev) > 127 then raise exception 'Your previous qualification is too long.'; end if;
      v_prev_choice := 'Other';
    else
      v_prev_choice := v_prev;
    end if;
    if not (v_prev_choice = any(allowed_previous_classes(null))) then
      raise exception 'Please select your previous class from the list.';
    end if;
    select level into v_level from programs where lower(trim(name)) = lower(v_program) limit 1;
    if not (v_prev_choice = any(allowed_previous_classes(v_level))) then
      raise exception 'The selected previous class does not match the program you are applying for. Please choose again.';
    end if;
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
    v_prev,
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

revoke all on function submit_admission(jsonb) from public;
grant execute on function submit_admission(jsonb) to anon, authenticated;
