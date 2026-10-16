"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/** Open dialogs, top-most last; only the top one handles Esc/Tab. */
const stack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** "center" modal, or "sheet": right panel on desktop / bottom sheet on mobile. */
  variant?: "center" | "sheet";
  className?: string;
}

/** Accessible modal: focus trap, Esc to close, focus restore, labelled by its title. */
export function Dialog({ open, onClose, title, description, children, footer, variant = "center", className }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const me = Symbol("dialog");
    stack.push(me);
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = panel.current;
      if (!el) return;
      const auto = el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>(FOCUSABLE);
      (auto ?? el).focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === "Tab" && panel.current) {
        const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      stack.splice(stack.indexOf(me), 1);
      document.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [open]);

  // Portal to <body> so transformed ancestors (page transitions) can't trap position: fixed.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const sheet = variant === "sheet";
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn("fixed inset-0 z-50 flex", sheet ? "items-end sm:items-stretch sm:justify-end" : "items-center justify-center p-4")}>
          <motion.div
            className="absolute inset-0 bg-[rgb(20_14_40/0.35)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col border border-line/70 bg-surface shadow-float outline-none",
              sheet
                ? "rounded-t-3xl sm:m-3 sm:max-h-none sm:w-[420px] sm:rounded-3xl"
                : "max-w-md rounded-3xl",
              className,
            )}
            initial={sheet ? { y: 40, opacity: 0 } : { scale: 0.96, opacity: 0, y: 8 }}
            animate={{ y: 0, x: 0, scale: 1, opacity: 1 }}
            exit={sheet ? { y: 40, opacity: 0 } : { scale: 0.97, opacity: 0, y: 4 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
              <div>
                <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-sm text-muted">
                    {description}
                  </p>
                )}
              </div>
              <button className="btn-ghost -mr-2 -mt-1 h-9 w-9 p-0" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-2">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line/60 px-6 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "default";
  onConfirm(): void;
  onClose(): void;
}

export function ConfirmDialog({ open, title, description, confirmLabel = "Confirm", tone = "danger", onConfirm, onClose }: ConfirmProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} data-autofocus>
            Cancel
          </button>
          <button
            className={tone === "danger" ? "btn-danger" : "btn-primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-muted">{description}</div>
    </Dialog>
  );
}
