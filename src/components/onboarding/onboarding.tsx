"use client";

import { useApp } from "@/store/app-store";

/** Temporary single-step onboarding; replaced by the full flow in a later phase. */
export function Onboarding() {
  const complete = useApp((s) => s.completeOnboarding);
  const appearance = useApp((s) => s.profile.appearance);
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="card max-w-sm p-8 text-center">
        <h1 className="font-pixel text-3xl">Welcome to Driftsync</h1>
        <button
          className="btn-primary mt-6"
          onClick={() =>
            complete({ characterName: "Pip", islandName: "Driftsync", appearance, areaTypes: ["gym", "study", "library", "track"] })
          }
        >
          Start
        </button>
      </div>
    </div>
  );
}
