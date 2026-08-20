"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A section that folds away.
 *
 * The app shows a lot at once — timers, answered habits, the advanced half
 * of the habit form — and most of it is not what you came for. Everything
 * optional lives behind one of these, with a `summary` so folding it never
 * hides what it says.
 *
 * `storageKey` remembers the state per browser; without one the section
 * simply reopens at `defaultOpen` next time.
 */
export function Disclosure({
  title,
  icon,
  count,
  summary,
  defaultOpen = false,
  storageKey,
  tone = "plain",
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  count?: number;
  summary?: ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  tone?: "plain" | "card";
  children: ReactNode;
}) {
  // Lazy init reads localStorage during the first render instead of in an
  // effect, so the section never flashes shut before opening.
  const [open, setOpen] = useState(() => {
    if (!storageKey || typeof window === "undefined") return defaultOpen;
    const saved = localStorage.getItem(`disclosure:${storageKey}`);
    return saved === null ? defaultOpen : saved === "1";
  });
  const panelId = useId();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (storageKey) localStorage.setItem(`disclosure:${storageKey}`, next ? "1" : "0");
  }

  return (
    <section className={tone === "card" ? "card overflow-hidden" : ""}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full items-center gap-2 text-left transition-colors ${
          tone === "card"
            ? "px-4 py-3 hover:bg-surface-sunken"
            : "rounded-lg py-1.5 hover:text-ink"
        }`}
      >
        <ChevronDown
          size={16}
          className={`shrink-0 text-ink-faint transition-transform duration-200 ${
            open ? "" : "-rotate-90"
          }`}
        />
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {title}
        </span>
        {count !== undefined && (
          <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink-soft">
            {count}
          </span>
        )}
        {/* the one-line stand-in for what is folded away */}
        {!open && summary && (
          <span className="ml-auto truncate text-xs text-ink-faint">{summary}</span>
        )}
      </button>

      {open && (
        <div id={panelId} className={tone === "card" ? "px-4 pb-4" : "pt-2"}>
          {children}
        </div>
      )}
    </section>
  );
}
