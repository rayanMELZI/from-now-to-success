"use client";

import { useId, useState, type FormEvent } from "react";
import {
  GOAL_PRESETS,
  formatDuration,
  type Habit,
  type HabitRequest,
  type HabitSchedule,
  type HabitType,
  type TrackingMode,
} from "@/lib/types";
import { Ban, CalendarCheck, ChevronDown, Sprout, TimerReset } from "lucide-react";
import { Segmented } from "./ui/Segmented";
import { HabitPicker } from "./ui/HabitPicker";

const DAY_SECONDS = 86400;

/** What a habit gets when you say nothing — see the advanced section. */
const DEFAULT_POINTS = 10;
const DEFAULT_STREAK = 7;

function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
  label: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(clamp(value - 1))}
        className="h-10 w-10 rounded-lg border border-line-strong text-lg leading-none text-ink-soft transition-colors hover:bg-surface-sunken active:scale-95"
      >
        −
      </button>
      <div
        aria-live="polite"
        className="flex h-10 min-w-16 items-center justify-center rounded-lg bg-surface-sunken px-2 text-sm font-semibold tabular-nums"
      >
        {value}
        {suffix && <span className="ml-1 font-normal text-ink-soft">{suffix}</span>}
      </div>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(clamp(value + 1))}
        className="h-10 w-10 rounded-lg border border-line-strong text-lg leading-none text-ink-soft transition-colors hover:bg-surface-sunken active:scale-95"
      >
        +
      </button>
    </div>
  );
}

/* ---------- the form ---------- */

interface HabitFormProps {
  allHabits: Habit[];
  initial?: Habit;
  onSubmit: (request: HabitRequest) => Promise<void>;
  onCancel: () => void;
}

/**
 * Creating a habit asks four questions — what, how it is tracked, build or
 * quit, and how often. Everything else (points, how long validation takes,
 * notes, prerequisites) has a sensible default and lives behind "Advanced",
 * so the common case is a name and two taps.
 */
export function HabitForm({ allHabits, initial, onSubmit, onCancel }: HabitFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [basePoints, setBasePoints] = useState(initial?.basePoints ?? DEFAULT_POINTS);
  const [requiredStreak, setRequiredStreak] = useState(
    initial?.requiredStreak ?? DEFAULT_STREAK,
  );
  const [schedule, setSchedule] = useState<HabitSchedule>(initial?.schedule ?? "DAILY");
  const [habitType, setHabitType] = useState<HabitType>(initial?.habitType ?? "BUILD");
  const [timesPerPeriod, setTimesPerPeriod] = useState(initial?.timesPerPeriod ?? 1);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>(
    initial?.trackingMode ?? "SCHEDULED",
  );
  const [goalSeconds, setGoalSeconds] = useState(initial?.goalSeconds ?? 30 * DAY_SECONDS);
  const [prereqIds, setPrereqIds] = useState<number[]>(initial?.prerequisiteIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Editing a timer habit opens the panel, because the tracking switch lives
  // in there and it is what makes the rest of the form look the way it does.
  const [advancedOpen, setAdvancedOpen] = useState(
    initial !== undefined &&
      (initial.trackingMode === "TIMER" || (initial.description ?? "") !== ""),
  );
  const trackingFieldId = useId();
  const notesFieldId = useId();

  const candidates = allHabits.filter((h) => h.id !== initial?.id);
  const periodNoun = schedule === "WEEKLY" ? "week" : "month";
  const streakNoun =
    schedule === "DAILY" ? "days" : schedule === "WEEKLY" ? "weeks" : "months";
  const timer = trackingMode === "TIMER";
  const goalDays = Math.max(1, Math.round(goalSeconds / DAY_SECONDS));

  function togglePrereq(id: number) {
    setPrereqIds((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name,
        description: description || undefined,
        basePoints,
        trackingMode,
        prerequisiteIds: prereqIds,
        // A timer is always about staying away from something, and its gauge
        // is the milestone ladder — the server sizes it from the goal.
        ...(timer
          ? { habitType: "QUIT" as const, goalSeconds }
          : {
              habitType,
              requiredStreak,
              schedule,
              timesPerPeriod: schedule === "DAILY" ? 1 : timesPerPeriod,
            }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">{initial ? "Edit habit" : "New habit"}</h2>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <label className="block space-y-1">
        <span className="field-label">Habit name</span>
        <input
          required
          autoFocus
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field py-2.5 text-base"
          placeholder={
            timer
              ? "e.g. smoking"
              : habitType === "QUIT"
                ? "e.g. doomscrolling at night"
                : "e.g. 5 prayers"
          }
        />
      </label>

      {/* Goal, and the way into the rest of the settings, on one line. */}
      <div className="flex items-end gap-3">
        {!timer && (
          <div className="min-w-0 flex-1 space-y-1">
            <span className="field-label">Goal</span>
            <Segmented
              value={habitType}
              onChange={setHabitType}
              ariaLabel="Build this habit or quit it"
              options={[
                {
                  value: "BUILD",
                  label: (
                    <span className="flex items-center justify-center gap-1.5">
                      <Sprout size={14} className="text-emerald-600" />
                      Build it
                    </span>
                  ),
                },
                {
                  value: "QUIT",
                  label: (
                    <span className="flex items-center justify-center gap-1.5">
                      <Ban size={14} className="text-red-500" />
                      Quit it
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
          aria-controls={`${trackingFieldId} ${notesFieldId}`}
          className={`btn btn-sm shrink-0 border font-medium ${timer ? "flex-1" : ""} ${
            advancedOpen
              ? "border-accent bg-accent-soft text-accent-ink"
              : "border-line-strong text-ink-soft hover:bg-surface-sunken"
          }`}
        >
          <ChevronDown
            size={15}
            className={`transition-transform duration-200 ${advancedOpen ? "" : "-rotate-90"}`}
          />
          Advanced
        </button>
      </div>

      {/* Revealed in place by the Advanced button above, rather than in a
          panel of its own — the order of the form never changes, fields only
          appear and disappear between the ones that are always there. */}
      {advancedOpen && (
        <div id={trackingFieldId} className="space-y-1">
          <span className="field-label">Tracking</span>
          <Segmented
            value={trackingMode}
            onChange={setTrackingMode}
            ariaLabel="How this habit is tracked"
            options={[
              {
                value: "SCHEDULED",
                label: (
                  <span className="flex items-center justify-center gap-1.5">
                    <CalendarCheck size={14} className="text-accent" />
                    Check-in
                  </span>
                ),
              },
              {
                value: "TIMER",
                label: (
                  <span className="flex items-center justify-center gap-1.5">
                    <TimerReset size={14} className="text-sky-500" />
                    Timer
                  </span>
                ),
              },
            ]}
          />
          <p className="text-xs text-ink-faint">
            Almost every habit is a check-in. A timer is the rarer kind: one clock
            that runs until you slip, instead of a daily question.
          </p>
        </div>
      )}

      {timer && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-400/10 dark:text-sky-300">
          A clock that runs until you slip and reset it. No daily question — you just
          try to make each run longer than the last.
        </p>
      )}

      {timer ? (
        <div className="space-y-1.5">
          <span className="field-label">Stay clean for</span>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset.seconds}
                type="button"
                onClick={() => setGoalSeconds(preset.seconds)}
                aria-pressed={goalSeconds === preset.seconds}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  goalSeconds === preset.seconds
                    ? "border-sky-500 bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200"
                    : "border-line-strong text-ink-soft hover:border-ink-faint"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2 dark:bg-sky-400/10">
            <span className="text-sm text-ink-soft">Days</span>
            <Stepper
              label="days clean"
              value={goalDays}
              min={1}
              max={1825}
              onChange={(days) => setGoalSeconds(days * DAY_SECONDS)}
            />
          </div>
          <p className="text-xs text-ink-faint">
            Reaching {formatDuration(goalSeconds)} clean validates the habit. Shorter
            milestones along the way (a day, a week, a month…) pay points as you pass
            them.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <span className="field-label">Rhythm</span>
          <Segmented
            value={schedule}
            onChange={setSchedule}
            ariaLabel="How often this habit comes round"
            options={[
              { value: "DAILY", label: "Daily" },
              { value: "WEEKLY", label: "Weekly" },
              { value: "MONTHLY", label: "Monthly" },
            ]}
          />
          {schedule !== "DAILY" && (
            <div className="flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2">
              <span className="text-sm text-ink-soft">Times per {periodNoun}</span>
              <Stepper
                label={`times per ${periodNoun}`}
                value={timesPerPeriod}
                min={1}
                max={30}
                onChange={setTimesPerPeriod}
                suffix="×"
              />
            </div>
          )}
        </div>
      )}

      {/* Points and the length of the run are part of deciding what the
          habit IS, so they stay in plain sight — only the things you can
          leave alone entirely go behind the fold. */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="space-y-1">
          <span className="field-label">
            Points {timer ? "per milestone" : "per check-in"}
          </span>
          <Stepper
            label="points"
            value={basePoints}
            min={1}
            max={100}
            onChange={setBasePoints}
          />
        </div>
        {!timer && (
          <div className="space-y-1">
            <span className="field-label">{streakNoun} to validate</span>
            <Stepper
              label={`${streakNoun} to validate`}
              value={requiredStreak}
              min={2}
              max={90}
              onChange={setRequiredStreak}
            />
          </div>
        )}
      </div>

      {advancedOpen && (
        <label id={notesFieldId} className="block space-y-1">
          <span className="field-label">Notes (optional)</span>
          <textarea
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="field"
            placeholder="Why this habit matters to you…"
          />
        </label>
      )}

      {/* The roadmap IS the prerequisites — this is what makes a habit part
          of a path instead of a lone item on a list, so it stays up front. */}
      {candidates.length > 0 && (
        <div className="space-y-1.5">
          <span className="field-label">Unlocks after (prerequisites)</span>
          <p className="text-xs text-ink-faint">
            This habit stays locked until every habit you pick here is valid.
          </p>
          <HabitPicker
            habits={candidates}
            selectedIds={prereqIds}
            onToggle={(habit) => togglePrereq(habit.id)}
            ariaLabel="Prerequisite habits"
            placeholder="Search habits to require first…"
          />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button disabled={busy} className="btn btn-primary flex-1">
          {busy ? "Saving…" : initial ? "Save changes" : "Add to roadmap"}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
