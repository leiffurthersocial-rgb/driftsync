"use client";

import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  tone?: "default" | "success" | "danger";
  action?: { label: string; run: () => void };
}

interface UiState {
  paletteOpen: boolean;
  setPaletteOpen(open: boolean): void;

  /** Island selection & panels. */
  selectedAreaId: string | null;
  selectArea(id: string | null): void;
  characterCardOpen: boolean;
  setCharacterCardOpen(open: boolean): void;
  addAreaOpen: boolean;
  setAddAreaOpen(open: boolean): void;

  toasts: Toast[];
  toast(message: string, opts?: Omit<Toast, "id" | "message">): void;
  dismissToast(id: number): void;
}

let toastId = 0;

export const useUi = create<UiState>()((set, get) => ({
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  selectedAreaId: null,
  selectArea: (selectedAreaId) => set({ selectedAreaId, characterCardOpen: false }),
  characterCardOpen: false,
  setCharacterCardOpen: (characterCardOpen) => set({ characterCardOpen, selectedAreaId: null }),
  addAreaOpen: false,
  setAddAreaOpen: (addAreaOpen) => set({ addAreaOpen }),

  toasts: [],
  toast(message, opts = {}) {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, ...opts }] }));
    setTimeout(() => get().dismissToast(id), opts.action ? 6000 : 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, opts?: Omit<Toast, "id" | "message">) => useUi.getState().toast(message, opts);
