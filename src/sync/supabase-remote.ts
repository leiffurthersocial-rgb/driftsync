import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Settings } from "@/data/schema";
import type { Remote, RemoteRow, RemoteSnapshot } from "./engine";

const PAGE = 1000;

/** `Remote` backed by the tables and the driftsync_push function in supabase/schema.sql. */
export class SupabaseRemote implements Remote {
  constructor(
    private sb: SupabaseClient,
    private userId: string,
  ) {}

  async pull(since: string | null): Promise<RemoteSnapshot> {
    const rows: RemoteRow[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = this.sb
        .from("records")
        .select("collection,id,data,updated_at,deleted_at,synced_at")
        .eq("user_id", this.userId)
        .order("synced_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (since) q = q.gt("synced_at", since);
      const { data, error } = await q;
      if (error) throw new SyncError(error.message, error.code);
      rows.push(...((data ?? []) as RemoteRow[]));
      if (!data || data.length < PAGE) break;
    }
    const { data: state, error } = await this.sb.from("app_state").select("profile,settings,version").eq("user_id", this.userId).maybeSingle();
    if (error) throw new SyncError(error.message, error.code);
    const cursor = rows.reduce<string | null>((max, r) => (r.synced_at && (!max || r.synced_at > max) ? r.synced_at : max), since);
    return { rows, appState: state ?? null, cursor };
  }

  async push(rows: RemoteRow[], profile: Profile | null, settings: Settings | null, version: number) {
    const { error } = await this.sb.rpc("driftsync_push", {
      p_records: rows,
      p_profile: profile,
      p_settings: settings,
      p_version: version,
    });
    if (error) throw new SyncError(error.message, error.code);
  }
}

/** A sync failure with a hint that points at the usual cause. */
export class SyncError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(explain(message, code));
  }
}

function explain(message: string, code?: string) {
  if (code === "42P01" || code === "PGRST205" || /relation .* does not exist|Could not find the table/i.test(message))
    return "The Driftsync tables are missing. Run supabase/schema.sql in the Supabase SQL editor.";
  if (code === "PGRST202" || code === "42883" || /driftsync_push/.test(message))
    return "The sync function is missing or outdated. Run the latest supabase/schema.sql in the Supabase SQL editor.";
  if (code === "42501" || /row-level security|permission denied/i.test(message)) return "The server refused access. Try signing out and in again.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return "Can't reach the server. Changes are saved on this device and will sync later.";
  return message;
}
