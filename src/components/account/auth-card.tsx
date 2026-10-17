import type { ReactNode } from "react";
import { Logo } from "@/components/shell/logo";

/** The centered card used by sign-in pages, matching onboarding. */
export function AuthCard({ title, children, label }: { title: string; children: ReactNode; label: string }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10" aria-label={label}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute -bottom-32 right-[-6rem] h-96 w-96 rounded-full bg-peach/15 blur-3xl" />
      </div>
      <section className="card relative w-full max-w-md p-6">
        <Logo />
        <h1 className="mt-6 font-pixel text-3xl leading-tight">{title}</h1>
        <div className="mt-3">{children}</div>
      </section>
    </main>
  );
}
