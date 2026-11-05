"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import {
  archivedBranches,
  demotionFloor,
  dependentCount,
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
import { Disclosure } from "@/components/ui/Disclosure";
import { Toast } from "@/components/ui/Toast";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Ban,
  Flame,
  List,
  Lock,
  Map,
  Plus,
  TimerReset,
  Trophy,
} from "lucide-react";

/** Map or list — remembered, because it is a preference, not a mood. */
type View = "map" | "list";

const VIEW_OPTIONS = [
  {
    value: "map" as const,
    title: "The island map",
    label: (
      <span className="flex items-center justify-center gap-1.5">
        <Map size={13} />
        <span className="hidden sm:inline">Map</span>
      </span>
    ),
  },
  {
    value: "list" as const,
    title: "A searchable list",
    label: (
      <span className="flex items-center justify-center gap-1.5">
        <List size={13} />
        <span className="hidden sm:inline">List</span>
      </span>
    ),
  },
];

/** A saved Map/List choice, read during the first render so nothing flashes. */
function savedView(key: string): View {
  if (typeof window === "undefined") return "map";
  return (localStorage.getItem(key) as View | null) ?? "map";
}

function RoadmapPage() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [selected, setSelected] = useState<Habit | null>(null);
  const [mode, setMode] = useState<"closed" | "view" | "create" | "edit">("closed");
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; text: string } | null>(
    null,
  );
  // Timer habits show a running clock; it only needs to tick while one is open.
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Lazy init reads the saved choice during the first render, so the map
  // never flashes up before the list takes over.
  const [view, setViewState] = useState<View>(() => savedView("roadmapView"));
  const setView = (next: View) => {
    setViewState(next);
    localStorage.setItem("roadmapView", next);
  };
  // The archive has its own switch: a graph of what was put away, or the list.
  const [archivedView, setArchivedViewState] = useState<View>(() =>
    savedView("archivedView"),
  );
  const setArchivedView = (next: View) => {
    setArchivedViewState(next);
    localStorage.setItem("archivedView", next);
  };

  // setState happens in the promise callback, never in the effect body itself
  // (react-hooks/set-state-in-effect).
  const show = useCallback((data: Habit[]) => {
    setHabits(data);
    setSelected((current) => data.find((h) => h.id === current?.id) ?? null);
  }, []);

  const reload = useCallback(() => api<Habit[]>("/api/habits").then(show), [show]);

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

  /** Puts the selected habit away, along with everything that depends on it. */
  async function archiveHabit() {
    if (!selected || !habits) return;
    const dependents = dependentCount(selected, inUse);
    const branch =
      dependents === 0
        ? `"${selected.name}"`
        : `"${selected.name}" and the ${dependents} habit${dependents === 1 ? "" : "s"} that depend on it`;
    if (
      !confirm(
        `Archive ${branch}? They leave the map and the check-in, keep their progress, and come back whenever you restore them.`,
      )
    )
      return;
    try {
      show(await api<Habit[]>(`/api/habits/${selected.id}/archive`, { method: "POST" }));
      setMode("closed");
      setNotice({
        tone: "success",
        text: `Archived ${branch}. Find it under Archived to bring it back.`,
      });
    } catch (err) {
      setNotice({ tone: "warning", text: err instanceof Error ? err.message : "Could not archive" });
    }
  }

  async function restoreHabit(habit: Habit) {
    try {
      const data = await api<Habit[]>(`/api/habits/${habit.id}/restore`, { method: "POST" });
      show(data);
      const back = (habits ?? []).filter(
        (h) => h.archivedAt && !data.find((d) => d.id === h.id)?.archivedAt,
      ).length;
      setMode("closed");
      setNotice({
        tone: "success",
        text:
          back > 1
            ? `"${habit.name}" and ${back - 1} more are back on your roadmap.`
            : `"${habit.name}" is back on your roadmap.`,
      });
    } catch (err) {
      setNotice({ tone: "warning", text: err instanceof Error ? err.message : "Could not restore" });
    }
  }

  if (!habits) return <SkeletonPage cards={6} />;

  // Archived habits keep their place in the data but leave the roadmap.
  const inUse = habits.filter((h) => !h.archivedAt);
  const branches = archivedBranches(habits);
  const archivedCount = habits.length - inUse.length;

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
            {inUse.length > 0 && (
              <Segmented
                size="sm"
                value={view}
                onChange={setView}
                ariaLabel="How to show the roadmap"
                options={VIEW_OPTIONS}
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

      {inUse.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong text-center text-ink-soft">
          <p>
            {archivedCount > 0
              ? "Every habit is archived. Restore one below, or add a new one —"
              : "Your map is empty. Add your first basic habit —"}
          </p>
          <p className="text-sm">
            start small: “5 prayers”, “make my bed”, “read 10 minutes”.
          </p>
          <button onClick={openNew} className="btn btn-primary mt-1">
            <Plus size={16} /> New habit
          </button>
        </div>
      ) : view === "map" ? (
        <IslandMap
          habits={inUse}
          selectedId={selected?.id ?? null}
          onSelect={(habit) => {
            setSelected(habit);
            setMode(habit ? "view" : "closed");
          }}
        />
      ) : (
        <HabitList
          habits={inUse}
          selectedId={selected?.id ?? null}
          onSelect={(habit) => {
            setSelected(habit);
            setMode("view");
          }}
        />
      )}

      {branches.length > 0 && (
        <div className="mt-6">
          <Disclosure
            title="Archived"
            icon={<Archive size={14} className="text-ink-faint" />}
            count={archivedCount}
            summary="put away for now, progress kept"
            storageKey="roadmap-archived"
          >
            <div className="mb-3 flex justify-end">
              <Segmented
                size="sm"
                value={archivedView}
                onChange={setArchivedView}
                ariaLabel="How to show the archive"
                options={VIEW_OPTIONS}
              />
            </div>
            {archivedView === "map" ? (
              <IslandMap
                habits={habits.filter((h) => h.archivedAt)}
                selectedId={selected?.archivedAt ? selected.id : null}
                onSelect={(habit) => {
                  setSelected(habit);
                  setMode(habit ? "view" : "closed");
                }}
                bookends={false}
                heightClass="h-80 sm:h-96"
              />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {branches.map(({ root, members }) => {
                  const waitingOn = habits.find(
                    (h) => h.archivedAt && root.prerequisiteIds.includes(h.id),
                  );
                  return (
                    <li key={root.id} className="card flex items-center gap-3 p-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(root);
                          setMode("view");
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate font-medium">{root.name}</p>
                        <p className="truncate text-xs text-ink-faint">
                          {members.length > 0
                            ? `with ${members.map((m) => m.name).join(", ")}`
                            : "on its own"}
                          {waitingOn && ` · needs "${waitingOn.name}" back first`}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => restoreHabit(root)}
                        disabled={!!waitingOn}
                        className="btn btn-ghost shrink-0 px-3 text-sm"
                        title={waitingOn ? `Restore "${waitingOn.name}" first` : "Back on the roadmap"}
                      >
                        <ArchiveRestore size={14} /> Restore
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Disclosure>
        </div>
      )}

      <Toast open={!!notice} tone={notice?.tone} onClose={() => setNotice(null)}>
        {notice?.text}
      </Toast>

      {/* create */}
      <Modal open={mode === "create"} onClose={() => setMode("closed")} size="lg">
        <HabitForm
          allHabits={inUse}
          onSubmit={createHabit}
          onCancel={() => setMode("closed")}
        />
      </Modal>

      {/* edit */}
      <Modal open={mode === "edit" && !!selected} onClose={() => setMode("view")} size="lg">
        {selected && (
          <HabitForm
            allHabits={selected.archivedAt ? habits : inUse}
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

            {selected.archivedAt && (
              <p className="flex items-center gap-1.5 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-ink-soft">
                <Archive size={13} /> Archived on{" "}
                {new Date(selected.archivedAt).toLocaleDateString()}. Its progress is kept;
                the time away never counts as missed.
              </p>
            )}

            {selected.status === "LOCKED" && !selected.archivedAt && (
              <p className="flex items-center gap-1.5 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-ink-soft">
                <Lock size={13} /> Unlocks when all its prerequisite habits are valid.
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setMode("edit")} className="btn btn-ghost flex-1">
                Edit
              </button>
              {selected.archivedAt ? (
                <button onClick={() => restoreHabit(selected)} className="btn btn-ghost">
                  <ArchiveRestore size={15} /> Restore
                </button>
              ) : (
                <button
                  onClick={archiveHabit}
                  className="btn btn-ghost"
                  title="Put it away with what depends on it, progress kept"
                >
                  <Archive size={15} /> Archive
                </button>
              )}
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
