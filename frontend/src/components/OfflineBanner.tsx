"use client";

import { AlertCircle, CloudOff, RefreshCw, X } from "lucide-react";
import { useOnline } from "@/lib/offline";
import { clearRejection, usePendingCount, useRejection } from "@/lib/outbox";

/**
 * The one bit of chrome that says "what you're looking at may be old" — and,
 * now that answers survive being offline, what is still on its way.
 *
 * Sits above the nav inside the sticky header stack, so it stays visible for
 * as long as there is something to say.
 */
export function OfflineBanner() {
  const online = useOnline();
  const waiting = usePendingCount();
  const rejected = useRejection();

  // A refusal is the only thing worth interrupting an otherwise fine session
  // for, so it wins the bar and is the only state the user can dismiss.
  if (rejected) {
    const plural = rejected.count === 1 ? "check-in" : "check-ins";
    return (
      <Bar tone="alert">
        <AlertCircle size={14} className="shrink-0" />
        <span className="min-w-0 truncate">
          {rejected.count} {plural} from {rejected.forDate} couldn&apos;t be saved —{" "}
          {rejected.message}
        </span>
        <button
          type="button"
          onClick={clearRejection}
          aria-label="Dismiss"
          className="-m-1 shrink-0 p-1 opacity-80 hover:opacity-100"
        >
          <X size={14} />
        </button>
      </Bar>
    );
  }

  if (online) {
    if (waiting === 0) return null;
    return (
      <Bar tone="muted">
        <RefreshCw size={14} className="shrink-0 animate-spin" />
        <span>
          Syncing {waiting} {waiting === 1 ? "check-in" : "check-ins"}…
        </span>
      </Bar>
    );
  }

  return (
    <Bar tone="muted">
      <CloudOff size={14} className="shrink-0" />
      {waiting === 0 ? (
        <>
          {/* the short form keeps the bar to one line on a phone */}
          <span className="sm:hidden">Offline — showing saved data</span>
          <span className="hidden sm:inline">
            Offline — showing saved data. Check-ins you make now will be saved.
          </span>
        </>
      ) : (
        <>
          <span className="sm:hidden">
            Offline — {waiting} saved, will sync
          </span>
          <span className="hidden sm:inline">
            Offline — {waiting} {waiting === 1 ? "check-in" : "check-ins"} saved
            here, {waiting === 1 ? "it syncs" : "they sync"} when you&apos;re back.
          </span>
        </>
      )}
    </Bar>
  );
}

function Bar({
  tone,
  children,
}: {
  tone: "muted" | "alert";
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium ${
        tone === "alert"
          ? "bg-red-800 text-red-50 dark:bg-red-900"
          : "bg-stone-800 text-stone-100 dark:bg-stone-700"
      }`}
    >
      {children}
    </div>
  );
}
