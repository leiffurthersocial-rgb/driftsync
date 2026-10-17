import { LocalStorageRepository } from "./local-storage-repository";

let instance: LocalStorageRepository | null = null;

/**
 * All data lives on the device first (instant, works offline). When Supabase is configured and
 * you're signed in, src/sync keeps this copy in sync with your account in the background.
 */
export function getRepository(): LocalStorageRepository {
  instance ??= new LocalStorageRepository();
  return instance;
}

export type { Repository } from "./repository";
export * from "./schema";
