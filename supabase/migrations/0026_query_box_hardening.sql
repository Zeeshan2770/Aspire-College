-- Hardening for the public Query Box (run after 0025).
--  1. Uploads: strict file names and a cap on uploads per hour (stops someone filling the storage).
--  2. Rate limits per visitor for sending questions and for guessing tracking codes.
--  3. Attached files must really exist, must not already belong to another question, and their size/type come from storage, not from the browser.

-- Visitor address as seen by the Supabase gateway (Cloudflare sets cf-connecting-ip itself; the browser cannot fake it).
create or replace function public.request_ip() returns text
language plpgsql stable set search_path = public as $$
declare h json; v text;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  if h is null then return null; end if;
  v := nullif(btrim(h->>'cf-connecting-ip'), '');
  if v is null then v := nullif(btrim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''); end if;
  return left(v, 64);
end $$;

create table if not exists public.query_rate_log (
  id bigserial primary key,
  kind text not null check (kind in ('submit', 'track_miss')),
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists query_rate_log_idx on public.query_rate_log (kind, ip, at);
alter table public.query_rate_log enable row level security;   -- no policies: only the functions below touch it
revoke all on public.query_rate_log from public, anon, authenticated;
revoke all on sequence public.query_rate_log_id_seq from public, anon, authenticated;

-- Upload gate used by the storage policy: at most 300 new files per hour across the whole site.
create or replace function public.query_upload_allowed() returns boolean
language sql security definer stable set search_path = public, storage as $$
  select (select count(*) from storage.objects where bucket_id = 'query-attachments' and created_at > now() - interval '1 hour') < 300
$$;
revoke all on function public.query_upload_allowed() from public;
grant execute on function public.query_upload_allowed() to anon, authenticated;

drop policy if exists query_attachments_insert on storage.objects;
create policy query_attachments_insert on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'query-attachments'
    and name ~ '^incoming/[0-9a-fA-F-]{36}\.(jpg|png|webp|pdf)$'
    and public.query_upload_allowed()
  );

create or replace function public.submit_query(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, storage as $$
declare
  v_identity text := upper(trim(coalesce(payload->>'identity_type','')));
  v_vis text := upper(trim(coalesce(payload->>'visibility','')));
  v_name text := nullif(trim(coalesce(payload->>'name','')),'');
  v_email text := nullif(trim(coalesce(payload->>'email','')),'');
  v_phone text := nullif(trim(coalesce(payload->>'phone','')),'');
  v_roll text := nullif(left(trim(coalesce(payload->>'roll_no','')),40),'');
  v_class text := nullif(left(trim(coalesce(payload->>'class_name','')),80),'');
  v_cat text := nullif(left(trim(coalesce(payload->>'category','')),60),'');
  v_subject text := trim(coalesce(payload->>'subject',''));
  v_msg text := trim(coalesce(payload->>'message',''));
  v_att jsonb := '[]'::jsonb;
  v_item jsonb;
  v_obj storage.objects;
  v_ip text := public.request_ip();
  v_code text;
  v_try int := 0;
begin
  if coalesce(payload->>'website','') <> '' then raise exception 'Unable to send your query.'; end if;
  if v_identity not in ('STUDENT','PARENT','TEACHER','APPLICANT','ALUMNI','OTHER') then raise exception 'Please choose who you are.'; end if;
  if v_vis not in ('FULL','NAME_ONLY','ANONYMOUS') then raise exception 'Please choose how you want to share your identity.'; end if;
  if v_cat is null then raise exception 'Please choose a topic.'; end if;
  if v_subject = '' or v_msg = '' then raise exception 'Please enter a subject and your question.'; end if;
  if length(v_subject) > 200 or length(v_msg) > 4000 then raise exception 'Your query is too long.'; end if;
  if v_vis = 'ANONYMOUS' then
    v_name := null; v_email := null; v_phone := null; v_roll := null; v_class := null;
  elsif v_vis = 'NAME_ONLY' then
    v_email := null; v_phone := null;
    if v_name is null then raise exception 'Please enter your name.'; end if;
  else
    if v_name is null then raise exception 'Please enter your name.'; end if;
    if v_email is null and v_phone is null then raise exception 'Please provide an email address or phone number so we can reach you.'; end if;
  end if;
  if v_name is not null and length(v_name) > 120 then raise exception 'The name is too long.'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email address.'; end if;
  if v_phone is not null and v_phone !~ '^[0-9+\-\s]{10,16}$' then raise exception 'Please enter a valid phone number.'; end if;

  -- Rate limits: 5 questions per visitor per 10 minutes, 100 per hour for the whole site.
  delete from query_rate_log where at < now() - interval '1 day';
  if v_ip is not null and (select count(*) from query_rate_log where kind = 'submit' and ip = v_ip and at > now() - interval '10 minutes') >= 5 then
    raise exception 'You have sent several questions in a short time. Please wait a few minutes and try again.';
  end if;
  if (select count(*) from public_queries where created_at > now() - interval '1 hour') > 100 then
    raise exception 'Too many queries right now. Please try again later.';
  end if;

  -- Attachments: up to 3 files that really exist in storage and are not attached to another question.
  if jsonb_typeof(payload->'attachments') = 'array' then
    if jsonb_array_length(payload->'attachments') > 3 then raise exception 'You can attach up to 3 files.'; end if;
    for v_item in select * from jsonb_array_elements(payload->'attachments') loop
      if coalesce(v_item->>'path','') !~ '^incoming/[0-9a-fA-F-]{36}\.(jpg|png|webp|pdf)$' then raise exception 'One of the attachments is not valid.'; end if;
      select * into v_obj from storage.objects where bucket_id = 'query-attachments' and name = v_item->>'path';
      if not found then raise exception 'One of the attachments could not be found. Please upload it again.'; end if;
      if exists (select 1 from public_queries pq, jsonb_array_elements(pq.attachments) a where a->>'path' = v_item->>'path') then
        raise exception 'One of the attachments is not valid.';
      end if;
      v_att := v_att || jsonb_build_array(jsonb_build_object(
        'path', v_obj.name,
        'name', left(coalesce(v_item->>'name','file'), 120),
        'size', least(coalesce((v_obj.metadata->>'size')::bigint, 0), 5242880),
        'type', left(coalesce(v_obj.metadata->>'mimetype',''), 60)));
    end loop;
  end if;

  loop
    v_code := 'Q-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)) || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));
    begin
      insert into public_queries (code, identity_type, visibility, name, email, phone, roll_no, class_name, category, subject, message, attachments)
      values (v_code, v_identity, v_vis, v_name, v_email, v_phone, v_roll, v_class, v_cat, left(v_subject,200), v_msg, v_att);
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then raise exception 'Unable to send your query. Please try again.'; end if;
    end;
  end loop;
  if v_ip is not null then insert into query_rate_log (kind, ip) values ('submit', v_ip); end if;
  return jsonb_build_object('ok', true, 'code', v_code);
end $$;

-- Tracking-code lookups: 10 wrong codes per visitor per 10 minutes, then a pause.
create or replace function public.track_query(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public_queries; v_ip text := public.request_ip();
begin
  if v_ip is not null and (select count(*) from query_rate_log where kind = 'track_miss' and ip = v_ip and at > now() - interval '10 minutes') >= 10 then
    raise exception 'Too many unsuccessful attempts. Please wait a few minutes and try again.';
  end if;
  select * into q from public_queries where code = upper(trim(coalesce(p_code,'')));
  if not found then
    if v_ip is not null then insert into query_rate_log (kind, ip) values ('track_miss', v_ip); end if;
    return null;
  end if;
  return jsonb_build_object(
    'code', q.code, 'status', q.status, 'category', q.category, 'subject', q.subject,
    'message', q.message, 'created_at', q.created_at,
    'replies', coalesce((select jsonb_agg(jsonb_build_object('body', r.body, 'created_at', r.created_at) order by r.created_at)
                         from query_replies r where r.query_id = q.id and r.is_public), '[]'::jsonb));
end $$;

revoke all on function public.request_ip() from public, anon, authenticated;
revoke all on function public.submit_query(jsonb), public.track_query(text) from public;
grant execute on function public.submit_query(jsonb), public.track_query(text) to anon, authenticated;
