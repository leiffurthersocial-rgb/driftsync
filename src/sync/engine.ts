import type { CollectionKey, Profile, Settings } from "@/data/schema";
import { CURRENT_VERSION } from "@/data/schema";
import type { LocalStorageRepository, RemoteChanges } from "@/data/local-storage-repository";

/** One row of the `records` table. */
export interface RemoteRow {
  collection: CollectionKey;
  id: string;
  data: unknown;
  updated_at: string;
  deleted_at: string | null;
  synced_at?: string;
}

export interface RemoteSnapshot {
  rows: RemoteRow[];
  appState: { profile: unknown; settings: unknown; version: number } | null;
  /** Highest `synced_at` seen (server clock); pass back as `since` next time. */
  cursor: string | null;
}

/** What the engine needs from the server (Supabase in the app, an in-memory fake in tests). */
export interface Remote {
  /** Rows the server stored after `since` (or everything when null), plus the profile/settings row. */
  pull(since: string | null): Promise<RemoteSnapshot>;
  /** Upload changes; the server keeps whichever copy of a record is newer. */
  push(rows: RemoteRow[], profile: Profile | null, settings: Settings | null, version: number): Promise<void>;
}

/** Per-device sync bookkeeping (kept in localStorage next to the data). */
export interface SyncMeta {
  /** Account this device last synced with. A different (or no) account means "first sync". */
  userId: string | null;
  cursor: string | null;
  /** Local edits after this moment haven't been uploaded yet. */
  pushedAt: string;
}

export const EMPTY_META: SyncMeta = { userId: null, cursor: null, pushedAt: new Date(0).toISOString() };

/** When this device and the account both already have data: merge them, or take the account's. */
export type FirstSyncChoice = "merge" | "account";

export type SyncOutcome = "upload-all" | "download-all" | "merge" | "account" | "incremental";

export interface SyncResult {
  meta: SyncMeta;
  outcome: SyncOutcome;
  /** Local data changed, so the UI should reload it. */
  changedLocal: boolean;
  pushed: number;
}

/** Re-read rows the server stored slightly before the cursor; merging is idempotent, so overlap is free. */
const OVERLAP_MS = 2 * 60 * 1000;
const BATCH = 500;

export function toChanges(snap: RemoteSnapshot): RemoteChanges {
  return {
    records: snap.rows.map((r) => ({
      collection: r.collection,
      record: {
        ...(r.data as object),
        // The columns are the source of truth; keep the JSON consistent with them.
        updatedAt: iso(r.updated_at) ?? (r.data as { updatedAt?: string })?.updatedAt,
        deletedAt: r.deleted_at ? iso(r.deleted_at) : null,
      },
    })),
    profile: snap.appState?.profile ?? null,
    settings: snap.appState?.settings ?? null,
  };
}

const iso = (t: string | null | undefined) => {
  if (!t) return null;
  const n = Date.parse(t);
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
};

const isEmpty = (snap: RemoteSnapshot) => snap.rows.length === 0 && !snap.appState;

/**
 * One sync round.
 *
 * First sync of this device with an account:
 *   - account empty            → upload everything from this device
 *   - this device has nothing  → take the account's data
 *   - both have data           → ask: merge both (newest edit wins) or use the account's data
 * After that: pull what changed on the server, merge it, then push local edits.
 */
export async function syncOnce(opts: {
  local: LocalStorageRepository;
  remote: Remote;
  meta: SyncMeta;
  userId: string;
  chooseFirstSync(): Promise<FirstSyncChoice>;
}): Promise<SyncResult> {
  const { local, remote, userId } = opts;
  let meta = opts.meta;
  let outcome: SyncOutcome = "incremental";
  let changedLocal = false;
  /** Copies that just arrived from the server don't need sending back. */
  const fromServer = new Set<string>();
  const remember = (snap: RemoteSnapshot) => {
    for (const r of snap.rows) fromServer.add(`${r.collection}:${r.id}:${Date.parse(r.updated_at)}`);
  };

  if (meta.userId !== userId) {
    const snap = await remote.pull(null);
    if (isEmpty(snap)) {
      outcome = "upload-all";
      meta = { userId, cursor: snap.cursor, pushedAt: EMPTY_META.pushedAt };
    } else if (local.isPristine()) {
      outcome = "download-all";
      const pushedAt = new Date().toISOString();
      local.replaceWithRemote(toChanges(snap), snap.appState?.version ?? CURRENT_VERSION);
      return { meta: { userId, cursor: snap.cursor, pushedAt }, outcome, changedLocal: true, pushed: 0 };
    } else {
      const choice = await opts.chooseFirstSync();
      if (choice === "account") {
        const pushedAt = new Date().toISOString();
        local.replaceWithRemote(toChanges(snap), snap.appState?.version ?? CURRENT_VERSION);
        return { meta: { userId, cursor: snap.cursor, pushedAt }, outcome: "account", changedLocal: true, pushed: 0 };
      }
      outcome = "merge";
      remember(snap);
      changedLocal = local.applyRemote(toChanges(snap), { dedupePresets: true }) > 0;
      // Upload everything local; the server keeps the newer copy of each record.
      meta = { userId, cursor: snap.cursor, pushedAt: EMPTY_META.pushedAt };
    }
  } else {
    const since = meta.cursor ? new Date(Date.parse(meta.cursor) - OVERLAP_MS).toISOString() : null;
    const snap = await remote.pull(since);
    remember(snap);
    changedLocal = local.applyRemote(toChanges(snap)) > 0;
    const cursor = snap.cursor && (!meta.cursor || snap.cursor > meta.cursor) ? snap.cursor : meta.cursor;
    meta = { ...meta, cursor };
  }

  // Note the time before collecting, so edits made while uploading are picked up next round.
  const startedAt = new Date().toISOString();
  const changes = local.changedSince(meta.pushedAt);
  const rows: RemoteRow[] = changes.records
    .filter(({ collection, record }) => !fromServer.has(`${collection}:${record.id}:${Date.parse(record.updatedAt)}`))
    .map(({ collection, record }) => ({
      collection,
      id: record.id,
      data: record,
      updated_at: record.updatedAt,
      deleted_at: record.deletedAt,
    }));
  for (let i = 0; i < Math.max(1, Math.ceil(rows.length / BATCH)); i++) {
    const batch = rows.slice(i * BATCH, (i + 1) * BATCH);
    const first = i === 0;
    if (!batch.length && !(first && (changes.profile || changes.settings))) continue;
    await remote.push(batch, first ? changes.profile : null, first ? changes.settings : null, CURRENT_VERSION);
  }
  // 1 ms earlier so an edit in that same millisecond is re-sent rather than missed (the server ignores repeats).
  const pushedAt = new Date(Date.parse(startedAt) - 1).toISOString();
  return { meta: { ...meta, pushedAt }, outcome, changedLocal, pushed: rows.length };
}
