"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth, useAuth } from "@/lib/auth";
import {
  formatClock,
  formatDuration,
  habitVerbs,
  type CheckinResult,
  type FallResult,
  type TimerEntry,
  type TodayEntry,
  type TodayResponse,
} from "@/lib/types";
import { GaugeBar } from "@/components/GaugeBar";
import { PageHeader, PageShell } from "@/components/ui/Page";
import { Disclosure } from "@/components/ui/Disclosure";
import { Segmented } from "@/components/ui/Segmented";
import { Toast } from "@/components/ui/Toast";
import { SkeletonPage } from "@/components/ui/Skeleton";
import {
  Ban,
  Check,
  Flame,
  GripVertical,
  LayoutGrid,
  Rows3,
  Snowflake,
  Sprout,
  TimerReset,
  Trophy,
  X,
} from "lucide-react";

interface MissDraft {
  habitId: number;
  reason: string;
  freeze: boolean;
}

/** Owning up to a relapse: the same shape as a miss, minus the freeze. */
interface FallDraft {
  habitId: number;
  reason: string;
}

type GroupBy = "none" | "rhythm" | "goal";

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "All" },
  { value: "rhythm", label: "Rhythm" },
  { value: "goal", label: "Goal" },
];

/** One column on a phone, two on a tablet, three on a wide desktop. */
const CARD_GRID = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3";

/** The two shapes a pending habit can take. Neither replaced the other. */
type View = "cards" | "list";

const VIEW_OPTIONS: { value: View; label: React.ReactNode; title: string }[] = [
  {
    value: "cards",
    title: "Cards in a grid",
    label: <LayoutGrid size={13} />,
  },
  { value: "list", title: "One habit per row", label: <Rows3 size={13} /> },
];

/** Splits the check-in list into labelled sections by the chosen property. */
function groupEntries(
  entries: TodayEntry[],
  mode: GroupBy,
): { key: string; label: string; items: TodayEntry[] }[] {
  const buckets: { key: string; label: string; match: (e: TodayEntry) => boolean }[] =
    mode === "rhythm"
      ? [
          { key: "DAILY", label: "Daily", match: (e) => e.schedule === "DAILY" },
          { key: "WEEKLY", label: "Weekly", match: (e) => e.schedule === "WEEKLY" },
          { key: "MONTHLY", label: "Monthly", match: (e) => e.schedule === "MONTHLY" },
        ]
      : mode === "goal"
        ? [
            { key: "BUILD", label: "Building", match: (e) => e.habitType === "BUILD" },
            { key: "QUIT", label: "Quitting", match: (e) => e.habitType === "QUIT" },
          ]
        : [{ key: "all", label: "", match: () => true }];

  return buckets
    .map((b) => ({ key: b.key, label: b.label, items: entries.filter(b.match) }))
    .filter((g) => g.items.length > 0);
}

/** Which section an entry lands in — dragging never crosses those. */
function groupKey(entry: TodayEntry, mode: GroupBy): string {
  return mode === "rhythm" ? entry.schedule : mode === "goal" ? entry.habitType : "all";
}

/** Seconds the current run has been going, on the server's clock. */
function elapsedOf(timer: TimerEntry, serverNowMs: number): number {
  return Math.max(0, Math.floor((serverNowMs - Date.parse(timer.clockStartedAt)) / 1000));
}

/** Immutably moves the item at `from` to index `to`. */
function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/** The day's progress as a donut — readable at a glance from across a room. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const size = 68;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? done / total : 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-track"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className={`transition-all duration-700 ease-out ${
            pct >= 1 ? "stroke-emerald-500" : "stroke-accent"
          }`}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-semibold tabular-nums leading-none">
          {done}
          <span className="text-ink-faint">/{total}</span>
        </span>
      </span>
    </div>
  );
}

/** Where the day stands: what is left, what it paid, what is in the bank. */
function TodaySummary({
  today,
  answered,
  pending,
  runningTimers,
}: {
  today: TodayResponse;
  answered: number;
  pending: number;
  runningTimers: number;
}) {
  const total = answered + pending;

  return (
    <div className="card mb-4 flex flex-wrap items-center gap-x-6 gap-y-4 p-4">
      <div className="flex items-center gap-3">
        <ProgressRing done={answered} total={total} />
        <div>
          <p className="font-semibold">
            {total === 0
              ? "Nothing to answer"
              : pending === 0
                ? "All answered"
                : `${pending} left to answer`}
          </p>
          <p className="text-xs text-ink-soft">{today.date}</p>
        </div>
      </div>

      <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm sm:ml-auto">
        <div>
          <dt className="field-label">Points today</dt>
          <dd
            className={`font-semibold tabular-nums ${
              today.pointsToday >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {today.pointsToday >= 0 ? "+" : ""}
            {today.pointsToday}
          </dd>
        </div>
        <div title="Freezes for daily & weekly habits">
          <dt className="field-label">Freezes</dt>
          <dd className="flex items-center gap-1 font-semibold tabular-nums">
            <Snowflake size={13} className="text-sky-500" />
            {today.freezesLeft}
          </dd>
        </div>
        <div title="Deep Freeze for monthly habits — one every 3 months">
          <dt className="field-label">Deep Freeze</dt>
          <dd className="flex items-center gap-1 font-semibold">
            <Snowflake size={13} className="text-rose-500" />
            {today.deepFreezesLeft > 0 ? "ready" : "used"}
          </dd>
        </div>
        {runningTimers > 0 && (
          <div>
            <dt className="field-label">Clocks</dt>
            <dd className="flex items-center gap-1 font-semibold tabular-nums">
              <TimerReset size={13} className="text-sky-500" />
              {runningTimers}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function CheckinPage() {
  const { refreshUser } = useAuth();
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [missDraft, setMissDraft] = useState<MissDraft | null>(null);
  const [fallDraft, setFallDraft] = useState<FallDraft | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [fallResult, setFallResult] = useState<FallResult | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The clocks tick locally; skew keeps them honest when the device clock
  // disagrees with the server that owns the real elapsed time.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [skewMs, setSkewMs] = useState(0);
  const bankedRef = useRef("");

  // Manual ordering. `dragOrder` holds the pending ids while the user is
  // rearranging them; null means "show the order the server sent".
  const [dragOrder, setDragOrder] = useState<number[] | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());

  // Remembered grouping choice (lazy init avoids a setState-in-effect).
  const [groupBy, setGroupByState] = useState<GroupBy>(() =>
    typeof window === "undefined"
      ? "none"
      : ((localStorage.getItem("checkinGroupBy") as GroupBy | null) ?? "none"),
  );
  const setGroupBy = (g: GroupBy) => {
    setGroupByState(g);
    localStorage.setItem("checkinGroupBy", g);
  };

  const [view, setViewState] = useState<View>(() =>
    typeof window === "undefined"
      ? "cards"
      : ((localStorage.getItem("checkinView") as View | null) ?? "cards"),
  );
  const setView = (v: View) => {
    setViewState(v);
    localStorage.setItem("checkinView", v);
  };

  // setState happens in the promise callback, never in the effect body itself
  // (react-hooks/set-state-in-effect).
  const reload = useCallback(
    () =>
      api<TodayResponse>("/api/checkins/today").then((data) => {
        setSkewMs(Date.parse(data.serverNow) - Date.now());
        setToday(data);
        // The server's order is now the truth; drop the local arrangement.
        setDragOrder(null);
      }),
    [],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const timers = useMemo(() => today?.timers ?? [], [today]);
  const hasTimers = timers.length > 0;

  useEffect(() => {
    if (!hasTimers) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasTimers]);

  // A milestone only pays once the server sees it, so ask again the moment a
  // clock ticks past one — each (habit, milestone) pair triggers a single reload.
  useEffect(() => {
    const due = timers
      .filter(
        (timer) =>
          timer.nextMilestoneSeconds > 0 &&
          elapsedOf(timer, nowMs + skewMs) >= timer.nextMilestoneSeconds,
      )
      .map((timer) => `${timer.habitId}:${timer.nextMilestoneSeconds}`)
      .join(",");
    if (due && due !== bankedRef.current) {
      bankedRef.current = due;
      reload();
    }
  }, [timers, nowMs, skewMs, reload]);

  /** Answer ONE habit immediately — no need to wait for the end of the day. */
  async function answer(
    habitId: number,
    done: boolean,
    reason?: string,
    freeze?: boolean,
  ) {
    setBusyId(habitId);
    setError(null);
    try {
      const submission = await api<CheckinResult>("/api/checkins", {
        method: "POST",
        body: { entries: [{ habitId, done, reason: reason || undefined, freeze }] },
      });
      setResult(submission);
      setFallResult(null);
      setMissDraft(null);
      await Promise.all([reload(), refreshUser()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  /** Own up to a relapse: the run ends, the record stands, the clock restarts. */
  async function confirmFall(draft: FallDraft) {
    setBusyId(draft.habitId);
    setError(null);
    try {
      const submission = await api<FallResult>(`/api/timers/${draft.habitId}/fall`, {
        method: "POST",
        body: { reason: draft.reason || undefined },
      });
      setFallResult(submission);
      setResult(null);
      setFallDraft(null);
      bankedRef.current = "";
      await Promise.all([reload(), refreshUser()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  /** Persist the manual order the user just dragged into place. */
  async function saveOrder(habitIds: number[]) {
    setError(null);
    try {
      await api("/api/habits/order", { method: "PUT", body: { habitIds } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the order");
    }
    // Either way, fall back to whatever the server now holds.
    await reload();
  }

  if (!today) return <SkeletonPage />;

  const answered = today.entries.filter((e) => e.todayStatus !== "PENDING");
  const serverPending = today.entries.filter((e) => e.todayStatus === "PENDING");
  // Only the pending rows are draggable, so only they get rearranged locally.
  const pending = dragOrder
    ? dragOrder.flatMap((id) => serverPending.filter((e) => e.habitId === id))
    : serverPending;

  function beginDrag(habitId: number) {
    setDraggingId(habitId);
    setDragOrder(pending.map((e) => e.habitId));
  }

  /**
   * Slots the dragged habit into whichever card the pointer is over. The hit
   * test is two-dimensional now that the cards sit in a grid: with columns,
   * "is the pointer between this row's top and bottom" matched every card in
   * the row at once.
   */
  function dragTo(clientX: number, clientY: number) {
    if (draggingId === null || dragOrder === null) return;
    const from = dragOrder.indexOf(draggingId);
    const dragged = pending[from];
    if (!dragged) return;

    for (const entry of pending) {
      const row = rowRefs.current.get(entry.habitId);
      // Sections stay intact: a habit can only move inside its own group.
      if (!row || groupKey(entry, groupBy) !== groupKey(dragged, groupBy)) continue;
      const box = row.getBoundingClientRect();
      if (clientY < box.top || clientY > box.bottom) continue;
      if (clientX < box.left || clientX > box.right) continue;

      const to = dragOrder.indexOf(entry.habitId);
      if (to !== from && to >= 0) setDragOrder(moveItem(dragOrder, from, to));
      return;
    }
  }

  function endDrag() {
    if (draggingId === null) return;
    setDraggingId(null);
    if (!dragOrder) return;
    const unchanged = dragOrder.every((id, i) => id === serverPending[i]?.habitId);
    if (unchanged) setDragOrder(null);
    else saveOrder(dragOrder);
  }

  /** Arrow keys move a focused handle — dragging alone excludes keyboards. */
  function moveWithKeyboard(habitId: number, delta: number) {
    const ids = pending.map((e) => e.habitId);
    const from = ids.indexOf(habitId);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    if (groupKey(pending[to], groupBy) !== groupKey(pending[from], groupBy)) return;
    const next = moveItem(ids, from, to);
    setDragOrder(next);
    saveOrder(next);
  }

  /** One pending habit, wired to the page — the same in every section. */
  const renderPending = (entry: TodayEntry) => {
    const Shape = view === "list" ? PendingRow : PendingCard;
    return (
      <Shape
        key={entry.habitId}
        entry={entry}
        busy={busyId === entry.habitId}
        missDraft={missDraft?.habitId === entry.habitId ? missDraft : null}
        freezesLeft={today.freezesLeft}
        deepFreezesLeft={today.deepFreezesLeft}
        draggable={pending.length > 1}
        dragging={draggingId === entry.habitId}
        rowRef={(el) => {
          if (el) rowRefs.current.set(entry.habitId, el);
          else rowRefs.current.delete(entry.habitId);
        }}
        onDragBegin={() => beginDrag(entry.habitId)}
        onDragMove={dragTo}
        onDragEnd={endDrag}
        onKeyboardMove={(delta) => moveWithKeyboard(entry.habitId, delta)}
        onDone={() => answer(entry.habitId, true)}
        onMissClick={(freeze) =>
          setMissDraft({ habitId: entry.habitId, reason: "", freeze })
        }
        onMissConfirm={(draft) =>
          answer(entry.habitId, false, draft.reason, draft.freeze)
        }
        onMissCancel={() => setMissDraft(null)}
        onDraftChange={setMissDraft}
      />
    );
  };

  const groups = groupEntries(pending, groupBy);
  // Cards tile; rows just stack.
  const listClass = view === "list" ? "space-y-2" : CARD_GRID;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Daily check-in"
        subtitle="Answer any habit as soon as you know. Honesty builds the gauge that counts."
      />

      <TodaySummary
        today={today}
        answered={answered.length}
        pending={pending.length}
        runningTimers={timers.length}
      />

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      {timers.length > 0 && (
        <div className="mb-5">
          <Disclosure
            title="Timers"
            count={timers.length}
            defaultOpen
            storageKey="checkin-timers"
            summary="clocks still running"
          >
            <div className={CARD_GRID}>
              {timers.map((timer) => (
                <TimerCard
                  key={timer.habitId}
                  entry={timer}
                  elapsed={elapsedOf(timer, nowMs + skewMs)}
                  busy={busyId === timer.habitId}
                  draft={fallDraft?.habitId === timer.habitId ? fallDraft : null}
                  onSlipClick={() => setFallDraft({ habitId: timer.habitId, reason: "" })}
                  onDraftChange={setFallDraft}
                  onConfirm={confirmFall}
                  onCancel={() => setFallDraft(null)}
                />
              ))}
            </div>
          </Disclosure>
        </div>
      )}

      {today.entries.length === 0 && timers.length === 0 && (
        <div className="rounded-xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
          No active habits yet — add some on your roadmap first.
        </div>
      )}

      {pending.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
            {pending.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-ink-faint">Group by</span>
                <Segmented
                  size="sm"
                  value={groupBy}
                  options={GROUP_OPTIONS}
                  onChange={setGroupBy}
                  ariaLabel="Group the habits"
                />
              </div>
            )}
            <div className="ml-auto">
              <Segmented
                size="sm"
                value={view}
                options={VIEW_OPTIONS}
                onChange={setView}
                ariaLabel="Show habits as cards or as a list"
              />
            </div>
          </div>

          {groupBy === "none" ? (
            <div className={listClass}>{pending.map(renderPending)}</div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <Disclosure
                  key={group.key}
                  title={group.label}
                  count={group.items.length}
                  defaultOpen
                  storageKey={`checkin-group-${group.key}`}
                >
                  <div className={listClass}>{group.items.map(renderPending)}</div>
                </Disclosure>
              ))}
            </div>
          )}
        </>
      )}

      {pending.length === 0 && today.entries.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Check size={26} className="mx-auto" />
          <p className="mt-2 font-medium">All answered for now</p>
          <p className="mt-0.5 text-sm">
            {today.pointsToday >= 0 ? "+" : ""}
            {today.pointsToday} points today. See you tomorrow!
          </p>
        </div>
      )}

      {answered.length > 0 && (
        <div className="mt-6">
          {/* Folded by default: it is the part of the day you are done with. */}
          <Disclosure
            title="Answered"
            count={answered.length}
            storageKey="checkin-answered"
            summary="already settled today"
          >
            {/* A single column, however wide the window: a run of finished
                things down the page reads as a day's work done, which two
                or three short columns of it does not. */}
            <ul className="space-y-1">
              {answered.map((entry) => (
                <li
                  key={entry.habitId}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {entry.habitType === "QUIT" ? (
                      <Ban size={13} className="shrink-0 text-red-500" />
                    ) : (
                      <Sprout size={13} className="shrink-0 text-emerald-600" />
                    )}
                    <span className="truncate">{entry.name}</span>
                  </span>
                  <AnsweredStatus entry={entry} />
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      )}

      {/* Results float over the page instead of pushing it down. */}
      <Toast
        open={result !== null}
        tone={result && result.earnedPoints >= 0 ? "success" : "warning"}
        onClose={() => setResult(null)}
      >
        {result && (
          <>
            <p className="font-medium">
              {result.earnedPoints >= 0 ? "+" : ""}
              {result.earnedPoints} points · Total {result.totalPoints} (level{" "}
              {result.level})
            </p>
            {result.becameValid.length > 0 && (
              <p className="mt-0.5">✓ Now valid: {result.becameValid.join(", ")}</p>
            )}
            {result.unlocked.length > 0 && (
              <p className="mt-0.5">🔓 Unlocked: {result.unlocked.join(", ")}</p>
            )}
          </>
        )}
      </Toast>

      <Toast
        open={fallResult !== null}
        tone="neutral"
        onClose={() => setFallResult(null)}
      >
        {fallResult && (
          <>
            <p className="font-medium">
              Clock restarted — that run lasted{" "}
              {formatDuration(fallResult.lastRunSeconds)}.
            </p>
            <p className="mt-0.5 text-ink-soft">
              {fallResult.earnedPoints >= 0 ? "+" : ""}
              {fallResult.earnedPoints} points · Total {fallResult.totalPoints} (level{" "}
              {fallResult.level})
            </p>
            {fallResult.newRecord && (
              <p className="mt-0.5 flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                <Trophy size={14} /> A new personal best — beat{" "}
                {formatDuration(fallResult.bestCleanSeconds)} next time.
              </p>
            )}
            {fallResult.relocked.length > 0 && (
              <p className="mt-0.5 text-ink-soft">
                Locked again: {fallResult.relocked.join(", ")}
              </p>
            )}
          </>
        )}
      </Toast>
    </PageShell>
  );
}

function AnsweredStatus({ entry }: { entry: TodayEntry }) {
  if (entry.todayStatus === "FROZEN") {
    const deep = entry.schedule === "MONTHLY";
    return (
      <span
        className={`flex shrink-0 items-center gap-1 text-xs ${
          deep ? "text-rose-500" : "text-sky-500"
        }`}
      >
        <Snowflake size={13} /> {deep ? "deep-frozen" : "frozen"}
      </span>
    );
  }
  if (entry.todayStatus === "MISSED") {
    return <span className="shrink-0 text-xs text-ink-faint">missed</span>;
  }
  return (
    <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400">
      {entry.todayStatus === "DONE_TODAY"
        ? `${entry.doneThisPeriod}/${entry.timesPerPeriod} this ${entry.schedule === "WEEKLY" ? "week" : "month"}`
        : entry.habitType === "QUIT"
          ? "avoided ✓"
          : "done ✓"}
    </span>
  );
}

/**
 * A timer habit: a clock that has been running since the last relapse, the
 * record it is chasing, and the one button that ends the run.
 */
function TimerCard({
  entry,
  elapsed,
  busy,
  draft,
  onSlipClick,
  onDraftChange,
  onConfirm,
  onCancel,
}: {
  entry: TimerEntry;
  elapsed: number;
  busy: boolean;
  draft: FallDraft | null;
  onSlipClick: () => void;
  onDraftChange: (draft: FallDraft) => void;
  onConfirm: (draft: FallDraft) => void;
  onCancel: () => void;
}) {
  const { days, time } = formatClock(elapsed);
  const record = entry.bestCleanSeconds;
  const beatingRecord = record > 0 && elapsed > record;
  const goalReached = entry.nextMilestoneSeconds === 0;
  const toNext = entry.nextMilestoneSeconds - elapsed;

  return (
    <div className="card flex flex-col p-3">
      <p className="flex items-center gap-1.5 font-medium">
        <Ban size={14} className="shrink-0 text-red-500" />
        <span className="truncate">{entry.name}</span>
      </p>

      <p className="mt-1 flex items-baseline gap-1.5 tabular-nums">
        {days > 0 && (
          <span className="text-2xl font-semibold">
            {days}
            <span className="text-base font-normal text-ink-faint">d</span>
          </span>
        )}
        <span
          className={`text-2xl font-semibold ${
            beatingRecord ? "text-amber-600 dark:text-amber-400" : ""
          }`}
        >
          {time}
        </span>
      </p>

      <div className="mt-2 flex items-center gap-2">
        <GaugeBar
          gauge={entry.gauge}
          max={entry.requiredStreak}
          valid={entry.status === "VALID"}
          className="flex-1"
        />
      </div>
      <p className="mt-0.5 text-xs text-ink-faint">
        {entry.gauge}/{entry.requiredStreak} milestones
      </p>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span
          className={`flex items-center gap-1 ${
            beatingRecord ? "text-amber-600 dark:text-amber-400" : "text-ink-faint"
          }`}
        >
          <Trophy size={12} />
          {record === 0
            ? "First run — you are setting the bar"
            : beatingRecord
              ? `Past your best of ${formatDuration(record)}`
              : `Best: ${formatDuration(record)}`}
        </span>
        {goalReached ? (
          <span className="text-emerald-600 dark:text-emerald-400">Goal reached ✓</span>
        ) : (
          toNext > 0 && (
            <span className="text-ink-faint">
              Next milestone in {formatDuration(toNext)}
            </span>
          )
        )}
      </p>

      <button
        onClick={onSlipClick}
        disabled={busy}
        className="btn btn-sm mt-2.5 w-full border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
      >
        <TimerReset size={15} />I slipped
      </button>

      {draft && (
        <div className="mt-3 space-y-3 rounded-lg bg-surface-sunken p-3">
          <p className="text-sm font-medium">Reset the clock?</p>
          <p className="text-xs text-ink-soft">
            This run ends at {formatDuration(elapsed)}
            {beatingRecord ? " — your new record" : ""}. The gauge empties and the clock
            starts from zero.
          </p>
          <label className="block space-y-1">
            <span className="text-xs text-ink-soft">
              What happened? (a reason halves the point loss)
            </span>
            <textarea
              value={draft.reason}
              maxLength={500}
              rows={2}
              onChange={(e) => onDraftChange({ ...draft, reason: e.target.value })}
              className="field"
              placeholder="e.g. stressed after work, someone offered…"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => onConfirm(draft)}
              disabled={busy}
              className="btn flex-1 bg-rose-500 text-white hover:bg-rose-400"
            >
              {busy ? "…" : "Yes, restart it"}
            </button>
            <button onClick={onCancel} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The pretty freeze switch: an ice card that lights up when armed. */
function FreezeToggle({
  active,
  disabled,
  deep,
  quota,
  onToggle,
  locked,
}: {
  active: boolean;
  disabled: boolean;
  deep: boolean;
  quota: string;
  onToggle?: () => void;
  locked?: boolean; // periodic skips: the freeze is the whole point, not optional
}) {
  const palette = deep
    ? {
        on: "border-rose-400 bg-rose-50 dark:bg-rose-950/40",
        icon: "bg-rose-500 text-white",
        iconOff: "bg-rose-100 dark:bg-rose-900/50 text-rose-500",
        text: "text-rose-700 dark:text-rose-300",
        track: "bg-rose-500",
      }
    : {
        on: "border-sky-400 bg-sky-50 dark:bg-sky-950/40",
        icon: "bg-sky-500 text-white",
        iconOff: "bg-sky-100 dark:bg-sky-900/50 text-sky-500",
        text: "text-sky-700 dark:text-sky-300",
        track: "bg-sky-500",
      };

  return (
    <button
      type="button"
      disabled={disabled || locked}
      onClick={onToggle}
      aria-pressed={active}
      className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
        active ? `${palette.on} shadow-md` : "border-line hover:border-line-strong"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
          active ? `${palette.icon} scale-110` : palette.iconOff
        }`}
      >
        <Snowflake size={18} className={active ? "animate-pulse" : ""} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${active ? palette.text : ""}`}>
          {deep ? "Deep Freeze" : "Streak freeze"}
        </span>
        <span className="block text-xs text-ink-soft">
          Gauge and streak stay untouched · {quota}
        </span>
      </span>
      {!locked && (
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            active ? palette.track : "bg-line-strong"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              active ? "left-5.5" : "left-0.5"
            }`}
          />
        </span>
      )}
    </button>
  );
}

/** Drag, or arrow keys — the grip that reorders a habit. */
function DragHandle({
  entry,
  dragging,
  onDragBegin,
  onDragMove,
  onDragEnd,
  onKeyboardMove,
  className = "",
}: {
  entry: TodayEntry;
  dragging: boolean;
  onDragBegin: () => void;
  onDragMove: (clientX: number, clientY: number) => void;
  onDragEnd: () => void;
  onKeyboardMove: (delta: number) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`Reorder ${entry.name} — drag, or use the arrow keys`}
      title="Drag to reorder"
      onPointerDown={(event) => {
        event.preventDefault();
        // Capture keeps the moves coming once the pointer leaves the small
        // handle; not every browser grants it, hence the guard.
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* drag still works while the pointer stays on the handle */
        }
        event.currentTarget.focus();
        onDragBegin();
      }}
      onPointerMove={(event) => onDragMove(event.clientX, event.clientY)}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        onKeyboardMove(event.key === "ArrowUp" ? -1 : 1);
      }}
      className={`shrink-0 touch-none rounded-md p-1 text-ink-faint opacity-40 transition-opacity hover:opacity-100 focus-visible:opacity-100 ${
        dragging ? "cursor-grabbing opacity-100" : "cursor-grab"
      } ${className}`}
    >
      <GripVertical size={16} />
    </button>
  );
}

/**
 * Name, what is left of the period, and any warning — on one wrapping line,
 * so the badges sit beside the name when they fit and drop under it when
 * they do not.
 */
function HabitHeadline({ entry }: { entry: TodayEntry }) {
  const periodic = entry.schedule !== "DAILY";
  const periodNoun = entry.schedule === "WEEKLY" ? "week" : "month";
  const urgent =
    periodic && entry.daysLeftInPeriod <= entry.timesPerPeriod - entry.doneThisPeriod;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      <p className="flex min-w-0 items-center gap-1.5 font-medium">
        {entry.habitType === "QUIT" ? (
          <Ban size={14} className="shrink-0 text-red-500" />
        ) : (
          <Sprout size={14} className="shrink-0 text-emerald-600" />
        )}
        <span className="truncate">{entry.name}</span>
      </p>
      {periodic && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            urgent
              ? "bg-amber-100 font-medium text-amber-800 dark:bg-amber-400/15 dark:text-amber-300"
              : "bg-surface-sunken text-ink-soft"
          }`}
        >
          {entry.doneThisPeriod}/{entry.timesPerPeriod} this {periodNoun} ·{" "}
          {entry.daysLeftInPeriod} day{entry.daysLeftInPeriod === 1 ? "" : "s"} left
        </span>
      )}
    </div>
  );
}

/** The gauge, the streak, and the multiplier if one is running. */
function GaugeRow({
  entry,
  className = "",
}: {
  entry: TodayEntry;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <GaugeBar
        gauge={entry.gauge}
        max={entry.requiredStreak}
        valid={entry.status === "VALID"}
        className="min-w-0 flex-1"
      />
      <span
        className="flex shrink-0 items-center gap-0.5 text-xs text-ink-faint"
        title={`${entry.currentStreak} in a row`}
      >
        <Flame size={12} className="text-orange-500" />
        {entry.currentStreak}
      </span>
      {entry.multiplier > 1 && (
        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink">
          ×{entry.multiplier}
        </span>
      )}
    </div>
  );
}

/** Did it / Missed — or, for a weekly or monthly habit, Did it / Freeze. */
function AnswerButtons({
  entry,
  busy,
  freezesLeft,
  deepFreezesLeft,
  stretch,
  onDone,
  onMissClick,
}: {
  entry: TodayEntry;
  busy: boolean;
  freezesLeft: number;
  deepFreezesLeft: number;
  /** Cards split the width between the two; the list sizes them to their text. */
  stretch: boolean;
  onDone: () => void;
  onMissClick: (freeze: boolean) => void;
}) {
  const verbs = habitVerbs(entry.habitType);
  const periodic = entry.schedule !== "DAILY";
  const deep = entry.schedule === "MONTHLY";
  const freezeQuotaLeft = deep ? deepFreezesLeft : freezesLeft;
  const periodNoun = entry.schedule === "WEEKLY" ? "week" : "month";
  const width = stretch ? "flex-1" : "";

  return (
    <div className="flex shrink-0 gap-2">
      <button
        onClick={onDone}
        disabled={busy}
        className={`btn btn-sm bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 ${width}`}
      >
        <Check size={15} />
        {busy ? "…" : verbs.did}
      </button>
      {periodic ? (
        <button
          onClick={() => onMissClick(true)}
          disabled={busy || freezeQuotaLeft <= 0}
          title={
            freezeQuotaLeft <= 0
              ? deep
                ? "Deep Freeze already used (one every 3 months)"
                : "No freezes left this month"
              : `Skip this ${periodNoun} with a ${deep ? "Deep Freeze" : "freeze"}`
          }
          className={`btn btn-sm border ${width} ${
            deep
              ? "border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
              : "border-sky-300 text-sky-600 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-950/40"
          }`}
        >
          <Snowflake size={15} />
          {deep ? "Deep Freeze" : "Freeze"}
        </button>
      ) : (
        <button
          onClick={() => onMissClick(false)}
          disabled={busy}
          className={`btn btn-sm btn-ghost ${width}`}
        >
          <X size={15} />
          {verbs.missed}
        </button>
      )}
    </div>
  );
}

/** Owning a miss: the reason, the freeze switch, and the confirmation. */
function MissDraftPanel({
  entry,
  draft,
  busy,
  freezesLeft,
  deepFreezesLeft,
  onConfirm,
  onCancel,
  onChange,
}: {
  entry: TodayEntry;
  draft: MissDraft;
  busy: boolean;
  freezesLeft: number;
  deepFreezesLeft: number;
  onConfirm: (draft: MissDraft) => void;
  onCancel: () => void;
  onChange: (draft: MissDraft) => void;
}) {
  const periodic = entry.schedule !== "DAILY";
  const deep = entry.schedule === "MONTHLY";
  const periodNoun = entry.schedule === "WEEKLY" ? "week" : "month";

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-surface-sunken p-3">
      {periodic && <p className="text-sm font-medium">Skip this whole {periodNoun}?</p>}
      <label className="block space-y-1">
        <span className="text-xs text-ink-soft">
          What happened? (a reason halves the point loss)
        </span>
        <textarea
          value={draft.reason}
          maxLength={500}
          rows={2}
          onChange={(e) => onChange({ ...draft, reason: e.target.value })}
          className="field"
          placeholder="e.g. traveled all day, was sick…"
        />
      </label>

      <FreezeToggle
        active={draft.freeze}
        disabled={!periodic && freezesLeft <= 0}
        deep={deep}
        locked={periodic}
        quota={
          deep
            ? `1 every 3 months (${deepFreezesLeft} ready)`
            : `${freezesLeft} left this month`
        }
        onToggle={periodic ? undefined : () => onChange({ ...draft, freeze: !draft.freeze })}
      />

      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(draft)}
          disabled={busy}
          className={`btn flex-1 text-white shadow-sm ${
            draft.freeze
              ? deep
                ? "bg-rose-500 hover:bg-rose-400"
                : "bg-sky-500 hover:bg-sky-400"
              : "bg-stone-700 hover:bg-stone-600 dark:bg-stone-600 dark:hover:bg-stone-500"
          }`}
        >
          {draft.freeze && <Snowflake size={14} />}
          {periodic
            ? deep
              ? "Use Deep Freeze"
              : `Freeze this ${periodNoun}`
            : draft.freeze
              ? "Freeze & confirm"
              : "Confirm miss"}
        </button>
        <button onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}

interface PendingProps {
  entry: TodayEntry;
  busy: boolean;
  missDraft: MissDraft | null;
  freezesLeft: number;
  deepFreezesLeft: number;
  draggable: boolean;
  dragging: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
  onDragBegin: () => void;
  onDragMove: (clientX: number, clientY: number) => void;
  onDragEnd: () => void;
  onKeyboardMove: (delta: number) => void;
  onDone: () => void;
  onMissClick: (freeze: boolean) => void;
  onMissConfirm: (draft: MissDraft) => void;
  onMissCancel: () => void;
  onDraftChange: (draft: MissDraft) => void;
}

/**
 * One habit waiting for an answer, as a card in a grid.
 *
 * Three of these sit side by side on a desktop instead of one stripe of text
 * marooned in the middle of the window — everything stacks, so a narrow
 * column still reads.
 */
function PendingCard(props: PendingProps) {
  const { entry, draggable, dragging, rowRef, missDraft } = props;

  return (
    <div
      ref={rowRef}
      className={`card flex flex-col p-3 transition-shadow ${
        dragging ? "select-none border-accent shadow-lg" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {draggable && <DragHandle {...props} className="-ml-1.5 -mt-1" />}
        <div className="min-w-0 flex-1">
          <HabitHeadline entry={entry} />
        </div>
      </div>

      <GaugeRow entry={entry} className="mt-2" />

      <div className="mt-2.5">
        <AnswerButtons {...props} stretch />
      </div>

      {missDraft && (
        <MissDraftPanel
          entry={entry}
          draft={missDraft}
          busy={props.busy}
          freezesLeft={props.freezesLeft}
          deepFreezesLeft={props.deepFreezesLeft}
          onConfirm={props.onMissConfirm}
          onCancel={props.onMissCancel}
          onChange={props.onDraftChange}
        />
      )}
    </div>
  );
}

/**
 * The same habit as a full-width row: name and gauge on the left, the two
 * answers on the right. Denser than the card once the window is wide, and
 * the shape the app had before the grid — which is why both are kept.
 */
function PendingRow(props: PendingProps) {
  const { entry, draggable, dragging, rowRef, missDraft } = props;

  return (
    <div
      ref={rowRef}
      className={`card p-4 transition-shadow ${
        dragging ? "select-none border-accent shadow-lg" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {draggable && <DragHandle {...props} className="-ml-2" />}
        <div className="min-w-0 flex-1">
          <HabitHeadline entry={entry} />
          <GaugeRow entry={entry} className="mt-1 max-w-md" />
        </div>
        <AnswerButtons {...props} stretch={false} />
      </div>

      {missDraft && (
        <MissDraftPanel
          entry={entry}
          draft={missDraft}
          busy={props.busy}
          freezesLeft={props.freezesLeft}
          deepFreezesLeft={props.deepFreezesLeft}
          onConfirm={props.onMissConfirm}
          onCancel={props.onMissCancel}
          onChange={props.onDraftChange}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <CheckinPage />
    </RequireAuth>
  );
}
