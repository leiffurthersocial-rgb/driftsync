-- Driftsync schema for Supabase (Postgres). Run once in the Supabase SQL editor.
--
-- Design: one row per record, with the record itself stored as JSON exactly as the app's zod
-- schemas describe it (src/data/schema.ts). The app already validates and migrates everything it
-- loads, so the database doesn't need to know every field, and new app versions don't need a
-- database migration. Sync is last-write-wins on updated_at; deletes are soft (deleted_at).

-- Per-user singletons: profile and settings, plus the data version.
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

-- "Give me everything that changed since my last sync."
create index if not exists records_user_updated on public.records (user_id, updated_at);

-- Row-level security: each signed-in user can only see and change their own rows.
-- (The anon key in the browser is public by design; these policies are what protect the data.)
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

-- Optional: live updates across devices (subscribe to changes on public.records).
-- alter publication supabase_realtime add table public.records;

-- Optional: purge soft-deleted rows after 30 days (mirrors the local app). Needs the pg_cron extension.
-- select cron.schedule('driftsync-purge', '0 3 * * *',
--   $$ delete from public.records where deleted_at < now() - interval '30 days' $$);
