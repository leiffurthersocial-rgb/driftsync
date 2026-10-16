"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useUi } from "@/store/ui-store";
import { cn } from "@/lib/cn";

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            className={cn(
              "pointer-events-auto flex items-center gap-3 rounded-2xl border border-line/70 bg-surface px-4 py-2.5 text-sm shadow-float",
              t.tone === "danger" && "border-danger/40",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                t.tone === "success" ? "bg-sage" : t.tone === "danger" ? "bg-danger" : "bg-accent",
              )}
              aria-hidden
            />
            <span>{t.message}</span>
            {t.action && (
              <button
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
