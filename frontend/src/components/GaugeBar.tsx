"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { DEMOTION_RATIO, gaugeRisk, riskNote } from "@/lib/types";

/**
 * The habit gauge: fills toward validation, drops on misses.
 * The small tick marks the demotion floor (60%) — a VALID habit that
 * sinks below it loses its validation. Once the fill is sitting on that
 * tick the bar stops being calm and green: it warms to amber one miss
 * earlier, then to rose when the next miss is the one that costs it.
 */
export function GaugeBar({
  gauge,
  max,
  valid,
  timer = false,
  className = "",
}: {
  gauge: number;
  max: number;
  valid: boolean;
  /** Timer habits fall all at once, so the near-the-floor warning is skipped. */
  timer?: boolean;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (gauge / max) * 100) : 0;
  const full = gauge >= max;
  const floorPct = DEMOTION_RATIO * 100;
  const risk = timer ? null : gaugeRisk(gauge, max, valid);

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      title={risk ? `${gauge}/${max} — ${riskNote[risk]}` : undefined}
    >
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-track">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            full
              ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
              : risk === "critical"
                ? "bg-gradient-to-r from-rose-400 to-rose-500"
                : risk === "caution"
                  ? "bg-gradient-to-r from-amber-400 to-orange-400"
                  : valid
                    ? "bg-gradient-to-r from-emerald-300 to-emerald-400"
                    : "bg-gradient-to-r from-amber-300 to-amber-500"
          }`}
          style={{ width: `${pct}%` }}
        />
        {/* demotion floor tick — drawn hard once the fill is nearly on it */}
        <div
          className={`absolute top-0 h-full ${
            risk === "critical"
              ? "w-0.5 bg-rose-700 dark:bg-rose-200"
              : risk === "caution"
                ? "w-0.5 bg-amber-700 dark:bg-amber-200"
                : "w-px bg-ink-faint/70"
          }`}
          style={{ left: `${floorPct}%` }}
        />
        {full && (
          <div className="pointer-events-none absolute inset-0 animate-pulse rounded-full bg-white/20" />
        )}
      </div>
      <span
        className={`flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums ${
          full
            ? "text-emerald-600 dark:text-emerald-400"
            : risk === "critical"
              ? "text-rose-600 dark:text-rose-400"
              : risk === "caution"
                ? "text-amber-700 dark:text-amber-400"
                : "text-ink-soft"
        }`}
      >
        {risk && <AlertTriangle size={11} />}
        {gauge}/{max}
        {full && <Sparkles size={11} className="text-emerald-500" />}
      </span>
    </div>
  );
}
