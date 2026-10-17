"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCloud } from "@/store/cloud-store";
import { getSupabase } from "@/sync/client";
import { AuthCard } from "./auth-card";

/**
 * Sign-in links and providers land here with a one-time code. The Supabase client exchanges it
 * for a session as it starts; we wait for that and for the first sync, then go to Today.
 */
export function AuthCallback() {
  const router = useRouter();
  const status = useCloud((s) => s.status);
  const syncError = useCloud((s) => s.error);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return setError("Sync isn't set up on this site.");
    const params = new URLSearchParams(window.location.search + "&" + window.location.hash.slice(1));
    const urlError = params.get("error_description") || params.get("error");
    if (urlError) return setError(urlError.replace(/\+/g, " "));
    let alive = true;
    void sb.auth.getSession().then(({ data, error: e }) => {
      if (!alive) return;
      if (data.session) setSignedIn(true);
      else
        setError(
          e?.message ??
            "This sign-in link has expired or was opened in a different browser than the one you requested it from. Request a new link and open it in the same browser.",
        );
    });
    return () => {
      alive = false;
    };
  }, []);

  // Once signed in, wait for the first sync so you land on your own data.
  useEffect(() => {
    if (!signedIn) return;
    if (status === "synced") router.replace("/");
    const t = setTimeout(() => router.replace("/"), 20_000);
    return () => clearTimeout(t);
  }, [signedIn, status, router]);

  if (error)
    return (
      <AuthCard title="Couldn't sign in" label="Signing in">
        <p role="alert" className="text-sm text-muted">
          {error}
        </p>
        <Link href="/login" className="btn-primary mt-5 w-full">
          Try again
        </Link>
        <Link href="/" className="btn-ghost mt-2 w-full">
          Continue without an account
        </Link>
      </AuthCard>
    );

  return (
    <AuthCard title={signedIn ? "Signed in" : "Signing in…"} label="Signing in">
      <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
        {status !== "error" && <Loader2 size={16} className="animate-spin" aria-hidden />}
        {!signedIn ? "Checking your sign-in link…" : status === "error" ? `Signed in, but syncing failed: ${syncError}` : "Bringing your data over…"}
      </p>
      {signedIn && status === "error" && (
        <Link href="/" className="btn-primary mt-5 w-full">
          Continue
        </Link>
      )}
    </AuthCard>
  );
}
