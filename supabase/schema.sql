-- Driftsync schema for Supabase (Postgres).
--
-- Paste this whole file into the Supabase SQL editor and press Run. It is safe to run again at
-- any time (every statement is idempotent), so after updating the app just run it again.
--
-- Design: one row per record, with the record itself stored as JSON exactly as the app's zod
-- schemas describe it (src/data/schema.ts). The app validates and migrates everything it loads,
-- so the database doesn't need to know every field and app updates don't need DB migrations.
--
-- Sync rules:
--   * updated_at  = when the record was last edited (set by the device). Newest edit wins.
--   * synced_at   = when the server last stored it (set here by a trigger). Devices ask for
--                   "everything synced since X", so a device with a wrong clock can't miss changes.
--   * deleted_at  = soft delete, so other devices learn about deletions.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

-- Per-user singletons: profile and settings (each carries its own "updatedAt" inside the JSON).
create table if not exists public.app_state (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  version    integer not null default 4,
  profile    jsonb not null default '{}'::jsonb,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Every collection record (activities, blocks, series, markers, todos, lists, goals, templates).
create table if not exists public.records (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null check (collection in ('activities', 'blocks', 'series', 'markers', 'todos', 'lists', 'goals', 'templates')),
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, collection, id)
);

-- Added in the second version of this file (safe if it already exists).
alter table public.records add column if not exists synced_at timestamptz not null default now();
alter table public.app_state add column if not exists synced_at timestamptz not null default now();

create index if not exists records_user_updated on public.records (user_id, updated_at);
create index if not exists records_user_synced on public.records (user_id, synced_at);

-- The server stamps synced_at on every write.
create or replace function public.driftsync_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.synced_at := now();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.driftsync_touch();

drop trigger if exists app_state_touch on public.app_state;
create trigger app_state_touch before insert or update on public.app_state
  for each row execute function public.driftsync_touch();

-- ---------------------------------------------------------------------------------------------
-- Row-level security: each signed-in user can only see and change their own rows.
-- (The anon/publishable key in the browser is public by design; these policies protect the data.)
-- ---------------------------------------------------------------------------------------------

alter table public.app_state enable row level security;
alter table public.records enable row level security;

drop policy if exists "own app_state" on public.app_state;
create policy "own app_state" on public.app_state
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own records" on public.records;
create policy "own records" on public.records
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------------------------
-- driftsync_push: upload a batch of changes. A record is only replaced when the incoming copy
-- is newer, so a device that was offline can never overwrite newer edits from another device.
-- Runs as the calling user (security invoker), so the policies above still apply.
-- ---------------------------------------------------------------------------------------------

create or replace function public.driftsync_push(
  p_records  jsonb default '[]'::jsonb,
  p_profile  jsonb default null,
  p_settings jsonb default null,
  p_version  integer default null
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n integer := 0;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  insert into public.records as r (user_id, collection, id, data, updated_at, deleted_at)
  select uid, x.collection, x.id, x.data, x.updated_at, x.deleted_at
  from jsonb_to_recordset(coalesce(p_records, '[]'::jsonb))
    as x(collection text, id text, data jsonb, updated_at timestamptz, deleted_at timestamptz)
  on conflict (user_id, collection, id) do update
    set data = excluded.data, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
    where r.updated_at < excluded.updated_at;
  get diagnostics n = row_count;

  if p_profile is not null or p_settings is not null then
    insert into public.app_state as a (user_id, version, profile, settings)
    values (uid, coalesce(p_version, 4), coalesce(p_profile, '{}'::jsonb), coalesce(p_settings, '{}'::jsonb))
    on conflict (user_id) do update set
      profile = case
        when p_profile is not null and coalesce(p_profile ->> 'updatedAt', '') > coalesce(a.profile ->> 'updatedAt', '')
        then p_profile else a.profile end,
      settings = case
        when p_settings is not null and coalesce(p_settings ->> 'updatedAt', '') > coalesce(a.settings ->> 'updatedAt', '')
        then p_settings else a.settings end,
      version = greatest(a.version, coalesce(p_version, a.version)),
      updated_at = now();
  end if;

  return n;
end $$;

revoke all on function public.driftsync_push(jsonb, jsonb, jsonb, integer) from public, anon;
grant execute on function public.driftsync_push(jsonb, jsonb, jsonb, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Realtime (optional but recommended): other devices update within a second or two instead of
-- on their next background check. Skipped silently if Realtime isn't available.
-- ---------------------------------------------------------------------------------------------

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['records', 'app_state'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Optional: purge soft-deleted rows after 30 days (mirrors the app). Needs the pg_cron extension
-- (Database → Extensions → pg_cron), then uncomment and run:
-- select cron.schedule('driftsync-purge', '0 3 * * *',
--   $$ delete from public.records where deleted_at < now() - interval '30 days' $$);
-- ---------------------------------------------------------------------------------------------
