"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  GOAL_PRESETS,
  formatDuration,
  type Habit,
  type HabitRequest,
  type HabitSchedule,
  type HabitType,
  type TrackingMode,
} from "@/lib/types";
import { Ban, CalendarCheck, Replace, Sprout, TimerReset } from "lucide-react";

const DAY_SECONDS = 86400;

/* ---------- small polished controls ---------- */

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-stone-100 dark:bg-stone-800 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-all ${
            value === option.value
              ? "bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 shadow-sm"
              : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:text-stone-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        className="h-9 w-9 rounded-lg border border-stone-300 dark:border-stone-700 text-lg leading-none text-stone-600 dark:text-stone-300 transition-colors hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95"
      >
        −
      </button>
      <div className="flex h-9 min-w-16 items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-800 px-2 text-sm font-semibold tabular-nums">
        {value}
        {suffix && <span className="ml-1 font-normal text-stone-500 dark:text-stone-400">{suffix}</span>}
      </div>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        className="h-9 w-9 rounded-lg border border-stone-300 dark:border-stone-700 text-lg leading-none text-stone-600 dark:text-stone-300 transition-colors hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95"
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

export function HabitForm({ allHabits, initial, onSubmit, onCancel }: HabitFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [basePoints, setBasePoints] = useState(initial?.basePoints ?? 10);
  const [requiredStreak, setRequiredStreak] = useState(initial?.requiredStreak ?? 7);
  const [schedule, setSchedule] = useState<HabitSchedule>(initial?.schedule ?? "DAILY");
  const [habitType, setHabitType] = useState<HabitType>(initial?.habitType ?? "BUILD");
  const [timesPerPeriod, setTimesPerPeriod] = useState(initial?.timesPerPeriod ?? 1);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>(
    initial?.trackingMode ?? "SCHEDULED",
  );
  const [goalSeconds, setGoalSeconds] = useState(
    initial?.goalSeconds ?? 30 * DAY_SECONDS,
  );
  const [prereqIds, setPrereqIds] = useState<number[]>(initial?.prerequisiteIds ?? []);
  const [replacementId, setReplacementId] = useState<number | null>(
    initial?.replacementHabitId ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const candidates = allHabits.filter((h) => h.id !== initial?.id);
  const periodNoun = schedule === "WEEKLY" ? "week" : "month";
  const streakNoun =
    schedule === "DAILY" ? "days" : schedule === "WEEKLY" ? "weeks" : "months";
  const timer = trackingMode === "TIMER";
  const goalDays = Math.max(1, Math.round(goalSeconds / DAY_SECONDS));
  // A timer habit is always about quitting something, so it can be paired too.
  const quitting = timer || habitType === "QUIT";
  const replacements = candidates.filter((h) => h.habitType === "BUILD");

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
        // Only a habit you are quitting can be replaced by another.
        replacementHabitId: quitting ? replacementId : null,
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
      <h2 className="font-semibold">{initial ? "Edit habit" : "New habit"}</h2>

      {error && (
        <p className="rounded-md bg-red-50 dark:bg-red-950/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}

      <label className="block">
        <input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-2.5 text-base focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
          placeholder={
            timer
              ? "e.g. smoking"
              : habitType === "QUIT"
                ? "e.g. doomscrolling at night"
                : "e.g. 5 prayers"
          }
        />
      </label>

      <div className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
          Tracking
        </span>
        <Segmented
          value={trackingMode}
          onChange={setTrackingMode}
          options={[
            { value: "SCHEDULED", label: <span className="flex items-center justify-center gap-1.5"><CalendarCheck size={14} className="text-amber-600" />Check-in</span> },
            { value: "TIMER", label: <span className="flex items-center justify-center gap-1.5"><TimerReset size={14} className="text-sky-500" />Timer</span> },
          ]}
        />
        {timer && (
          <p className="text-xs text-stone-500 dark:text-stone-400">
            A clock that runs until you slip and reset it. No daily question — you
            just try to make each run longer than the last.
          </p>
        )}
      </div>

      {!timer && (
        <div className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Goal
          </span>
          <Segmented
            value={habitType}
            onChange={setHabitType}
            options={[
              { value: "BUILD", label: <span className="flex items-center justify-center gap-1.5"><Sprout size={14} className="text-emerald-600" />Build it</span> },
              { value: "QUIT", label: <span className="flex items-center justify-center gap-1.5"><Ban size={14} className="text-red-500" />Quit it</span> },
            ]}
          />
        </div>
      )}

      {timer ? (
        <div className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Stay clean for
          </span>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset.seconds}
                type="button"
                onClick={() => setGoalSeconds(preset.seconds)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  goalSeconds === preset.seconds
                    ? "border-sky-500 bg-sky-100 dark:bg-sky-400/15 text-sky-900 dark:text-sky-200"
                    : "border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-400"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-sky-50 dark:bg-sky-400/10 px-3 py-2">
            <span className="text-sm text-stone-600 dark:text-stone-300">Days</span>
            <Stepper
              value={goalDays}
              min={1}
              max={1825}
              onChange={(days) => setGoalSeconds(days * DAY_SECONDS)}
            />
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Reaching {formatDuration(goalSeconds)} clean validates the habit. Shorter
            milestones along the way (a day, a week, a month…) pay points as you pass
            them.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Rhythm
          </span>
          <Segmented
            value={schedule}
            onChange={setSchedule}
            options={[
              { value: "DAILY", label: "Daily" },
              { value: "WEEKLY", label: "Weekly" },
              { value: "MONTHLY", label: "Monthly" },
            ]}
          />
          {schedule !== "DAILY" && (
            <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-400/10 px-3 py-2">
              <span className="text-sm text-stone-600 dark:text-stone-300">Times per {periodNoun}</span>
              <Stepper
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

      {quitting && (
        <div className="space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
            <Replace size={13} className="text-emerald-600" />
            Do this instead (optional)
          </span>
          {replacements.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Add a habit you are building first, then come back and pair it with
              this one.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {replacements.map((habit) => {
                  const on = replacementId === habit.id;
                  return (
                    <button
                      key={habit.id}
                      type="button"
                      onClick={() => setReplacementId(on ? null : habit.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                        on
                          ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-400/15 text-emerald-900 dark:text-emerald-200"
                          : "border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-400"
                      }`}
                    >
                      {on ? "✓ " : ""}
                      {habit.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Quitting is easier when something fills the gap. Avoid this habit
                and do its replacement on the same day for a bonus.
              </p>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Points
          </span>
          <Stepper value={basePoints} min={1} max={100} onChange={setBasePoints} />
        </div>
        {!timer && (
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
              {streakNoun} to validate
            </span>
            <Stepper value={requiredStreak} min={2} max={90} onChange={setRequiredStreak} />
          </div>
        )}
      </div>

      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
          Notes (optional)
        </span>
        <textarea
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
          placeholder="Why this habit matters to you…"
        />
      </label>

      {candidates.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Unlocks after (prerequisites)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {candidates.map((habit) => {
              const on = prereqIds.includes(habit.id);
              return (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => togglePrereq(habit.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    on
                      ? "border-amber-500 bg-amber-100 dark:bg-amber-400/15 text-amber-900 dark:text-amber-200"
                      : "border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-400"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {habit.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          disabled={busy}
          className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-500 active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? "Saving…" : initial ? "Save changes" : "Add to roadmap"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-stone-300 dark:border-stone-700 px-4 py-2.5 text-sm transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
