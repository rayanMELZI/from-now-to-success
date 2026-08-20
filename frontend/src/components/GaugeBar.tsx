"use client";

import { Sparkles } from "lucide-react";

/**
 * The habit gauge: fills toward validation, drops on misses.
 * The small tick marks the demotion floor (60%) — a VALID habit that
 * sinks below it loses its validation.
 */
export function GaugeBar({
  gauge,
  max,
  valid,
  className = "",
}: {
  gauge: number;
  max: number;
  valid: boolean;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (gauge / max) * 100) : 0;
  const full = gauge >= max;
  const floorPct = 60;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-track">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            full
              ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
              : valid
                ? "bg-gradient-to-r from-emerald-300 to-emerald-400"
                : "bg-gradient-to-r from-amber-300 to-amber-500"
          }`}
          style={{ width: `${pct}%` }}
        />
        {/* demotion floor tick */}
        <div
          className="absolute top-0 h-full w-px bg-ink-faint/70"
          style={{ left: `${floorPct}%` }}
        />
        {full && (
          <div className="pointer-events-none absolute inset-0 animate-pulse rounded-full bg-white/20" />
        )}
      </div>
      <span
        className={`shrink-0 text-xs font-medium tabular-nums ${
          full ? "text-emerald-600 dark:text-emerald-400" : "text-ink-soft"
        }`}
      >
        {gauge}/{max}
        {full && <Sparkles size={11} className="ml-0.5 inline text-emerald-500" />}
      </span>
    </div>
  );
}
