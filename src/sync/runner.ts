"use client";

import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { getRepository } from "@/data";
import { useApp } from "@/store/app-store";
import { useCloud } from "@/store/cloud-store";
import { callbackUrl, getSupabase } from "./client";
import type { OAuthProvider } from "./config";
import { EMPTY_META, syncOnce, type FirstSyncChoice, type SyncMeta } from "./engine";
import { SupabaseRemote } from "./supabase-remote";

const META_KEY = "driftsync:sync";
const INTERVAL_MS = 2 * 60 * 1000;
const EDIT_DEBOUNCE_MS = 1500;

let user: { id: string; email: string | null } | null = null;
let running: Promise<void> | null = null;
let again = false;
let channel: RealtimeChannel | null = null;
let editTimer: ReturnType<typeof setTimeout> | null = null;
let resolveChoice: ((c: FirstSyncChoice) => void) | null = null;

function loadMeta(): SyncMeta {
  try {
    return { ...EMPTY_META, ...JSON.parse(localStorage.getItem(META_KEY) ?? "{}") };
  } catch {
    return EMPTY_META;
  }
}
const saveMeta = (m: SyncMeta) => localStorage.setItem(META_KEY, JSON.stringify(m));

const set = (patch: Partial<ReturnType<typeof useCloud.getState>>) => useCloud.setState(patch);

/** Run a sync round now (or right after the one in progress). Safe to call often. */
export function syncNow(): Promise<void> {
  const sb = getSupabase();
  if (!sb || !user) return Promise.resolve();
  if (!navigator.onLine) {
    set({ status: "offline" });
    return Promise.resolve();
  }
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      const u: { id: string; email: string | null } | null = user;
      if (!u) break;
      set({ status: "syncing", error: null });
      try {
        const r = await syncOnce({
          local: getRepository(),
          remote: new SupabaseRemote(sb, u.id),
          meta: loadMeta(),
          userId: u.id,
          chooseFirstSync: () =>
            new Promise<FirstSyncChoice>((resolve) => {
              resolveChoice = resolve;
              set({ choosing: true });
            }),
        });
        if (user?.id !== u.id) break; // signed out meanwhile
        saveMeta(r.meta);
        if (r.changedLocal) await useApp.getState().reload();
        set({ status: "synced", lastSyncAt: new Date().toISOString(), error: null });
      } catch (e) {
        set({ status: navigator.onLine ? "error" : "offline", error: (e as Error).message });
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Answer the "this device and your account both have data" question. */
export function chooseFirstSync(choice: FirstSyncChoice) {
  set({ choosing: false });
  resolveChoice?.(choice);
  resolveChoice = null;
}

function onSession(session: Session | null) {
  const next = session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;
  if (next?.id === user?.id) return;
  user = next;
  channel?.unsubscribe();
  channel = null;
  if (!user) {
    set({ status: "signed-out", email: null, lastSyncAt: null, error: null, choosing: false });
    return;
  }
  set({ email: user.email });
  const sb = getSupabase()!;
  // Instant updates from other devices (falls back to the periodic sync if Realtime is off).
  channel = sb
    .channel(`driftsync:${user.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "records", filter: `user_id=eq.${user.id}` }, () => schedule(800))
    .on("postgres_changes", { event: "*", schema: "public", table: "app_state", filter: `user_id=eq.${user.id}` }, () => schedule(800))
    .subscribe();
  void syncNow();
}

function schedule(ms = EDIT_DEBOUNCE_MS) {
  if (editTimer) clearTimeout(editTimer);
  editTimer = setTimeout(() => void syncNow(), ms);
}

/** Wire up auth, edit-triggered sync, focus/online/interval sync. Returns a cleanup function. */
export function startCloudSync(): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    // Supabase advises not to call other Supabase methods inside this callback directly.
    setTimeout(() => onSession(session), 0);
  });
  const unsubscribe = getRepository().subscribe(() => user && schedule());
  const onWake = () => document.visibilityState === "visible" && void syncNow();
  const onOnline = () => void syncNow();
  const onOffline = () => user && set({ status: "offline" });
  window.addEventListener("focus", onWake);
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  const timer = setInterval(() => void syncNow(), INTERVAL_MS);
  return () => {
    data.subscription.unsubscribe();
    unsubscribe();
    window.removeEventListener("focus", onWake);
    document.removeEventListener("visibilitychange", onWake);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    clearInterval(timer);
    channel?.unsubscribe();
    channel = null;
    user = null; // so a restart (e.g. React dev double-mount) re-reads the session
  };
}

/* ---------- account actions ---------- */

export async function sendMagicLink(email: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Sync isn't set up on this site.");
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl(), shouldCreateUser: true } });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function signInWithProvider(provider: OAuthProvider) {
  const sb = getSupabase();
  if (!sb) throw new Error("Sync isn't set up on this site.");
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl() } });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/**
 * Sign out. Data stays on this device unless `wipe` is set. The sync bookmark is kept, so signing
 * back in to the same account simply continues (edits made meanwhile are uploaded then).
 */
export async function signOut({ wipe = false } = {}) {
  const sb = getSupabase();
  user = null; // stop syncing before anything else changes
  if (wipe) saveMeta(EMPTY_META);
  channel?.unsubscribe();
  channel = null;
  await sb?.auth.signOut();
  set({ status: "signed-out", email: null, lastSyncAt: null, error: null, choosing: false });
  if (wipe) await useApp.getState().reset("all");
}

/** Delete everything stored in the account (data on this device stays), then sign out. */
export async function deleteCloudData() {
  const sb = getSupabase();
  if (!sb || !user) return;
  const uid = user.id;
  const a = await sb.from("records").delete().eq("user_id", uid);
  if (a.error) throw new Error(a.error.message);
  const b = await sb.from("app_state").delete().eq("user_id", uid);
  if (b.error) throw new Error(b.error.message);
  saveMeta(EMPTY_META); // the account is empty now; signing in again starts a fresh first sync
  await signOut();
}

export function friendlyAuthError(message: string) {
  if (/rate limit/i.test(message)) return "Too many sign-in emails were sent recently. Wait a few minutes and try again.";
  if (/redirect/i.test(message)) return "This site's address isn't in Supabase's allowed redirect URLs (Authentication → URL Configuration).";
  if (/provider is not enabled|Unsupported provider/i.test(message)) return "That sign-in method isn't enabled in Supabase (Authentication → Providers).";
  if (/invalid.*email|email.*invalid/i.test(message)) return "That email address doesn't look right.";
  if (/Signups not allowed/i.test(message)) return "New sign-ups are turned off for this site.";
  return message;
}
