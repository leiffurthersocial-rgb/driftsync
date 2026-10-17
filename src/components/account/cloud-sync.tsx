"use client";

import { Download, GitMerge } from "lucide-react";
import { useEffect } from "react";
import { useCloud } from "@/store/cloud-store";
import { Dialog } from "@/components/ui/dialog";
import { chooseFirstSync, startCloudSync } from "@/sync/runner";

/** Runs background sync while the app is open, and asks how to combine data on a first sync. */
export function CloudSync() {
  const choosing = useCloud((s) => s.choosing);
  const email = useCloud((s) => s.email);
  useEffect(() => startCloudSync(), []);

  return (
    <Dialog
      open={choosing}
      onClose={() => {}}
      hideClose
      title="This device already has data"
      description={`Your account${email ? ` (${email})` : ""} has data too. How should they come together? You only need to choose once.`}
    >
      <div className="space-y-2">
        <button className="flex w-full items-start gap-3 rounded-2xl border border-accent/60 bg-accent/10 p-4 text-left transition hover:bg-accent/15" onClick={() => chooseFirstSync("merge")} data-autofocus>
          <GitMerge size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>
            <span className="block font-medium">Merge both (recommended)</span>
            <span className="block text-sm text-muted">Keep everything from this device and the account. Where the same thing was edited in both places, the newest edit wins.</span>
          </span>
        </button>
        <button className="flex w-full items-start gap-3 rounded-2xl border border-line/70 p-4 text-left transition hover:bg-surface-2" onClick={() => chooseFirstSync("account")}>
          <Download size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
          <span>
            <span className="block font-medium">Use the account’s data</span>
            <span className="block text-sm text-muted">Replace what’s on this device with the account’s data. Nothing from this device is uploaded.</span>
          </span>
        </button>
      </div>
    </Dialog>
  );
}
