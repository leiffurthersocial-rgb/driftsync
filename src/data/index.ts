import { LocalStorageRepository } from "./local-storage-repository";
import type { Repository } from "./repository";
import { createSupabaseRepository } from "./supabase-repository";

let instance: Repository | null = null;

/** Picks the storage backend from NEXT_PUBLIC_DRIFTSYNC_STORAGE (defaults to local). */
export function getRepository(): Repository {
  if (instance) return instance;
  const backend = process.env.NEXT_PUBLIC_DRIFTSYNC_STORAGE ?? "local";
  if (backend === "supabase") {
    try {
      instance = createSupabaseRepository();
      return instance;
    } catch (err) {
      console.warn("[driftsync] falling back to local storage:", (err as Error).message);
    }
  }
  instance = new LocalStorageRepository();
  return instance;
}

export type { Repository } from "./repository";
export * from "./schema";
