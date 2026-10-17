"use client";

import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCloud } from "@/store/cloud-store";
import { cn } from "@/lib/cn";

const LABEL = { syncing: "Syncing", synced: "Synced", offline: "Offline, will sync later", error: "Sync problem", off: "", "signed-out": "" } as const;

/** Small cloud in the header while signed in; links to Settings → Account. */
export function SyncIndicator() {
  const status = useCloud((s) => s.status);
  const email = useCloud((s) => s.email);
  if (!email || status === "off" || status === "signed-out") return null;
  const Icon = status === "syncing" ? RefreshCw : status === "synced" ? Cloud : CloudOff;
  return (
    <Link
      href="/settings#account"
      className={cn(
        "grid h-9 w-9 place-items-center rounded-xl border border-line/70 bg-surface transition hover:text-ink",
        status === "error" ? "text-danger" : "text-muted",
      )}
      aria-label={`${LABEL[status]}. Account settings`}
      title={LABEL[status]}
    >
      <Icon size={16} className={cn(status === "syncing" && "animate-spin")} aria-hidden />
    </Link>
  );
}
