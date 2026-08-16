"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { RequireAuth, useAuth } from "@/lib/auth";
import {
  formatGap,
  formatMinute,
  minuteOfUserDay,
  parseMinute,
  type CheckinResult,
  type Habit,
  type PlanBlock,
  type PlanDay,
  type TodayEntry,
  type TodayResponse,
} from "@/lib/types";
import {
  Ban,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

const DAY_MINUTES = 24 * 60;

/**
 * Dates are written in the APP's language, never the browser's. Left to the
 * browser, a French device rendered "Today · dimanche 16 août" — half of it
 * translated and half of it not. One constant, so a language switcher has a
 * single place to take over.
 */
const DATE_LOCALE = "en-GB";

/* ---------- dates: ISO strings in, ISO strings out (never UTC-shifted) ---------- */

/** "2026-08-13" → a Date at LOCAL midnight (new Date(iso) would be UTC). */
function parseIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function shiftIso(iso: string, days: number): string {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000);
}

/** "Today", "Yesterday", "Tomorrow", else "Thu 14 Aug". */
function dayLabel(iso: string, today: string): string {
  const delta = daysBetween(today, iso);
  if (delta === 0) return "Today";
  if (delta === -1) return "Yesterday";
  if (delta === 1) return "Tomorrow";
  return parseIso(iso).toLocaleDateString(DATE_LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Everything finishing at the same minute, drawn as one attached stack. */
interface Slot {
  endMinute: number;
  items: PlanBlock[];
}

function toSlots(blocks: PlanBlock[]): Slot[] {
  const slots: Slot[] = [];
  for (const block of blocks) {
    const last = slots[slots.length - 1];
    if (last && last.endMinute === block.endMinute) last.items.push(block);
    else slots.push({ endMinute: block.endMinute, items: [block] });
  }
  return slots;
}

/* ---------- the page ---------- */

function PlanPage() {
  const { user, refreshUser } = useAuth();

  const [day, setDay] = useState<PlanDay | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The "now" line only moves once a minute — no need to tick any faster.
  const [nowMinute, setNowMinute] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setNowMinute(now.getHours() * 60 + now.getMinutes());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // setState only inside the promise callbacks (react-hooks/set-state-in-effect).
  const load = useCallback(
    (date: string | null) =>
      api<PlanDay>(`/api/plan${date ? `?date=${date}` : ""}`).then(setDay),
    [],
  );

  useEffect(() => {
    if (!user?.plannerEnabled) return;
    load(null).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not load your plan"),
    );
    api<Habit[]>("/api/habits").then(setHabits).catch(() => setHabits([]));
    api<TodayResponse>("/api/checkins/today")
      .then(setToday)
      .catch(() => setToday(null));
  }, [load, user?.plannerEnabled]);

  const blocks = useMemo(() => day?.blocks ?? [], [day]);
  const slots = useMemo(() => toSlots(blocks), [blocks]);
  const isToday = day != null && day.date === day.today;
  const doneCount = blocks.filter((b) => b.done).length;
  // 0% and 100% have to MEAN none and all — rounding must never claim a day
  // is finished while a line is still open, or empty once one is ticked.
  const donePercent =
    doneCount === 0 || blocks.length === 0
      ? 0
      : doneCount === blocks.length
        ? 100
        : Math.min(99, Math.max(1, Math.round((doneCount / blocks.length) * 100)));

  // The timeline runs in the user's own day, not the clock's: with a day that
  // ends at 04:00, a 01:00 block belongs at the bottom, not the top.
  const position = (minute: number) => minuteOfUserDay(minute, user?.dayEndHour ?? 0);
  const nowPosition = position(nowMinute);

  // Blocks are back to back, so "now" is always INSIDE one of them rather than
  // between two: the first block not yet finished is the one being lived.
  const currentIndex = isToday
    ? slots.findIndex((slot) => position(slot.endMinute) > nowPosition)
    : -1;

  /** Today's check-in row for a linked habit — only meaningful on today's plan. */
  function entryFor(habitId: number | null): TodayEntry | null {
    if (habitId === null || !isToday) return null;
    return today?.entries.find((e) => e.habitId === habitId) ?? null;
  }

  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const goTo = (date: string) => run(() => load(date));

  async function addBlock(title: string, endMinute: number, habitId: number | null) {
    if (!day) return;
    await run(async () => {
      await api<PlanBlock>(`/api/plan?date=${day.date}`, {
        method: "POST",
        body: { title, endMinute, habitId },
      });
      await load(day.date);
    });
  }

  async function saveBlock(
    id: number,
    title: string,
    endMinute: number,
    habitId: number | null,
  ) {
    if (!day) return;
    await run(async () => {
      await api<PlanBlock>(`/api/plan/${id}`, {
        method: "PUT",
        body: { title, endMinute, habitId },
      });
      await load(day.date);
      setEditingId(null);
    });
  }

  /**
   * Ticking a block off is the answer to its habit's daily question, so it
   * counts right there — a planned habit should never have to be ticked twice.
   * Only ever on today's plan, and only for a habit still unanswered: the
   * check-in cannot be taken back, so un-ticking the block leaves it standing.
   */
  async function toggleDone(block: PlanBlock) {
    if (!day) return;
    const done = !block.done;
    const entry = entryFor(block.habitId);
    await run(async () => {
      await api<PlanBlock>(`/api/plan/${block.id}/done`, {
        method: "PUT",
        body: { done },
      });
      if (done && entry?.todayStatus === "PENDING") {
        await checkIn(entry.habitId, entry.name);
      }
      await load(day.date);
    });
  }

  async function removeBlock(id: number) {
    if (!day) return;
    await run(async () => {
      await api(`/api/plan/${id}`, { method: "DELETE" });
      await load(day.date);
    });
  }

  async function copyFrom(from: string) {
    if (!day) return;
    await run(async () => {
      const copied = await api<PlanDay>(`/api/plan/copy?date=${day.date}`, {
        method: "POST",
        body: { from },
      });
      setDay(copied);
    });
  }

  /**
   * The one bridge to the game. Runs inside an existing run() call, so it
   * reports through the notice banner and lets errors bubble to that handler.
   */
  async function checkIn(habitId: number, name: string) {
    const result = await api<CheckinResult>("/api/checkins", {
      method: "POST",
      body: { entries: [{ habitId, done: true }] },
    });
    setNotice(
      // A habit answered elsewhere since this page loaded earns nothing here;
      // saying "+0 points" would read like the check-in failed.
      result.earnedPoints === 0
        ? `${name} was already counted for today`
        : `${name} checked in · ${result.earnedPoints > 0 ? "+" : ""}${result.earnedPoints} points`,
    );
    const [fresh] = await Promise.all([
      api<TodayResponse>("/api/checkins/today"),
      refreshUser(),
    ]);
    setToday(fresh);
  }

  if (!user?.plannerEnabled) {
    return <PlannerOff />;
  }

  if (!day) {
    return (
      <div className="flex flex-1 items-center justify-center text-stone-400">Loading…</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4">
      {/* header: the day you are looking at */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Daily plan</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {dayLabel(day.date, day.today)} ·{" "}
            {parseIso(day.date).toLocaleDateString(DATE_LOCALE, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goTo(shiftIso(day.date, -1))}
            aria-label="Previous day"
            className="rounded-lg border border-stone-300 p-2 text-stone-500 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <ChevronLeft size={16} />
          </button>
          {!isToday && (
            <button
              onClick={() => goTo(day.today)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm transition-colors hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
            >
              Today
            </button>
          )}
          <button
            onClick={() => goTo(shiftIso(day.date, 1))}
            aria-label="Next day"
            className="rounded-lg border border-stone-300 p-2 text-stone-500 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {blocks.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(doneCount / blocks.length) * 100}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-stone-500 dark:text-stone-400">
            <span
              className={
                donePercent === 100
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : "font-semibold text-stone-600 dark:text-stone-300"
              }
            >
              {donePercent}%
            </span>{" "}
            {doneCount}/{blocks.length} done
          </span>
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 flex items-center justify-between gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          <span className="flex items-center gap-1.5">
            <Sparkles size={14} /> {notice}
          </span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </p>
      )}

      {blocks.length === 0 ? (
        <EmptyDay
          lastPlannedDate={day.lastPlannedDate}
          today={day.today}
          busy={busy}
          onCopy={copyFrom}
        />
      ) : (
        <ol className="mb-6">
          {slots.map((slot, index) => {
            const previous = slots[index - 1];
            // Each line says when it is FINISHED, so it begins where the one
            // above it ended — and the first line of the day simply has no
            // known start.
            const startsAt = previous ? previous.endMinute : null;
            const length =
              previous === undefined
                ? null
                : position(slot.endMinute) - position(previous.endMinute);
            const current = index === currentIndex;
            const leftOfIt = position(slot.endMinute) - nowPosition;

            return (
              <li key={slot.endMinute}>
                <div className="flex gap-3">
                  {/* when this begins: the end of the line above it */}
                  <div className="w-12 shrink-0 pt-1.5 text-right">
                    <div
                      className={`text-sm font-semibold tabular-nums ${
                        current ? "text-amber-600 dark:text-amber-400" : ""
                      }`}
                    >
                      {startsAt === null ? (
                        <span
                          className="text-stone-300 dark:text-stone-600"
                          title="The first thing on the plan — nothing says when it began"
                        >
                          —
                        </span>
                      ) : (
                        formatMinute(startsAt)
                      )}
                    </div>
                    {length !== null && length > 0 && (
                      <div className="text-[11px] text-stone-400">{formatGap(length)}</div>
                    )}
                    {current && leftOfIt > 0 && (
                      <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        {formatGap(leftOfIt)} left
                      </div>
                    )}
                    {slot.items.length > 1 && (
                      <div className="text-[11px] text-stone-300 dark:text-stone-600">
                        ×{slot.items.length}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {slot.items.map((block, itemIndex) => (
                      <BlockRow
                        key={block.id}
                        block={block}
                        current={current}
                        last={
                          index === slots.length - 1 &&
                          itemIndex === slot.items.length - 1
                        }
                        // Blocks finishing at the same time are drawn as one
                        // stack: square the touching corners and let their
                        // borders overlap into a single divider.
                        attachedAbove={itemIndex > 0}
                        attachedBelow={itemIndex < slot.items.length - 1}
                        habits={habits}
                        entry={entryFor(block.habitId)}
                        editing={editingId === block.id}
                        busy={busy}
                        onToggleDone={() => toggleDone(block)}
                        onEdit={() => setEditingId(block.id)}
                        onCancelEdit={() => setEditingId(null)}
                        onSave={(title, endMinute, habitId) =>
                          saveBlock(block.id, title, endMinute, habitId)
                        }
                        onDelete={() => removeBlock(block.id)}
                      />
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
          {/* Every row is labelled with the end of the row above it, so the
              last line's own finish time needs a closing marker of its own. */}
          <li className="flex gap-3">
            <div className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-stone-400">
              {formatMinute(slots[slots.length - 1].endMinute)}
            </div>
            <div className="flex w-4 shrink-0 justify-center pt-1.5">
              <span className="h-2 w-2 rounded-full border-2 border-stone-300 dark:border-stone-600" />
            </div>
            <div className="text-xs text-stone-400">plan ends</div>
          </li>
          {/* Nothing left to be inside of: now sits past the whole plan. */}
          {isToday && currentIndex === -1 && (
            <li className="mt-1">
              <NowLine minute={nowMinute} />
            </li>
          )}
        </ol>
      )}

      <Composer
        // A new day gets a fresh composer: its suggested time is a first value.
        key={day.date}
        habits={habits}
        today={today}
        isToday={isToday}
        busy={busy}
        suggestedMinute={
          blocks.length === 0
            ? Math.min(DAY_MINUTES - 1, Math.ceil(nowMinute / 5) * 5)
            : Math.min(DAY_MINUTES - 1, blocks[blocks.length - 1].endMinute + 10)
        }
        plannedHabitIds={blocks.map((b) => b.habitId).filter((id): id is number => id !== null)}
        onAdd={addBlock}
      />
    </div>
  );
}

/* ---------- pieces ---------- */

/** Reached with the setting off — explain, then point at the switch. */
function PlannerOff() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 p-4">
      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <ClipboardList size={32} className="mx-auto text-amber-600" />
        <h1 className="mt-3 font-semibold">The daily plan is off</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Turn it on to lay your day out hour by hour and pull habits straight into
          the timeline.
        </p>
        <Link
          href="/settings"
          className="mt-4 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-500"
        >
          Open settings
        </Link>
      </div>
    </div>
  );
}

/** A day with nothing on it yet — and the fastest way out of that. */
function EmptyDay({
  lastPlannedDate,
  today,
  busy,
  onCopy,
}: {
  lastPlannedDate: string | null;
  today: string;
  busy: boolean;
  onCopy: (from: string) => void;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-dashed border-stone-300 p-6 text-center dark:border-stone-700">
      <CalendarDays size={28} className="mx-auto text-stone-300 dark:text-stone-600" />
      <p className="mt-2 font-medium">Nothing planned yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500 dark:text-stone-400">
        Add the first line below — what you are doing and the time it is done. Each
        line runs from the end of the one above it.
      </p>
      <p className="mt-3 font-mono text-xs leading-relaxed text-stone-400">
        (12:00) Planning
        <br />
        (12:10) prayer
        <br />
        (12:20) Write dailies
      </p>
      {lastPlannedDate && (
        <button
          onClick={() => onCopy(lastPlannedDate)}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-sm transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          <Copy size={14} />
          Copy {dayLabel(lastPlannedDate, today).toLowerCase()}&apos;s plan
        </button>
      )}
    </div>
  );
}

/** The amber hairline that says "you are here". */
function NowLine({ minute }: { minute: number }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-12 shrink-0 text-right text-[11px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
        {formatMinute(minute)}
      </span>
      <span className="relative flex w-4 shrink-0 justify-center">
        <span className="h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-amber-400 to-transparent" />
    </div>
  );
}

/** "5 prayers" — the habit a block was picked from. */
function HabitChip({ name, quit }: { name: string; quit: boolean }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-400/15 dark:text-amber-300"
      title={`From your habit "${name}"`}
    >
      {quit ? <Ban size={10} /> : <Sparkles size={10} />}
      {name}
    </span>
  );
}

function BlockRow({
  block,
  current,
  last,
  attachedAbove,
  attachedBelow,
  habits,
  entry,
  editing,
  busy,
  onToggleDone,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  block: PlanBlock;
  current: boolean;
  last: boolean;
  attachedAbove: boolean;
  attachedBelow: boolean;
  habits: Habit[];
  entry: TodayEntry | null;
  editing: boolean;
  busy: boolean;
  onToggleDone: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (title: string, endMinute: number, habitId: number | null) => void;
  onDelete: () => void;
}) {
  const habit = habits.find((h) => h.id === block.habitId) ?? null;
  const checkedIn =
    entry?.todayStatus === "DONE" || entry?.todayStatus === "DONE_TODAY";

  if (editing) {
    return (
      <div className="flex gap-3 pb-3">
        <span className="w-4 shrink-0" />
        <BlockFields
          habits={habits}
          initial={block}
          busy={busy}
          submitLabel="Save"
          onSubmit={onSave}
          onCancel={onCancelEdit}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {/* rail: the dot doubles as the done switch */}
      <div className="flex w-4 shrink-0 flex-col items-center pt-1.5">
        <button
          onClick={onToggleDone}
          disabled={busy}
          aria-label={block.done ? `Undo ${block.title}` : `Mark ${block.title} done`}
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90 ${
            block.done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : current
                ? "border-amber-500 ring-4 ring-amber-500/15"
                : "border-stone-300 hover:border-stone-400 dark:border-stone-600"
          }`}
        >
          {block.done && <Check size={10} strokeWidth={3.5} />}
        </button>
        {!last && <span className="mt-1 w-px flex-1 bg-stone-200 dark:bg-stone-800" />}
      </div>

      {/* the block itself */}
      <div
        className={`group min-w-0 flex-1 border px-3 py-2 transition-colors ${
          attachedBelow ? "rounded-b-none" : "mb-2 rounded-b-xl"
        } ${
          // -mt-px folds the two borders into one hairline divider
          attachedAbove ? "-mt-px rounded-t-none" : "rounded-t-xl"
        } ${
          current
            ? "border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-400/10"
            : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
        } ${block.done ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-medium ${
                block.done ? "text-stone-400 line-through dark:text-stone-500" : ""
              }`}
            >
              {block.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {block.habitName && (
                <HabitChip
                  name={block.habitName}
                  quit={habit?.habitType === "QUIT"}
                />
              )}
              {checkedIn && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300">
                  <Check size={10} /> checked in
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <button
              onClick={onEdit}
              aria-label={`Edit ${block.title}`}
              className="rounded-md p-1.5 text-stone-300 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onDelete}
              disabled={busy}
              aria-label={`Delete ${block.title}`}
              className="rounded-md p-1.5 text-stone-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:text-stone-600 dark:hover:bg-red-950/40"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/** The time + title + habit trio, shared by the composer and inline editing. */
function BlockFields({
  habits,
  initial,
  busy,
  submitLabel,
  suggestedMinute,
  plannedHabitIds,
  today,
  isToday,
  onSubmit,
  onCancel,
}: {
  habits: Habit[];
  initial?: PlanBlock;
  busy: boolean;
  submitLabel: string;
  suggestedMinute?: number;
  plannedHabitIds?: number[];
  today?: TodayResponse | null;
  isToday?: boolean;
  onSubmit: (title: string, endMinute: number, habitId: number | null) => void;
  onCancel?: () => void;
}) {
  const [time, setTime] = useState(
    formatMinute(initial?.endMinute ?? suggestedMinute ?? 8 * 60),
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [habitId, setHabitId] = useState<number | null>(initial?.habitId ?? null);

  // Locked habits are not doable yet, so they never belong in a day's plan.
  const pickable = habits.filter((h) => h.status !== "LOCKED");
  const minute = parseMinute(time);
  const valid = title.trim().length > 0 && minute !== null;

  /** Picking a habit fills the line for you; picking it again unlinks it. */
  function pickHabit(habit: Habit) {
    if (habitId === habit.id) {
      setHabitId(null);
      return;
    }
    setHabitId(habit.id);
    if (!title.trim() || habits.some((h) => h.name === title.trim())) {
      setTitle(habit.name);
    }
  }

  function submit() {
    if (!valid || minute === null) return;
    onSubmit(title.trim(), minute, habitId);
    if (!initial) {
      setTitle("");
      setHabitId(null);
      setTime(formatMinute(Math.min(DAY_MINUTES - 1, minute + 10)));
    }
  }

  const pendingIds = new Set(
    isToday
      ? (today?.entries ?? [])
          .filter((e) => e.todayStatus === "PENDING")
          .map((e) => e.habitId)
      : [],
  );

  return (
    <div className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="flex gap-2">
        <div className="shrink-0">
          <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-stone-400">
            Done at
          </span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="The time this is finished"
            className="w-28 rounded-lg border border-stone-300 px-2 py-2 text-sm tabular-nums focus:border-amber-500 focus:outline-none dark:border-stone-700 dark:bg-stone-900"
          />
        </div>
        <div className="min-w-0 flex-1">
          <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-stone-400">
            What
          </span>
          <input
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") onCancel?.();
            }}
            placeholder="Finished doing what?"
            aria-label="What is finished by then"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none dark:border-stone-700 dark:bg-stone-900"
          />
        </div>
      </div>

      {pickable.length > 0 && (
        <div className="mt-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
            Or pick a habit
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {pickable.map((habit) => {
              const on = habitId === habit.id;
              const alreadyPlanned = plannedHabitIds?.includes(habit.id) ?? false;
              return (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => pickHabit(habit)}
                  title={
                    alreadyPlanned ? "Already in this day's plan" : `Plan "${habit.name}"`
                  }
                  className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    on
                      ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200"
                      : "border-stone-300 text-stone-500 hover:border-stone-400 dark:border-stone-700 dark:text-stone-400"
                  } ${alreadyPlanned && !on ? "opacity-50" : ""}`}
                >
                  {habit.habitType === "QUIT" && <Ban size={10} className="text-red-500" />}
                  {on ? "✓ " : ""}
                  {habit.name}
                  {pendingIds.has(habit.id) && !on && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                      title="Still unanswered today"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={busy || !valid}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-500 active:scale-[0.99] disabled:opacity-50"
        >
          {initial ? null : <Plus size={15} />}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm transition-colors hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/** The always-present "add a line" card at the foot of the timeline. */
function Composer({
  habits,
  today,
  isToday,
  busy,
  suggestedMinute,
  plannedHabitIds,
  onAdd,
}: {
  habits: Habit[];
  today: TodayResponse | null;
  isToday: boolean;
  busy: boolean;
  suggestedMinute: number;
  plannedHabitIds: number[];
  onAdd: (title: string, endMinute: number, habitId: number | null) => void;
}) {
  return (
    <div className="flex gap-3">
      <span className="w-12 shrink-0" />
      <div className="flex w-4 shrink-0 justify-center pt-4">
        <Plus size={14} className="text-stone-300 dark:text-stone-600" />
      </div>
      <BlockFields
        habits={habits}
        busy={busy}
        submitLabel="Add block"
        suggestedMinute={suggestedMinute}
        plannedHabitIds={plannedHabitIds}
        today={today}
        isToday={isToday}
        onSubmit={onAdd}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <PlanPage />
    </RequireAuth>
  );
}
