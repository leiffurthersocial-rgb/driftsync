/**
 * Supabase settings come from environment variables (see .env.example and docs/supabase.md).
 * Without them the app runs fully on-device and the account features stay hidden.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Supabase's newer "publishable" key and the classic "anon" key both work here.
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const OAUTH_PROVIDERS = ["google", "github", "apple", "azure", "discord", "gitlab"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const cloudConfig = {
  url: url.replace(/\/+$/, ""),
  key,
  /** Extra sign-in buttons, e.g. NEXT_PUBLIC_SUPABASE_PROVIDERS=google,github (email links are always on). */
  providers: (process.env.NEXT_PUBLIC_SUPABASE_PROVIDERS ?? "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is OAuthProvider => (OAUTH_PROVIDERS as readonly string[]).includes(p)),
};

export const cloudEnabled = Boolean(cloudConfig.url && cloudConfig.key);

export const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: "Google",
  github: "GitHub",
  apple: "Apple",
  azure: "Microsoft",
  discord: "Discord",
  gitlab: "GitLab",
};
