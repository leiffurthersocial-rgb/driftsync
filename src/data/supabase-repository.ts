import type { Repository } from "./repository";

/**
 * Placeholder for a future Supabase-backed repository. See README "Connecting Supabase".
 *
 * Tables (supabase/schema.sql): `app_state` (one row per user: profile, settings, version) and
 * `records` (one row per collection record, the record stored as JSON). Records already carry
 * ids, timestamps and `deletedAt`, so last-write-wins sync on `updated_at` works out of the box.
 * The README section "Connecting Supabase (with login)" walks through auth and sync.
 */
export function createSupabaseRepository(): Repository {
  throw new Error(
    "SupabaseRepository is not implemented yet. Set NEXT_PUBLIC_DRIFTSYNC_STORAGE=local or implement src/data/supabase-repository.ts.",
  );
}
