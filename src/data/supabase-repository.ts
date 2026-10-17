import type { Repository } from "./repository";

/**
 * Placeholder for a future Supabase-backed repository. See README "Connecting Supabase".
 *
 * Suggested mapping: one table per collection (activities, blocks, todos, lists, goals,
 * templates) with the same columns as the zod schemas plus `user_id`, and one `app_state` row per
 * user for the profile/settings singletons. Records already carry UUIDs, timestamps and
 * `deleted_at`, so last-write-wins sync on `updated_at` works out of the box.
 */
export function createSupabaseRepository(): Repository {
  throw new Error(
    "SupabaseRepository is not implemented yet. Set NEXT_PUBLIC_DRIFTSYNC_STORAGE=local or implement src/data/supabase-repository.ts.",
  );
}
