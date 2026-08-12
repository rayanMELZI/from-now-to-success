"use client";

import { CloudOff } from "lucide-react";
import { useOnline } from "@/lib/offline";

/**
 * The one bit of chrome that says "what you're looking at may be old".
 * Sits above the nav inside the sticky header stack, so it stays visible for
 * as long as the connection is gone.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-stone-800 px-4 py-1.5 text-center text-xs font-medium text-stone-100 dark:bg-stone-700"
    >
      <CloudOff size={14} className="shrink-0" />
      {/* the short form keeps the bar to one line on a phone */}
      <span className="sm:hidden">Offline — showing saved data</span>
      <span className="hidden sm:inline">
        Offline — showing saved data. New changes won&apos;t be saved yet.
      </span>
    </div>
  );
}
