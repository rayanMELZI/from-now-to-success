"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Bottom sheet on phones, centered dialog on larger screens.
 */
export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
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

  if (!open) return null;

  return (
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
      <div className="animate-sheet-in relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white dark:bg-stone-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-2xl sm:pb-5">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300 sm:hidden" />
        {children}
      </div>
    </div>
  );
}
