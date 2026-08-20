"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import {
  demotionFloor,
  formatDuration,
  habitRisk,
  scheduleLabel,
  type Habit,
  type HabitRequest,
} from "@/lib/types";
import { IslandMap } from "@/components/IslandMap";
import { HabitList } from "@/components/HabitList";
import { HabitForm } from "@/components/HabitForm";
import { GaugeBar } from "@/components/GaugeBar";
import { Modal } from "@/components/Modal";
import { PageHeader, PageShell } from "@/components/ui/Page";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { AlertTriangle, Ban, Flame, List, Lock, Map, Plus, TimerReset, Trophy } from "lucide-react";

/** Map or list — remembered, because it is a preference, not a mood. */
type View = "map" | "list";

function RoadmapPage() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [selected, setSelected] = useState<Habit | null>(null);
  const [mode, setMode] = useState<"closed" | "view" | "create" | "edit">("closed");
  // Timer habits show a running clock; it only needs to tick while one is open.
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Lazy init reads the saved choice during the first render, so the map
  // never flashes up before the list takes over.
  const [view, setViewState] = useState<View>(() =>
    typeof window === "undefined"
      ? "map"
      : ((localStorage.getItem("roadmapView") as View | null) ?? "map"),
  );
  const setView = (next: View) => {
    setViewState(next);
    localStorage.setItem("roadmapView", next);
  };

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

  const selectedRisk = selected ? habitRisk(selected) : null;

  const tickingClock = mode === "view" && selected?.trackingMode === "TIMER";

  useEffect(() => {
    if (!tickingClock) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [tickingClock]);

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

  if (!habits) return <SkeletonPage cards={6} />;

  function openNew() {
    setSelected(null);
    setMode("create");
  }

  return (
    <PageShell width="full" className="flex flex-col">
      <PageHeader
        title="Your roadmap"
        subtitle="Validate habits to unlock the next ones on the path to success."
        actions={
          <>
            {habits.length > 0 && (
              <Segmented
                size="sm"
                value={view}
                onChange={setView}
                ariaLabel="How to show the roadmap"
                options={[
                  {
                    value: "map",
                    title: "The island map",
                    label: (
                      <span className="flex items-center justify-center gap-1.5">
                        <Map size={13} />
                        <span className="hidden sm:inline">Map</span>
                      </span>
                    ),
                  },
                  {
                    value: "list",
                    title: "A searchable list",
                    label: (
                      <span className="flex items-center justify-center gap-1.5">
                        <List size={13} />
                        <span className="hidden sm:inline">List</span>
                      </span>
                    ),
                  },
                ]}
              />
            )}
            {/* On a phone the label goes and the button becomes the round
                "+" that every app puts a new thing behind. */}
            <button onClick={openNew} className="btn btn-primary px-4 max-sm:w-11 max-sm:px-0">
              <Plus size={16} />
              <span className="max-sm:hidden">New habit</span>
              <span className="sr-only sm:hidden">New habit</span>
            </button>
          </>
        }
      />

      {habits.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong text-center text-ink-soft">
          <p>Your map is empty. Add your first basic habit —</p>
          <p className="text-sm">
            start small: “5 prayers”, “make my bed”, “read 10 minutes”.
          </p>
          <button onClick={openNew} className="btn btn-primary mt-1">
            <Plus size={16} /> New habit
          </button>
        </div>
      ) : view === "map" ? (
        <IslandMap
          habits={habits}
          selectedId={selected?.id ?? null}
          onSelect={(habit) => {
            setSelected(habit);
            setMode(habit ? "view" : "closed");
          }}
        />
      ) : (
        <HabitList
          habits={habits}
          selectedId={selected?.id ?? null}
          onSelect={(habit) => {
            setSelected(habit);
            setMode("view");
          }}
        />
      )}

      {/* create */}
      <Modal open={mode === "create"} onClose={() => setMode("closed")} size="lg">
        <HabitForm
          allHabits={habits}
          onSubmit={createHabit}
          onCancel={() => setMode("closed")}
        />
      </Modal>

      {/* edit */}
      <Modal open={mode === "edit" && !!selected} onClose={() => setMode("view")} size="lg">
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
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                {selected.habitType === "QUIT" && (
                  <Ban size={17} className="text-red-500" />
                )}
                {selected.name}
              </h2>
              {selected.description && (
                <p className="mt-1 text-sm text-ink-soft">{selected.description}</p>
              )}
            </div>

            <div>
              <p className="field-label mb-1">
                {selected.trackingMode === "TIMER" ? "Milestones" : "Validation gauge"}
              </p>
              <GaugeBar
                gauge={selected.gauge}
                max={selected.requiredStreak}
                valid={selected.status === "VALID"}
                timer={selected.trackingMode === "TIMER"}
              />
            </div>

            {selectedRisk && (
              <p
                className={`flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs ${
                  selectedRisk === "critical"
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                    : "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                }`}
              >
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>
                  Validated, but the gauge has slipped to {selected.gauge}/
                  {selected.requiredStreak}. Below {demotionFloor(selected.requiredStreak)}{" "}
                  it drops back to in progress and re-locks whatever it unlocked.
                </span>
              </p>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-ink-soft">Status</dt>
              <dd className="font-medium">{selected.status.toLowerCase()}</dd>
              {selected.trackingMode === "TIMER" ? (
                <>
                  <dt className="text-ink-soft">Goal</dt>
                  <dd>{formatDuration(selected.goalSeconds ?? 0)} clean</dd>
                  <dt className="text-ink-soft">Running for</dt>
                  <dd className="flex items-center gap-1">
                    <TimerReset size={14} className="text-sky-500" />
                    {selected.clockStartedAt
                      ? formatDuration((nowMs - Date.parse(selected.clockStartedAt)) / 1000)
                      : "not started"}
                  </dd>
                  <dt className="text-ink-soft">Best run</dt>
                  <dd className="flex items-center gap-1">
                    <Trophy size={14} className="text-amber-500" />
                    {selected.bestCleanSeconds > 0
                      ? formatDuration(selected.bestCleanSeconds)
                      : "—"}
                  </dd>
                </>
              ) : (
                <>
                  <dt className="text-ink-soft">Rhythm</dt>
                  <dd>
                    {scheduleLabel[selected.schedule]}
                    {selected.schedule !== "DAILY" && ` · ${selected.timesPerPeriod}×`}
                  </dd>
                  <dt className="text-ink-soft">Streak</dt>
                  <dd className="flex items-center gap-1">
                    <Flame size={14} className="text-orange-500" /> {selected.currentStreak}
                    <span className="ml-1 text-xs text-ink-faint">
                      (best {selected.bestStreak})
                    </span>
                  </dd>
                </>
              )}
              <dt className="text-ink-soft">Points</dt>
              <dd>{selected.basePoints}</dd>
            </dl>

            {selected.status === "LOCKED" && (
              <p className="flex items-center gap-1.5 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-ink-soft">
                <Lock size={13} /> Unlocks when all its prerequisite habits are valid.
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setMode("edit")} className="btn btn-ghost flex-1">
                Edit
              </button>
              <button
                onClick={deleteHabit}
                className="btn border border-red-200 font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <RoadmapPage />
    </RequireAuth>
  );
}
