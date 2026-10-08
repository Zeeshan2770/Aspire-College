-- Principal block and website title (public-safe, configurable from Settings)
alter table site_settings add column if not exists website_title text;
alter table site_settings add column if not exists principal_name text;
alter table site_settings add column if not exists principal_photo_url text;
alter table site_settings add column if not exists principal_message text;

-- A news item becomes publicly visible only when published_at <= now().
-- Set it automatically the first time an item is published.
create or replace function set_news_published_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'PUBLISHED' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_news_published_at on news;
create trigger trg_news_published_at before insert or update on news
  for each row execute function set_news_published_at();

-- Stamp the author server-side so it cannot be forged by the client
create or replace function set_created_by() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_news_created_by on news;
create trigger trg_news_created_by before insert on news
  for each row execute function set_created_by();
drop trigger if exists trg_events_created_by on events;
create trigger trg_events_created_by before insert on events
  for each row execute function set_created_by();
