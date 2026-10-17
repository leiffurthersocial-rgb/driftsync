"use client";

import { Cloud, CloudOff, LogIn, LogOut, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useCloud, type CloudStatus } from "@/store/cloud-store";
import { toast } from "@/store/ui-store";
import { ConfirmDialog } from "@/components/ui/dialog";
import { deleteCloudData, signOut, syncNow } from "@/sync/runner";
import { cn } from "@/lib/cn";

const STATUS: Record<CloudStatus, string> = {
  off: "Not set up",
  "signed-out": "Signed out",
  syncing: "Syncing…",
  synced: "Up to date",
  offline: "Offline: changes are saved here and sync when you're back online",
  error: "Sync problem",
};

export function relativeTime(iso: string | null, now = Date.now()) {
  if (!iso) return "not yet";
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 45) return "just now";
  if (s < 90) return "a minute ago";
  if (s < 3600) return `${Math.round(s / 60)} minutes ago`;
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Settings → Account. `Section`/`Row` come from the settings page so the styling matches. */
export function AccountSection({
  Section,
  Row,
}: {
  Section: (p: { id: string; title: string; description?: string; children: ReactNode }) => ReactNode;
  Row: (p: { label: string; hint?: string; children: ReactNode }) => ReactNode;
}) {
  const { enabled, status, email, lastSyncAt, error } = useCloud();
  const [, tick] = useState(0);
  const [confirm, setConfirm] = useState<"wipe" | "delete" | null>(null);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!enabled)
    return (
      <Section id="account" title="Account & sync">
        <Row label="Sync isn't set up" hint="Everything is saved on this device. To sync between devices, connect Supabase (docs/supabase.md in the project).">
          <CloudOff size={18} className="text-muted" aria-hidden />
        </Row>
      </Section>
    );

  if (!email)
    return (
      <Section id="account" title="Account & sync" description="Optional. Sign in to keep your data in sync across devices and backed up.">
        <Row label="Not signed in" hint="Everything is saved on this device.">
          <Link href="/login" className="btn-primary">
            <LogIn size={16} aria-hidden /> Sign in
          </Link>
        </Row>
      </Section>
    );

  const ok = status === "synced" || status === "syncing";
  return (
    <Section id="account" title="Account & sync" description="Your data is saved on this device first and synced with your account in the background.">
      <Row label={email} hint="Signed in">
        <button className="btn-ghost" onClick={() => setConfirm("wipe")}>
          <LogOut size={16} aria-hidden /> Sign out
        </button>
      </Row>
      <Row label="Sync" hint={status === "error" ? (error ?? "Something went wrong.") : `${STATUS[status]}${status === "synced" ? ` · last synced ${relativeTime(lastSyncAt)}` : ""}`}>
        <span className="flex items-center gap-3">
          <span className={cn("flex items-center gap-1.5 text-sm", ok ? "text-sage" : status === "error" ? "text-danger" : "text-muted")} aria-hidden>
            {ok ? <Cloud size={16} /> : <CloudOff size={16} />}
          </span>
          <button className="btn-soft" onClick={() => void syncNow()} disabled={status === "syncing"}>
            <RefreshCw size={16} className={cn(status === "syncing" && "animate-spin")} aria-hidden /> Sync now
          </button>
        </span>
      </Row>
      <Row label="Delete cloud copy" hint="Removes everything stored in your account and signs you out. Data on this device stays.">
        <button className="btn-ghost text-danger" onClick={() => setConfirm("delete")}>
          <Trash2 size={16} aria-hidden /> Delete
        </button>
      </Row>

      <SignOutDialog open={confirm === "wipe"} onClose={() => setConfirm(null)} />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Delete your cloud copy?"
        description="Everything stored in your account is deleted and you're signed out. This device keeps its data; other devices keep theirs until they sign in again."
        confirmLabel="Delete cloud copy"
        onConfirm={async () => {
          try {
            await deleteCloudData();
            toast("Cloud copy deleted");
          } catch (e) {
            toast((e as Error).message, { tone: "danger" });
          }
        }}
      />
    </Section>
  );
}

function SignOutDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const [wipe, setWipe] = useState(false);
  return (
    <ConfirmDialog
      open={open}
      onClose={() => {
        setWipe(false);
        onClose();
      }}
      tone={wipe ? "danger" : "default"}
      title="Sign out?"
      description={
        <span className="block space-y-3">
            <span className="block">Your data stays safe in your account. Changes you make while signed out sync the next time you sign in.</span>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
              Also remove my data from this device
            </label>
          </span>
      }
      confirmLabel="Sign out"
      onConfirm={async () => {
        await signOut({ wipe });
        toast(wipe ? "Signed out and cleared this device" : "Signed out");
        setWipe(false);
      }}
    />
  );
}
