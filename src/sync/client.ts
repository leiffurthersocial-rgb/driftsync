import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cloudConfig, cloudEnabled } from "./config";

let client: SupabaseClient | null = null;

/**
 * The browser Supabase client (null when not configured). PKCE flow: sign-in links come back to
 * /auth/callback with a one-time code, which the client exchanges for a session automatically.
 */
export function getSupabase(): SupabaseClient | null {
  if (!cloudEnabled || typeof window === "undefined") return null;
  client ??= createClient(cloudConfig.url, cloudConfig.key, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "driftsync:auth",
    },
  });
  return client;
}

/** Where sign-in links and OAuth providers send you back to. */
export const callbackUrl = () => `${window.location.origin}/auth/callback`;
