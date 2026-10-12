-- 0027_application_status_tracking
-- Applicants can check their admission decision on the public site with their application number + the phone number
-- they applied with. Staff can write a short message that the applicant sees (internal notes stay private).
-- Run in the Supabase SQL Editor after 0026.

alter table public.admissions add column if not exists applicant_message text
  check (applicant_message is null or char_length(applicant_message) <= 600);
alter table public.admissions add column if not exists applicant_message_at timestamptz;

-- allow the new rate-limit kind
alter table public.query_rate_log drop constraint if exists query_rate_log_kind_check;
alter table public.query_rate_log add constraint query_rate_log_kind_check check (kind in ('submit', 'track_miss', 'app_miss'));

-- Staff: set / clear the message shown to the applicant.
create or replace function public.set_admission_message(p_id uuid, p_message text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_msg text := nullif(trim(coalesce(p_message, '')), ''); v_adm admissions;
begin
  if not can_manage('manage_admissions') then raise exception 'PERMISSION_DENIED: you cannot manage admissions.'; end if;
  if v_msg is not null and length(v_msg) > 600 then raise exception 'The message is too long (600 characters at most).'; end if;
  select * into v_adm from admissions where id = p_id for update;
  if not found then raise exception 'Application not found.'; end if;
  update admissions set applicant_message = v_msg, applicant_message_at = case when v_msg is null then null else now() end where id = p_id;
  perform log_activity('Admission Message Updated', v_adm.application_no, format('Message to applicant %s for %s', case when v_msg is null then 'cleared' else 'saved' end, v_adm.application_no));
  return jsonb_build_object('ok', true);
end $$;

-- Public: look up one application. Needs the application number AND the applicant's or guardian's phone number.
create or replace function public.track_application(p_no text, p_phone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a admissions;
  v_ip text := public.request_ip();
  v_no text := upper(trim(coalesce(p_no, '')));
  v_digits text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
begin
  if v_ip is not null and (select count(*) from query_rate_log where kind = 'app_miss' and ip = v_ip and at > now() - interval '10 minutes') >= 10 then
    raise exception 'Too many unsuccessful attempts. Please wait a few minutes and try again.';
  end if;
  if length(v_digits) >= 10 then
    select * into a from admissions where application_no = v_no
      and (right(regexp_replace(phone, '\D', '', 'g'), 10) = v_digits or right(regexp_replace(guardian_phone, '\D', '', 'g'), 10) = v_digits);
  end if;
  if a.id is null then
    if v_ip is not null then insert into query_rate_log (kind, ip) values ('app_miss', v_ip); end if;
    return null;
  end if;
  return jsonb_build_object(
    'application_no', a.application_no,
    'first_name', split_part(a.full_name, ' ', 1),
    'program', a.program_applied,
    'status', a.status,
    'submitted_at', a.created_at,
    'decided_at', a.reviewed_at,
    'message', a.applicant_message,
    'message_at', a.applicant_message_at);
end $$;

revoke all on function public.set_admission_message(uuid, text), public.track_application(text, text) from public, anon;
grant execute on function public.set_admission_message(uuid, text) to authenticated;
grant execute on function public.track_application(text, text) to anon, authenticated;
