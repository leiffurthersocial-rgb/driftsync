"use client";

import { ArrowLeft, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useCloud } from "@/store/cloud-store";
import { cloudConfig, cloudEnabled, PROVIDER_LABELS } from "@/sync/config";
import { sendMagicLink, signInWithProvider } from "@/sync/runner";
import { AuthCard } from "./auth-card";

/** Sign in with an email link (no password) or a configured provider. Signing in is optional. */
export function LoginView() {
  const email = useCloud((s) => s.email);
  const [address, setAddress] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!cloudEnabled)
    return (
      <AuthCard title="Sync isn’t set up" label="Sign in">
        <p className="text-sm text-muted">This copy of Driftsync runs on this device only. To add accounts and sync, follow docs/supabase.md in the project.</p>
        <Link href="/" className="btn-primary mt-5 w-full">
          Continue
        </Link>
      </AuthCard>
    );

  if (email)
    return (
      <AuthCard title="You're signed in" label="Sign in">
        <p className="text-sm text-muted">
          Signed in as <span className="font-medium text-ink">{email}</span>. Your data syncs in the background.
        </p>
        <Link href="/" className="btn-primary mt-5 w-full">
          Go to Today
        </Link>
      </AuthCard>
    );

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setError(null);
    setState("sending");
    try {
      await sendMagicLink(address.trim());
      setState("sent");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  };

  if (state === "sent")
    return (
      <AuthCard title="Check your email" label="Sign in">
        <p className="text-sm text-muted">
          We sent a sign-in link to <span className="font-medium text-ink">{address.trim()}</span>. Open it <strong className="text-ink">in this browser</strong> to finish signing in. You can close this tab once you’ve used the link.
        </p>
        <p className="mt-3 text-xs text-muted">Nothing arrived after a minute? Check spam, or try again.</p>
        <button className="btn-soft mt-5 w-full" onClick={() => setState("idle")}>
          Use a different email
        </button>
      </AuthCard>
    );

  return (
    <AuthCard title="Sign in to sync" label="Sign in">
      <p className="text-sm text-muted">Keep your plans, to-dos and templates in sync across your devices. No password: we email you a sign-in link.</p>
      <form onSubmit={send} className="mt-5 space-y-3">
        <div>
          <label htmlFor="login-email" className="label">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            className="input"
            placeholder="you@example.com"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={state === "sending"}>
          {state === "sending" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Mail size={16} aria-hidden />}
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      {cloudConfig.providers.length > 0 && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-muted" aria-hidden>
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <div className="space-y-2">
            {cloudConfig.providers.map((p) => (
              <button
                key={p}
                className="btn-soft w-full"
                onClick={async () => {
                  setError(null);
                  try {
                    await signInWithProvider(p);
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              >
                Continue with {PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Link href="/" className="mt-5 inline-flex items-center gap-1.5 rounded-lg text-sm text-muted hover:text-ink">
        <ArrowLeft size={14} aria-hidden /> Continue without an account
      </Link>
    </AuthCard>
  );
}
