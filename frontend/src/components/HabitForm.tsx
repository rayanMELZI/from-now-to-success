"use client";

import { useState, type FormEvent } from "react";
import type { Habit, HabitRequest, HabitSchedule, HabitType } from "@/lib/types";

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
  const [prereqIds, setPrereqIds] = useState<number[]>(initial?.prerequisiteIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const candidates = allHabits.filter((h) => h.id !== initial?.id);

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
        requiredStreak,
        schedule,
        habitType,
        prerequisiteIds: prereqIds,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h2 className="font-semibold">{initial ? "Edit habit" : "New habit"}</h2>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <label className="block text-sm">
        <span className="text-stone-600">Name</span>
        <input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
          placeholder="e.g. 5 prayers"
        />
      </label>

      <label className="block text-sm">
        <span className="text-stone-600">Description (optional)</span>
        <textarea
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-stone-600">Goal</span>
          <select
            value={habitType}
            onChange={(e) => setHabitType(e.target.value as HabitType)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
          >
            <option value="BUILD">Build a good habit</option>
            <option value="QUIT">Quit a bad habit</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-stone-600">Rhythm</span>
          <select
            value={schedule}
            onChange={(e) => setSchedule(e.target.value as HabitSchedule)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
          >
            <option value="DAILY">Every day</option>
            <option value="WEEKLY">Once a week</option>
            <option value="MONTHLY">Once a month</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-stone-600">Points per {schedule === "DAILY" ? "day" : schedule === "WEEKLY" ? "week" : "month"}</span>
          <input
            type="number"
            min={1}
            max={100}
            value={basePoints}
            onChange={(e) => setBasePoints(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-600">
            {schedule === "DAILY" ? "Days" : schedule === "WEEKLY" ? "Weeks" : "Months"} to validate
          </span>
          <input
            type="number"
            min={2}
            max={90}
            value={requiredStreak}
            onChange={(e) => setRequiredStreak(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
          />
        </label>
      </div>

      {candidates.length > 0 && (
        <fieldset className="text-sm">
          <legend className="text-stone-600">
            Prerequisites (must be valid before this unlocks)
          </legend>
          <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-md border border-stone-200 p-2">
            {candidates.map((habit) => (
              <label key={habit.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prereqIds.includes(habit.id)}
                  onChange={() => togglePrereq(habit.id)}
                />
                <span>
                  {habit.name}
                  <span className="ml-1 text-xs text-stone-400">({habit.status.toLowerCase()})</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex gap-2 pt-1">
        <button
          disabled={busy}
          className="flex-1 rounded-md bg-stone-800 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : initial ? "Save changes" : "Add to roadmap"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
