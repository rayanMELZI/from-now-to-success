"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Ban, Check, Search, Sprout, TimerReset, X } from "lucide-react";
import type { Habit } from "@/lib/types";

/** The little icon that says what kind of habit this is, at a glance. */
export function HabitIcon({ habit, size = 13 }: { habit: Habit; size?: number }) {
  if (habit.trackingMode === "TIMER")
    return <TimerReset size={size} className="shrink-0 text-sky-500" />;
  if (habit.habitType === "QUIT")
    return <Ban size={size} className="shrink-0 text-red-500" />;
  return <Sprout size={size} className="shrink-0 text-emerald-600" />;
}

interface HabitPickerProps {
  habits: Habit[];
  selectedIds: number[];
  onToggle: (habit: Habit) => void;
  /** Trailing badge for a row — "already planned", "unanswered today"… */
  meta?: (habit: Habit) => ReactNode;
  /** Draws a habit back without disabling it. */
  dimmed?: (habit: Habit) => boolean;
  /** Below this many habits the list is skipped for one-tap pills. */
  searchThreshold?: number;
  placeholder?: string;
  emptyLabel?: string;
  ariaLabel?: string;
}

/**
 * Pick habits out of a list that may be three long or three hundred.
 *
 * Short lists stay as pills you can hit in one tap. Past `searchThreshold`
 * the same list becomes a search box over a scrolling result list, with the
 * current picks pulled out as chips above it — because a wrapped block of
 * forty pills is a wall, not a control, and on a phone it pushed everything
 * else off the screen.
 */
export function HabitPicker({
  habits,
  selectedIds,
  onToggle,
  meta,
  dimmed,
  searchThreshold = 6,
  placeholder = "Search your habits…",
  emptyLabel,
  ariaLabel = "Habits",
}: HabitPickerProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => habits.filter((h) => selectedIds.includes(h.id)),
    [habits, selectedIds],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return habits;
    return habits.filter((h) => h.name.toLowerCase().includes(q));
  }, [habits, query]);

  // Keep the highlighted row in view as the arrows walk past the fold.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (habits.length === 0) {
    return emptyLabel ? <p className="text-xs text-ink-faint">{emptyLabel}</p> : null;
  }

  /* ---- short list: pills, exactly as fast as they were ---- */
  if (habits.length <= searchThreshold) {
    return (
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
        {habits.map((habit) => (
          <HabitPill
            key={habit.id}
            habit={habit}
            on={selectedIds.includes(habit.id)}
            dim={dimmed?.(habit) ?? false}
            meta={meta?.(habit)}
            onClick={() => onToggle(habit)}
          />
        ))}
      </div>
    );
  }

  /* ---- long list: search over a scrolling result list ---- */
  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((habit) => (
            <button
              key={habit.id}
              type="button"
              onClick={() => onToggle(habit)}
              aria-label={`Remove ${habit.name}`}
              className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink transition-opacity hover:opacity-80"
            >
              <HabitIcon habit={habit} size={11} />
              <span className="max-w-40 truncate">{habit.name}</span>
              <X size={11} />
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(matches.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              // Enter belongs to the list while it has a highlight; without
              // this it would submit the form the picker sits in.
              e.preventDefault();
              const habit = matches[active];
              if (habit) onToggle(habit);
            } else if (e.key === "Escape" && query) {
              e.preventDefault();
              setQuery("");
            }
          }}
          placeholder={placeholder}
          aria-label={`${ariaLabel} — type to filter`}
          className="field pl-9"
        />
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label={ariaLabel}
        aria-multiselectable
        className="mt-1.5 max-h-56 overflow-y-auto overscroll-contain rounded-lg border border-line"
      >
        {matches.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-ink-faint">
            No habit matches that.
          </p>
        ) : (
          matches.map((habit, index) => {
            const on = selectedIds.includes(habit.id);
            const dim = dimmed?.(habit) ?? false;
            return (
              <button
                key={habit.id}
                type="button"
                role="option"
                aria-selected={on}
                data-active={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => onToggle(habit)}
                className={`flex w-full items-center gap-2 border-b border-line px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 ${
                  index === active ? "bg-surface-sunken" : ""
                } ${dim && !on ? "opacity-50" : ""}`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    on ? "border-accent bg-accent text-white" : "border-line-strong"
                  }`}
                >
                  {on && <Check size={11} strokeWidth={3.5} />}
                </span>
                <HabitIcon habit={habit} />
                <span className="min-w-0 flex-1 truncate">{habit.name}</span>
                {meta?.(habit)}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** One tappable habit for the short-list case. */
function HabitPill({
  habit,
  on,
  dim,
  meta,
  onClick,
}: {
  habit: Habit;
  on: boolean;
  dim: boolean;
  meta: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
        on
          ? "border-accent bg-accent-soft text-accent-ink"
          : "border-line-strong text-ink-soft hover:border-ink-faint"
      } ${dim && !on ? "opacity-50" : ""}`}
    >
      {on ? <Check size={11} strokeWidth={3.5} /> : <HabitIcon habit={habit} size={11} />}
      <span className="max-w-44 truncate">{habit.name}</span>
      {meta}
    </button>
  );
}
