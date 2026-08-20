"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type Tone = "success" | "warning" | "neutral";

const TONES: Record<Tone, string> = {
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  warning:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  neutral: "border-line bg-surface text-ink",
};

/**
 * The answer to "what did that do?", floating clear of the page.
 *
 * Check-in results used to be a banner at the top of the document: every
 * answer pushed the whole list down a few hundred pixels, so the row you
 * were about to tap moved out from under your thumb. This sits above the
 * content instead — bottom of the screen on a phone, bottom-right on a
 * desktop — and lets go on its own.
 */
export function Toast({
  open,
  tone = "neutral",
  onClose,
  autoCloseMs = 6000,
  children,
}: {
  open: boolean;
  tone?: Tone;
  onClose: () => void;
  autoCloseMs?: number;
  children: ReactNode;
}) {
  // The callback is nearly always an inline arrow, so it is a new function on
  // every render of the page. Depending on it directly would restart the
  // countdown each time — and the check-in page re-renders once a second
  // while a timer habit is on screen, so the toast would never close itself.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open || autoCloseMs <= 0) return;
    const id = setTimeout(() => closeRef.current(), autoCloseMs);
    return () => clearTimeout(id);
  }, [open, autoCloseMs]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      /* bottom-20 clears the mobile tab bar; sm:bottom-6 drops it back down */
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:justify-end sm:px-0"
    >
      <div
        className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3.5 shadow-lg ${TONES[tone]}`}
      >
        <div className="min-w-0 flex-1 text-sm">{children}</div>
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="-m-1 shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
