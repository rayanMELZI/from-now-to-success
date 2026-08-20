import { AlertTriangle } from "lucide-react";
import { riskLabel, riskNote, type RiskLevel } from "@/lib/types";

/**
 * The chip that marks a validated habit drifting back towards the demotion
 * floor. It always carries the word and the icon, never just the colour —
 * this is the one state the user has to notice before it is too late.
 */
export function RiskBadge({
  risk,
  className = "",
}: {
  risk: RiskLevel;
  className?: string;
}) {
  return (
    <span
      title={riskNote[risk]}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        risk === "critical"
          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300"
      } ${className}`}
    >
      <AlertTriangle size={11} />
      {riskLabel[risk]}
    </span>
  );
}
