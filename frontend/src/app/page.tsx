"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import { scheduleLabel, type Habit, type HabitRequest } from "@/lib/types";
import { IslandMap } from "@/components/IslandMap";
import { HabitForm } from "@/components/HabitForm";
import { GaugeBar } from "@/components/GaugeBar";
import { Modal } from "@/components/Modal";

function RoadmapPage() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [selected, setSelected] = useState<Habit | null>(null);
  const [mode, setMode] = useState<"closed" | "view" | "create" | "edit">("closed");

  // setState happens in the promise callback, never in the effect body itself
  // (react-hooks/set-state-in-effect).
  const reload = useCallback(
    () =>
      api<Habit[]>("/api/habits").then((data) => {
        setHabits(data);
        setSelected((current) => data.find((h) => h.id === current?.id) ?? null);
      }),
    [],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  async function createHabit(request: HabitRequest) {
    await api("/api/habits", { method: "POST", body: request });
    setMode("closed");
    await reload();
  }

  async function updateHabit(request: HabitRequest) {
    if (!selected) return;
    await api(`/api/habits/${selected.id}`, { method: "PUT", body: request });
    setMode("closed");
    await reload();
  }

  async function deleteHabit() {
    if (!selected) return;
    if (!confirm(`Delete "${selected.name}" and all its history?`)) return;
    await api(`/api/habits/${selected.id}`, { method: "DELETE" });
    setSelected(null);
    setMode("closed");
    await reload();
  }

  if (!habits) {
    return (
      <div className="flex flex-1 items-center justify-center text-stone-400">Loading…</div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Your roadmap</h1>
          <p className="hidden text-sm text-stone-500 dark:text-stone-400 sm:block">
            Validate habits to unlock the next ones on the path to success.
          </p>
        </div>
        <button
          onClick={() => {
            setSelected(null);
            setMode("create");
          }}
          className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-500 active:scale-95"
        >
          + New habit
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-center text-stone-500 dark:text-stone-400">
          <p>Your map is empty. Add your first basic habit —</p>
          <p className="text-sm">start small: “5 prayers”, “make my bed”, “read 10 minutes”.</p>
        </div>
      ) : (
        <IslandMap
          habits={habits}
          selectedId={selected?.id ?? null}
          onSelect={(habit) => {
            setSelected(habit);
            setMode(habit ? "view" : "closed");
          }}
        />
      )}

      {/* create */}
      <Modal open={mode === "create"} onClose={() => setMode("closed")}>
        <HabitForm
          allHabits={habits}
          onSubmit={createHabit}
          onCancel={() => setMode("closed")}
        />
      </Modal>

      {/* edit */}
      <Modal open={mode === "edit" && !!selected} onClose={() => setMode("view")}>
        {selected && (
          <HabitForm
            allHabits={habits}
            initial={selected}
            onSubmit={updateHabit}
            onCancel={() => setMode("view")}
          />
        )}
      </Modal>

      {/* details */}
      <Modal open={mode === "view" && !!selected} onClose={() => setMode("closed")}>
        {selected && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">
                {selected.habitType === "QUIT" ? "🚫 " : ""}
                {selected.name}
              </h2>
              {selected.description && (
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{selected.description}</p>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                Validation gauge
              </p>
              <GaugeBar
                gauge={selected.gauge}
                max={selected.requiredStreak}
                valid={selected.status === "VALID"}
              />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-stone-500 dark:text-stone-400">Status</dt>
              <dd className="font-medium">{selected.status.toLowerCase()}</dd>
              <dt className="text-stone-500 dark:text-stone-400">Rhythm</dt>
              <dd>
                {scheduleLabel[selected.schedule]}
                {selected.schedule !== "DAILY" && ` · ${selected.timesPerPeriod}×`}
              </dd>
              <dt className="text-stone-500 dark:text-stone-400">Streak</dt>
              <dd>
                🔥 {selected.currentStreak}
                <span className="ml-1 text-xs text-stone-400">
                  (best {selected.bestStreak})
                </span>
              </dd>
              <dt className="text-stone-500 dark:text-stone-400">Points</dt>
              <dd>{selected.basePoints}</dd>
            </dl>

            {selected.status === "LOCKED" && (
              <p className="rounded-lg bg-stone-100 dark:bg-stone-800 px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
                🔒 Unlocks when all its prerequisite habits are valid.
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setMode("edit")}
                className="flex-1 rounded-lg border border-stone-300 dark:border-stone-700 py-2.5 text-sm font-medium transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Edit
              </button>
              <button
                onClick={deleteHabit}
                className="rounded-lg border border-red-200 dark:border-red-900 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/50"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <RoadmapPage />
    </RequireAuth>
  );
}
