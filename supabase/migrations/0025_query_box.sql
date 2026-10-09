-- Public Query Box: anyone can send a question (with optional attachments), choose how much identity to share,
-- and follow it with a tracking code. Management (manage_admissions, plus read-only Principal) answers it from the portal.

create table if not exists public.public_queries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  identity_type text not null check (identity_type in ('STUDENT','PARENT','TEACHER','APPLICANT','ALUMNI','OTHER')),
  visibility text not null check (visibility in ('FULL','NAME_ONLY','ANONYMOUS')),
  name text check (name is null or char_length(name) <= 120),
  email text check (email is null or char_length(email) <= 200),
  phone text check (phone is null or char_length(phone) <= 30),
  roll_no text check (roll_no is null or char_length(roll_no) <= 40),
  class_name text check (class_name is null or char_length(class_name) <= 80),
  category text not null check (char_length(category) between 1 and 60),
  subject text not null check (char_length(btrim(subject)) between 1 and 200),
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'NEW' check (status in ('NEW','IN_PROGRESS','ANSWERED','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- the shape of the identity must match the chosen visibility
  constraint public_queries_identity_chk check (
    (visibility = 'ANONYMOUS' and name is null and email is null and phone is null)
    or (visibility = 'NAME_ONLY' and name is not null and email is null and phone is null)
    or (visibility = 'FULL' and name is not null and (email is not null or phone is not null))
  )
);
create index if not exists public_queries_status_idx on public.public_queries (status, created_at desc);

create table if not exists public.query_replies (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.public_queries(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  is_public boolean not null default true,   -- true: the person who asked can read it; false: internal staff note
  author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists query_replies_query_idx on public.query_replies (query_id, created_at);

alter table public.public_queries enable row level security;
alter table public.query_replies enable row level security;

drop policy if exists public_queries_select on public.public_queries;
create policy public_queries_select on public.public_queries for select to authenticated
  using (can_manage('manage_admissions') or is_principal());
drop policy if exists public_queries_update on public.public_queries;
create policy public_queries_update on public.public_queries for update to authenticated
  using (can_manage('manage_admissions')) with check (can_manage('manage_admissions'));
drop policy if exists public_queries_delete on public.public_queries;
create policy public_queries_delete on public.public_queries for delete to authenticated
  using (can_manage('manage_admissions'));

drop policy if exists query_replies_select on public.query_replies;
create policy query_replies_select on public.query_replies for select to authenticated
  using (can_manage('manage_admissions') or is_principal());
drop policy if exists query_replies_insert on public.query_replies;
create policy query_replies_insert on public.query_replies for insert to authenticated
  with check (can_manage('manage_admissions') and author_id = auth.uid());

revoke all on public.public_queries, public.query_replies from anon;

-- Private bucket for attachments: 5 MB, images and PDF only. Visitors may upload (never read); management reads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('query-attachments', 'query-attachments', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists query_attachments_insert on storage.objects;
create policy query_attachments_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'query-attachments' and name like 'incoming/%');
drop policy if exists query_attachments_select on storage.objects;
create policy query_attachments_select on storage.objects for select to authenticated
  using (bucket_id = 'query-attachments' and (can_manage('manage_admissions') or is_principal()));
drop policy if exists query_attachments_delete on storage.objects;
create policy query_attachments_delete on storage.objects for delete to authenticated
  using (bucket_id = 'query-attachments' and can_manage('manage_admissions'));

-- Visitors submit through this function only.
create or replace function public.submit_query(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
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
  v_code text;
  v_try int := 0;
begin
  if coalesce(payload->>'website','') <> '' then raise exception 'Unable to send your query.'; end if;
  if v_identity not in ('STUDENT','PARENT','TEACHER','APPLICANT','ALUMNI','OTHER') then raise exception 'Please choose who you are.'; end if;
  if v_vis not in ('FULL','NAME_ONLY','ANONYMOUS') then raise exception 'Please choose how you want to share your identity.'; end if;
  if v_cat is null then raise exception 'Please choose a topic.'; end if;
  if v_subject = '' or v_msg = '' then raise exception 'Please enter a subject and your question.'; end if;
  if length(v_subject) > 200 or length(v_msg) > 4000 then raise exception 'Your query is too long.'; end if;

  -- Keep only what the chosen identity option allows.
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

  -- Attachments: up to 3 files that were uploaded to incoming/.
  if jsonb_typeof(payload->'attachments') = 'array' then
    if jsonb_array_length(payload->'attachments') > 3 then raise exception 'You can attach up to 3 files.'; end if;
    for v_item in select * from jsonb_array_elements(payload->'attachments') loop
      if coalesce(v_item->>'path','') !~ '^incoming/[0-9a-fA-F-]{36}\.(jpg|png|webp|pdf)$' then raise exception 'One of the attachments is not valid.'; end if;
      v_att := v_att || jsonb_build_array(jsonb_build_object(
        'path', v_item->>'path',
        'name', left(coalesce(v_item->>'name','file'), 120),
        'size', least(coalesce((v_item->>'size')::bigint, 0), 5242880),
        'type', left(coalesce(v_item->>'type',''), 60)));
    end loop;
  end if;

  if (select count(*) from public_queries where created_at > now() - interval '1 hour') > 100 then
    raise exception 'Too many queries right now. Please try again later.';
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
  return jsonb_build_object('ok', true, 'code', v_code);
end $$;

-- The person who asked follows the progress with the tracking code (no sign-in). Only public replies are returned.
create or replace function public.track_query(p_code text) returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare q public_queries;
begin
  select * into q from public_queries where code = upper(trim(coalesce(p_code,'')));
  if not found then return null; end if;
  return jsonb_build_object(
    'code', q.code, 'status', q.status, 'category', q.category, 'subject', q.subject,
    'message', q.message, 'created_at', q.created_at,
    'replies', coalesce((select jsonb_agg(jsonb_build_object('body', r.body, 'created_at', r.created_at) order by r.created_at)
                         from query_replies r where r.query_id = q.id and r.is_public), '[]'::jsonb));
end $$;

revoke all on function public.submit_query(jsonb), public.track_query(text) from public;
grant execute on function public.submit_query(jsonb), public.track_query(text) to anon, authenticated;
