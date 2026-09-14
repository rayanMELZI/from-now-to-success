"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Ban, Check, Eye, EyeOff, Search, Sprout, TimerReset, X } from "lucide-react";
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
  /**
   * Habits the user set aside: still pickable, but greyed and listed after
   * the rest. Needs `onToggleMuted` to draw the eye that flips it.
   */
  muted?: (habit: Habit) => boolean;
  onToggleMuted?: (habit: Habit) => void;
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
  muted,
  onToggleMuted,
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

  // Set-aside habits sink to the bottom but keep their order among themselves,
  // so the ones the user reaches for stay where they expect them.
  const ordered = useMemo(() => {
    if (!muted) return habits;
    return [...habits.filter((h) => !muted(h)), ...habits.filter((h) => muted(h))];
  }, [habits, muted]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((h) => h.name.toLowerCase().includes(q));
  }, [ordered, query]);

  const isMuted = (habit: Habit) => muted?.(habit) ?? false;

  /** The eye that sets a habit aside or brings it back. */
  const muteControl = (habit: Habit, className: string) =>
    onToggleMuted && muted ? (
      <button
        type="button"
        onClick={() => onToggleMuted(habit)}
        aria-pressed={isMuted(habit)}
        aria-label={
          isMuted(habit)
            ? `Bring ${habit.name} back up the list`
            : `Set ${habit.name} aside at the bottom of the list`
        }
        title={isMuted(habit) ? "Bring it back up the list" : "Set aside at the bottom"}
        className={`flex shrink-0 items-center justify-center text-ink-faint transition-opacity hover:text-ink ${
          isMuted(habit) ? "" : "opacity-40 hover:opacity-100"
        } ${className}`}
      >
        {isMuted(habit) ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    ) : null;

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
        {ordered.map((habit) => (
          <HabitPill
            key={habit.id}
            habit={habit}
            on={selectedIds.includes(habit.id)}
            dim={(dimmed?.(habit) ?? false) || isMuted(habit)}
            meta={meta?.(habit)}
            onClick={() => onToggle(habit)}
            control={muteControl(habit, "rounded-r-full px-2")}
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
            const aside = isMuted(habit);
            const dim = (dimmed?.(habit) ?? false) || aside;
            // The first set-aside row opens the "set aside" tail of the list.
            const firstAside = aside && index > 0 && !isMuted(matches[index - 1]);
            const control = muteControl(habit, "self-stretch px-3");
            return (
              <div
                key={habit.id}
                data-active={index === active}
                onMouseEnter={() => setActive(index)}
                className={`flex items-stretch border-b border-line transition-colors last:border-b-0 ${
                  index === active ? "bg-surface-sunken" : ""
                } ${firstAside ? "border-t border-t-line-strong" : ""}`}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => onToggle(habit)}
                  className={`flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3 text-left text-sm ${
                    control ? "pr-1" : "pr-3"
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
                {control}
              </div>
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
  control,
}: {
  habit: Habit;
  on: boolean;
  dim: boolean;
  meta: ReactNode;
  onClick: () => void;
  /** A second button docked to the pill's right edge — the set-aside eye. */
  control?: ReactNode;
}) {
  const pill = (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1.5 py-1.5 pl-3 text-xs font-medium transition-all ${
        control ? "pr-2" : "rounded-full border pr-3"
      } ${
        on
          ? control
            ? "text-accent-ink"
            : "border-accent bg-accent-soft text-accent-ink"
          : control
            ? "text-ink-soft"
            : "border-line-strong text-ink-soft hover:border-ink-faint"
      } ${dim && !on ? "opacity-50" : ""}`}
    >
      {on ? <Check size={11} strokeWidth={3.5} /> : <HabitIcon habit={habit} size={11} />}
      <span className="max-w-44 truncate">{habit.name}</span>
      {meta}
    </button>
  );
  if (!control) return pill;
  return (
    <span
      className={`flex items-stretch rounded-full border transition-colors ${
        on ? "border-accent bg-accent-soft" : "border-line-strong hover:border-ink-faint"
      }`}
    >
      {pill}
      {control}
    </span>
  );
}
