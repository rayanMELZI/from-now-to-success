"use client";

import { useMemo, useState } from "react";
import { Flame, Lock, Search, Trophy } from "lucide-react";
import {
  formatDuration,
  habitRisk,
  scheduleLabel,
  type Habit,
  type HabitStatus,
} from "@/lib/types";
import { GaugeBar } from "./GaugeBar";
import { HabitIcon } from "./ui/HabitPicker";
import { RiskBadge } from "./ui/RiskBadge";

/**
 * The roadmap as a list.
 *
 * The island map shows how habits depend on each other, which is the point
 * of the roadmap — but on a phone it is a canvas you have to pinch, drag and
 * hunt around. This is the same habits as something you can scroll, search
 * and read, and it is what the Map/List switch flips to.
 */

const SECTIONS: { status: HabitStatus; label: string; hint: string }[] = [
  { status: "ACTIVE", label: "In progress", hint: "unlocked and waiting for you" },
  { status: "VALID", label: "Validated", hint: "these unlock what comes next" },
  { status: "LOCKED", label: "Locked", hint: "waiting on their prerequisites" },
];

export function HabitList({
  habits,
  selectedId,
  onSelect,
}: {
  habits: Habit[];
  selectedId: number | null;
  onSelect: (habit: Habit) => void;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return habits;
    return habits.filter((h) => h.name.toLowerCase().includes(q));
  }, [habits, query]);

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: matches.filter((h) => h.status === section.status),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="space-y-5">
      {habits.length > 6 && (
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your habits…"
            aria-label="Search your habits"
            className="field pl-9"
          />
        </div>
      )}

      {sections.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-faint">
          No habit matches that.
        </p>
      )}

      {sections.map((section) => (
        <section key={section.status}>
          <h2 className="mb-2 flex items-baseline gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {section.label}
            </span>
            <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink-soft">
              {section.items.length}
            </span>
            <span className="truncate text-xs text-ink-faint">{section.hint}</span>
          </h2>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {section.items.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                selected={habit.id === selectedId}
                onSelect={() => onSelect(habit)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function HabitCard({
  habit,
  selected,
  onSelect,
}: {
  habit: Habit;
  selected: boolean;
  onSelect: () => void;
}) {
  const timer = habit.trackingMode === "TIMER";
  const locked = habit.status === "LOCKED";
  const risk = habitRisk(habit);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`card w-full p-3.5 text-left transition-all hover:shadow-md ${
        selected
          ? "border-accent ring-2 ring-accent/25"
          : risk === "critical"
            ? "border-rose-300 ring-1 ring-rose-200/70 dark:border-rose-900 dark:ring-rose-900/50"
            : risk === "caution"
              ? "border-amber-300 dark:border-amber-900/80"
              : ""
      } ${locked ? "opacity-70" : ""}`}
    >
      <p className="flex items-center gap-1.5 font-medium">
        {locked ? (
          <Lock size={13} className="shrink-0 text-ink-faint" />
        ) : (
          <HabitIcon habit={habit} />
        )}
        <span className="truncate">{habit.name}</span>
        {risk && <RiskBadge risk={risk} className="ml-auto" />}
      </p>

      <div className="mt-2">
        <GaugeBar
          gauge={habit.gauge}
          max={habit.requiredStreak}
          valid={habit.status === "VALID"}
          timer={timer}
        />
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
        {timer ? (
          <>
            <span className="flex items-center gap-1">
              <Trophy size={12} className="text-amber-500" />
              {habit.bestCleanSeconds > 0
                ? formatDuration(habit.bestCleanSeconds)
                : "no run yet"}
            </span>
            <span>goal {formatDuration(habit.goalSeconds ?? 0)}</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <Flame size={12} className="text-orange-500" />
              {habit.currentStreak}
            </span>
            <span>
              {scheduleLabel[habit.schedule]}
              {habit.schedule !== "DAILY" && ` · ${habit.timesPerPeriod}×`}
            </span>
          </>
        )}
        <span>{habit.basePoints} pts</span>
      </p>
    </button>
  );
}
