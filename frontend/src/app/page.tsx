"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import { scheduleLabel, type Habit, type HabitRequest } from "@/lib/types";
import { IslandMap } from "@/components/IslandMap";
import { HabitForm } from "@/components/HabitForm";
import { GaugeBar } from "@/components/GaugeBar";

function RoadmapPage() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [selected, setSelected] = useState<Habit | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

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
    setMode("view");
    await reload();
  }

  async function updateHabit(request: HabitRequest) {
    if (!selected) return;
    await api(`/api/habits/${selected.id}`, { method: "PUT", body: request });
    setMode("view");
    await reload();
  }

  async function deleteHabit() {
    if (!selected) return;
    if (!confirm(`Delete "${selected.name}" and all its history?`)) return;
    await api(`/api/habits/${selected.id}`, { method: "DELETE" });
    setSelected(null);
    await reload();
  }

  if (!habits) {
    return (
      <div className="flex flex-1 items-center justify-center text-stone-400">Loading…</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Your roadmap</h1>
          <p className="text-sm text-stone-500">
            Validate habits to unlock the next ones on the path to success.
          </p>
        </div>
        <button
          onClick={() => {
            setSelected(null);
            setMode("create");
          }}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
        >
          + New habit
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          {habits.length === 0 && mode !== "create" ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-stone-300 text-stone-500">
              <p>Your map is empty. Add your first basic habit —</p>
              <p className="text-sm">start small: “5 prayers”, “make my bed”, “read 10 minutes”.</p>
            </div>
          ) : (
            <IslandMap
              habits={habits}
              selectedId={selected?.id ?? null}
              onSelect={(habit) => {
                setSelected(habit);
                setMode("view");
              }}
            />
          )}
        </div>

        {(selected || mode === "create") && (
          <aside className="w-full shrink-0 rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:w-80">
            {mode === "create" && (
              <HabitForm
                allHabits={habits}
                onSubmit={createHabit}
                onCancel={() => setMode("view")}
              />
            )}

            {mode === "edit" && selected && (
              <HabitForm
                allHabits={habits}
                initial={selected}
                onSubmit={updateHabit}
                onCancel={() => setMode("view")}
              />
            )}

            {mode === "view" && selected && (
              <div className="space-y-3">
                <div>
                  <h2 className="font-semibold">
                    {selected.habitType === "QUIT" ? "🚫 " : ""}
                    {selected.name}
                  </h2>
                  {selected.description && (
                    <p className="mt-1 text-sm text-stone-500">{selected.description}</p>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-stone-400">
                    Validation gauge
                  </p>
                  <GaugeBar
                    gauge={selected.gauge}
                    max={selected.requiredStreak}
                    valid={selected.status === "VALID"}
                  />
                </div>

                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-stone-500">Status</dt>
                  <dd className="font-medium">{selected.status.toLowerCase()}</dd>
                  <dt className="text-stone-500">Rhythm</dt>
                  <dd>{scheduleLabel[selected.schedule]}</dd>
                  <dt className="text-stone-500">Streak</dt>
                  <dd>
                    🔥 {selected.currentStreak}
                    <span className="ml-1 text-xs text-stone-400">
                      (best {selected.bestStreak})
                    </span>
                  </dd>
                  <dt className="text-stone-500">Points</dt>
                  <dd>{selected.basePoints}</dd>
                </dl>

                {selected.status === "LOCKED" && (
                  <p className="rounded-md bg-stone-100 px-3 py-2 text-xs text-stone-500">
                    🔒 Unlocks when all its prerequisite habits are valid.
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setMode("edit")}
                    className="flex-1 rounded-md border border-stone-300 py-2 text-sm hover:bg-stone-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={deleteHabit}
                    className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
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
