"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth, useAuth } from "@/lib/auth";
import { habitVerbs, type CheckinResult, type TodayEntry, type TodayResponse } from "@/lib/types";
import { GaugeBar } from "@/components/GaugeBar";
import { Ban, Check, Flame, GripVertical, Snowflake, X } from "lucide-react";

interface MissDraft {
  habitId: number;
  reason: string;
  freeze: boolean;
}

type GroupBy = "none" | "rhythm" | "goal";

const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: "none", label: "None" },
  { key: "rhythm", label: "Rhythm" },
  { key: "goal", label: "Goal" },
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

/** Immutably moves the item at `from` to index `to`. */
function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

function CheckinPage() {
  const { refreshUser } = useAuth();
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [missDraft, setMissDraft] = useState<MissDraft | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // setState happens in the promise callback, never in the effect body itself
  // (react-hooks/set-state-in-effect).
  const reload = useCallback(
    () =>
      api<TodayResponse>("/api/checkins/today").then((data) => {
        setToday(data);
        // The server's order is now the truth; drop the local arrangement.
        setDragOrder(null);
      }),
    [],
  );

  useEffect(() => {
    reload();
  }, [reload]);

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
      setMissDraft(null);
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

  if (!today) {
    return (
      <div className="flex flex-1 items-center justify-center text-stone-400">Loading…</div>
    );
  }

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

  /** Slots the dragged habit into whichever row the pointer is over. */
  function dragTo(clientY: number) {
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

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">Daily check-in</h1>
        <span className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
          <span className="flex items-center gap-1" title="Freezes for daily & weekly habits">
            <Snowflake size={12} className="text-sky-500" /> {today.freezesLeft} left
          </span>
          <span
            className="flex items-center gap-1"
            title="Deep Freeze for monthly habits — one every 3 months"
          >
            <Snowflake size={12} className="text-rose-500" />{" "}
            {today.deepFreezesLeft > 0 ? "Deep Freeze ready" : "Deep Freeze used"}
          </span>
        </span>
      </div>
      <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
        {today.date} — answer any habit as soon as you know. Honesty builds the gauge
        that counts.
      </p>

      {result && (
        <div
          className={`mb-4 rounded-xl border p-4 ${
            result.earnedPoints >= 0
              ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50"
              : "border-amber-200 bg-amber-50 dark:bg-amber-400/10"
          }`}
        >
          <p
            className={`font-medium ${
              result.earnedPoints >= 0
                ? "text-emerald-800 dark:text-emerald-300"
                : "text-amber-800 dark:text-amber-300"
            }`}
          >
            {result.earnedPoints >= 0 ? "+" : ""}
            {result.earnedPoints} points · Total: {result.totalPoints} (level {result.level})
          </p>
          {result.becameValid.length > 0 && (
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              ✓ Now valid: {result.becameValid.join(", ")}
            </p>
          )}
          {result.unlocked.length > 0 && (
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              🔓 Unlocked: {result.unlocked.join(", ")}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-md bg-red-50 dark:bg-red-950/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {today.entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 dark:border-stone-700 p-8 text-center text-stone-500 dark:text-stone-400">
          No active habits yet — add some on your roadmap first.
        </div>
      )}

      {pending.length > 1 && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className="text-stone-500 dark:text-stone-400">Group by</span>
          <div className="flex rounded-lg bg-stone-100 dark:bg-stone-800 p-0.5">
            {GROUP_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setGroupBy(opt.key)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  groupBy === opt.key
                    ? "bg-white dark:bg-stone-600 text-stone-800 dark:text-stone-100 shadow-sm"
                    : "text-stone-500 dark:text-stone-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {groupEntries(pending, groupBy).map((group) => (
          <div key={group.key} className="space-y-2">
            {group.label && (
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                {group.label}
                <span className="ml-1 text-stone-300 dark:text-stone-600">
                  · {group.items.length}
                </span>
              </h3>
            )}
            {group.items.map((entry) => (
              <PendingRow
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
            ))}
          </div>
        ))}
      </div>

      {pending.length === 0 && today.entries.length > 0 && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 p-6 text-center text-emerald-800 dark:text-emerald-300">
          ✓ All answered for now ({today.pointsToday >= 0 ? "+" : ""}
          {today.pointsToday} points today). See you tomorrow!
        </div>
      )}

      {answered.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-stone-500 dark:text-stone-400">
            Answered
          </h2>
          <ul className="space-y-1 text-sm">
            {answered.map((entry) => (
              <li
                key={entry.habitId}
                className="flex justify-between rounded-md bg-white dark:bg-stone-900 px-3 py-2"
              >
                <span className="flex items-center gap-1.5">
                  {entry.habitType === "QUIT" && (
                    <Ban size={13} className="text-red-500" />
                  )}
                  {entry.name}
                </span>
                <AnsweredStatus entry={entry} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AnsweredStatus({ entry }: { entry: TodayEntry }) {
  if (entry.todayStatus === "FROZEN") {
    const deep = entry.schedule === "MONTHLY";
    return (
      <span
        className={`flex items-center gap-1 ${deep ? "text-rose-500" : "text-sky-500"}`}
      >
        <Snowflake size={13} /> {deep ? "deep-frozen" : "frozen"}
      </span>
    );
  }
  if (entry.todayStatus === "MISSED") {
    return <span className="text-stone-400">missed</span>;
  }
  return (
    <span className="text-emerald-600 dark:text-emerald-400">
      {entry.todayStatus === "DONE_TODAY"
        ? `done today · ${entry.doneThisPeriod}/${entry.timesPerPeriod} this ${entry.schedule === "WEEKLY" ? "week" : "month"}`
        : entry.habitType === "QUIT"
          ? "avoided ✓"
          : "done ✓"}
    </span>
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
        on: "border-rose-400 bg-rose-50 dark:bg-rose-950/40 shadow-rose-200/50 dark:shadow-rose-900/30",
        icon: "bg-rose-500 text-white",
        iconOff: "bg-rose-100 dark:bg-rose-900/50 text-rose-500",
        text: "text-rose-700 dark:text-rose-300",
        track: "bg-rose-500",
      }
    : {
        on: "border-sky-400 bg-sky-50 dark:bg-sky-950/40 shadow-sky-200/50 dark:shadow-sky-900/30",
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
      className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
        active
          ? `${palette.on} shadow-md`
          : "border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600"
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
        <span className="block text-xs text-stone-500 dark:text-stone-400">
          Gauge and streak stay untouched · {quota}
        </span>
      </span>
      {!locked && (
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            active ? palette.track : "bg-stone-300 dark:bg-stone-600"
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

function PendingRow({
  entry,
  busy,
  missDraft,
  freezesLeft,
  deepFreezesLeft,
  draggable,
  dragging,
  rowRef,
  onDragBegin,
  onDragMove,
  onDragEnd,
  onKeyboardMove,
  onDone,
  onMissClick,
  onMissConfirm,
  onMissCancel,
  onDraftChange,
}: {
  entry: TodayEntry;
  busy: boolean;
  missDraft: MissDraft | null;
  freezesLeft: number;
  deepFreezesLeft: number;
  draggable: boolean;
  dragging: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
  onDragBegin: () => void;
  onDragMove: (clientY: number) => void;
  onDragEnd: () => void;
  onKeyboardMove: (delta: number) => void;
  onDone: () => void;
  onMissClick: (freeze: boolean) => void;
  onMissConfirm: (draft: MissDraft) => void;
  onMissCancel: () => void;
  onDraftChange: (draft: MissDraft) => void;
}) {
  const verbs = habitVerbs(entry.habitType);
  const periodic = entry.schedule !== "DAILY";
  const deep = entry.schedule === "MONTHLY";
  const freezeQuotaLeft = deep ? deepFreezesLeft : freezesLeft;
  const periodNoun = entry.schedule === "WEEKLY" ? "week" : "month";

  return (
    <div
      ref={rowRef}
      className={`rounded-xl border bg-white dark:bg-stone-900 p-4 shadow-sm transition-shadow ${
        dragging
          ? "border-amber-400 shadow-lg select-none"
          : "border-stone-200 dark:border-stone-800"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {draggable && (
          <button
            type="button"
            aria-label={`Reorder ${entry.name} — drag, or use the arrow keys`}
            title="Drag to reorder"
            onPointerDown={(event) => {
              event.preventDefault();
              // Capture keeps the moves coming once the pointer leaves the
              // small handle; not every browser grants it, hence the guard.
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                /* drag still works while the pointer stays on the handle */
              }
              event.currentTarget.focus();
              onDragBegin();
            }}
            onPointerMove={(event) => onDragMove(event.clientY)}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              event.preventDefault();
              onKeyboardMove(event.key === "ArrowUp" ? -1 : 1);
            }}
            className={`-ml-2 shrink-0 touch-none rounded-md p-1 text-stone-300 dark:text-stone-700 transition-colors hover:text-stone-500 dark:hover:text-stone-400 focus-visible:text-stone-500 focus-visible:outline-none ${
              dragging ? "cursor-grabbing text-stone-500" : "cursor-grab"
            }`}
          >
            <GripVertical size={16} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-medium">
            {entry.habitType === "QUIT" && <Ban size={14} className="text-red-500" />}
            {entry.name}
            {periodic && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  entry.daysLeftInPeriod <= entry.timesPerPeriod - entry.doneThisPeriod
                    ? "bg-amber-100 dark:bg-amber-400/15 font-medium text-amber-800 dark:text-amber-300"
                    : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400"
                }`}
              >
                {entry.doneThisPeriod}/{entry.timesPerPeriod} this {periodNoun} ·{" "}
                {entry.daysLeftInPeriod} day{entry.daysLeftInPeriod === 1 ? "" : "s"} left
              </span>
            )}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <GaugeBar
              gauge={entry.gauge}
              max={entry.requiredStreak}
              valid={entry.status === "VALID"}
              className="max-w-40"
            />
            <span className="flex items-center gap-0.5 text-xs text-stone-400">
              <Flame size={12} className="text-orange-500" />
              {entry.currentStreak}
            </span>
            {entry.multiplier > 1 && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-400/15 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300">
                ×{entry.multiplier}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            onClick={onDone}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
          >
            <span className="flex items-center gap-1.5">
              <Check size={15} />
              {busy ? "…" : verbs.did}
            </span>
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
              className={`rounded-lg border px-4 py-2.5 text-sm transition-all active:scale-95 disabled:opacity-40 ${
                deep
                  ? "border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  : "border-sky-300 dark:border-sky-800 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Snowflake size={15} />
                {deep ? "Deep Freeze" : "Freeze"}
              </span>
            </button>
          ) : (
            <button
              onClick={() => onMissClick(false)}
              disabled={busy}
              className="rounded-lg border border-stone-300 dark:border-stone-700 px-4 py-2.5 text-sm transition-all hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                <X size={15} />
                {verbs.missed}
              </span>
            </button>
          )}
        </div>
      </div>

      {missDraft && (
        <div className="mt-3 space-y-3 rounded-lg bg-stone-50 dark:bg-stone-900 p-3">
          {periodic && (
            <p className="text-sm font-medium">Skip this whole {periodNoun}?</p>
          )}
          <label className="block text-sm">
            <span className="text-stone-600 dark:text-stone-300">
              What happened? (a reason halves the point loss)
            </span>
            <textarea
              value={missDraft.reason}
              maxLength={500}
              rows={2}
              onChange={(e) => onDraftChange({ ...missDraft, reason: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              placeholder="e.g. traveled all day, was sick…"
            />
          </label>

          <FreezeToggle
            active={missDraft.freeze}
            disabled={!periodic && freezesLeft <= 0}
            deep={deep}
            locked={periodic}
            quota={
              deep
                ? `1 every 3 months (${deepFreezesLeft} ready)`
                : `${freezesLeft} left this month`
            }
            onToggle={
              periodic
                ? undefined
                : () => onDraftChange({ ...missDraft, freeze: !missDraft.freeze })
            }
          />

          <div className="flex gap-2">
            <button
              onClick={() => onMissConfirm(missDraft)}
              disabled={busy}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 ${
                missDraft.freeze
                  ? deep
                    ? "bg-rose-500 hover:bg-rose-400"
                    : "bg-sky-500 hover:bg-sky-400"
                  : "bg-stone-700 dark:bg-stone-600 hover:bg-stone-600 dark:hover:bg-stone-500"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {missDraft.freeze && <Snowflake size={14} />}
                {periodic
                  ? deep
                    ? "Use Deep Freeze"
                    : `Freeze this ${periodNoun}`
                  : missDraft.freeze
                    ? "Freeze & confirm"
                    : "Confirm miss"}
              </span>
            </button>
            <button
              onClick={onMissCancel}
              className="rounded-lg border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
          </div>
        </div>
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
