-- Several photographs for news, events and a Gallery of memories.
-- news.image_url and events.image_url stay as the main (cover) image. Extra photographs live in site_images.

-- A Gallery album is a titled group of photographs, for example "Annual Sports Day".
create table if not exists public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 150),
  description text check (description is null or char_length(description) <= 1000),
  event_date date,
  status content_status not null default 'DRAFT',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_images (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('news', 'event', 'album')),
  owner_id uuid not null,
  url text not null check (char_length(url) between 10 and 600),
  caption text check (caption is null or char_length(caption) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists site_images_owner_idx on public.site_images (owner_type, owner_id, sort_order);

alter table public.gallery_albums enable row level security;
alter table public.site_images enable row level security;

drop policy if exists gallery_albums_select on public.gallery_albums;
create policy gallery_albums_select on public.gallery_albums for select
  using (status = 'PUBLISHED' or can_manage('manage_content') or is_principal());
drop policy if exists gallery_albums_write on public.gallery_albums;
create policy gallery_albums_write on public.gallery_albums for all to authenticated
  using (can_manage('manage_content')) with check (can_manage('manage_content'));

-- A photograph is visible when the item it belongs to is visible.
drop policy if exists site_images_select on public.site_images;
create policy site_images_select on public.site_images for select
  using (
    can_manage('manage_content') or is_principal()
    or (owner_type = 'news' and exists (select 1 from news n where n.id = owner_id and n.status = 'PUBLISHED' and n.published_at <= now()))
    or (owner_type = 'event' and exists (select 1 from events e where e.id = owner_id and e.status = 'PUBLISHED'))
    or (owner_type = 'album' and exists (select 1 from gallery_albums a where a.id = owner_id and a.status = 'PUBLISHED'))
  );
drop policy if exists site_images_write on public.site_images;
create policy site_images_write on public.site_images for all to authenticated
  using (can_manage('manage_content')) with check (can_manage('manage_content'));

revoke all on public.gallery_albums, public.site_images from anon;
grant select on public.gallery_albums, public.site_images to anon;

-- At most 30 photographs per item.
create or replace function public.site_images_limit() returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from site_images where owner_type = new.owner_type and owner_id = new.owner_id) >= 30 then
    raise exception 'An item can have at most 30 photographs.' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists site_images_limit_trg on public.site_images;
create trigger site_images_limit_trg before insert on public.site_images for each row execute function public.site_images_limit();

-- Deleting a news item, event or album removes its photograph records.
create or replace function public.site_images_cleanup() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from site_images where owner_id = old.id and owner_type = tg_argv[0];
  return old;
end $$;
drop trigger if exists news_images_cleanup on public.news;
create trigger news_images_cleanup after delete on public.news for each row execute function public.site_images_cleanup('news');
drop trigger if exists events_images_cleanup on public.events;
create trigger events_images_cleanup after delete on public.events for each row execute function public.site_images_cleanup('event');
drop trigger if exists albums_images_cleanup on public.gallery_albums;
create trigger albums_images_cleanup after delete on public.gallery_albums for each row execute function public.site_images_cleanup('album');

revoke all on function public.site_images_limit() from public, anon, authenticated;
revoke all on function public.site_images_cleanup() from public, anon, authenticated;
