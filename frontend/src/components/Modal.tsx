"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/* "Are we on the client?" as an external store: server snapshot false,
 * client snapshot true — no setState-in-effect needed. */
const noopSubscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

/**
 * Bottom sheet on phones, centered dialog on larger screens.
 *
 * Rendered through a portal into <body>: an ancestor with backdrop-filter
 * (our sticky nav) becomes the containing block for fixed-position
 * descendants, which would otherwise size inset-0 to the header instead of
 * the viewport and clip the panel off-screen.
 */
export function Modal({
  open,
  onClose,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** "lg" gives a form room for two columns on a desktop. */
  size?: "md" | "lg";
  children: ReactNode;
}) {
  // Portals need a DOM target, which doesn't exist during SSR.
  const isClient = useIsClient();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* dvh keeps the sheet inside the visible area when mobile browser
          chrome shows/hides; the safe-area padding clears the home bar. */}
      <div
        className={`animate-sheet-in relative max-h-[85dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl sm:pb-5 ${
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
