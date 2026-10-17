"use client";

import { create } from "zustand";
import { cloudEnabled } from "@/sync/config";

export type CloudStatus = "off" | "signed-out" | "syncing" | "synced" | "offline" | "error";

interface CloudState {
  /** Supabase is configured for this site. */
  enabled: boolean;
  status: CloudStatus;
  email: string | null;
  lastSyncAt: string | null;
  error: string | null;
  /** First sync on a device that already has data: waiting for the user to choose. */
  choosing: boolean;
}

export const useCloud = create<CloudState>()(() => ({
  enabled: cloudEnabled,
  status: cloudEnabled ? "signed-out" : "off",
  email: null,
  lastSyncAt: null,
  error: null,
  choosing: false,
}));
