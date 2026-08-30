"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
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
  type PlanShiftResult,
  type TodayEntry,
  type TodayResponse,
} from "@/lib/types";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  ListChecks,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader, PageShell } from "@/components/ui/Page";
import { HabitPicker } from "@/components/ui/HabitPicker";
import { Skeleton } from "@/components/ui/Skeleton";

const DAY_MINUTES = 24 * 60;

/** The amounts a day usually slips by, one tap each. */
const SHIFT_PRESETS = [5, 10, 15, 30, 60];
const MIN_SHIFT = 1;
const MAX_SHIFT = 12 * 60;

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

/**
 * What to say after a shift. The day has edges, so the amount that landed can
 * be smaller than the one asked for — and saying "moved 1h later" when it
 * moved 20 minutes would be a lie the timeline immediately contradicts.
 */
function shiftNotice(count: number, asked: number, applied: number): string {
  const lines = `${count} line${count === 1 ? "" : "s"}`;
  if (applied === 0) {
    return `Nothing to move — ${lines} already sit at the edge of your day`;
  }
  const direction = applied < 0 ? "earlier" : "later";
  const trimmed = Math.abs(applied) < Math.abs(asked) ? " — the day ends there" : "";
  return `${lines} moved ${formatGap(Math.abs(applied))} ${direction}${trimmed}`;
}

/* ---------- the page ---------- */

function PlanPage() {
  const { user, refreshUser } = useAuth();

  const [day, setDay] = useState<PlanDay | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Shifting is a mode: the rows stop being editable and start being pickable.
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [shiftAmount, setShiftAmount] = useState(60);
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

  /** A selection belongs to the day it was made on — leaving the day drops it. */
  function stopSelecting() {
    setSelecting(false);
    setSelectedIds(new Set());
  }

  const goTo = (date: string) => {
    stopSelecting();
    return run(() => load(date));
  };

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

  function toggleSelected(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /**
   * The whole point of the page's selection mode: you woke up late, the same
   * lines still have to happen, they just happen later. Every picked line
   * moves by the same amount, so the day keeps its shape — and the server
   * says how much of the asked-for shift actually fit inside the day.
   */
  async function shiftSelected(delta: number) {
    if (!day) return;
    // Blocks the day no longer has (deleted elsewhere) must not be sent.
    const ids = blocks.filter((b) => selectedIds.has(b.id)).map((b) => b.id);
    if (ids.length === 0) return;
    await run(async () => {
      const result = await api<PlanShiftResult>("/api/plan/shift", {
        method: "POST",
        body: { blockIds: ids, deltaMinutes: delta },
      });
      setDay(result.day);
      setNotice(shiftNotice(ids.length, delta, result.appliedMinutes));
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

  if (!day) return <PlanSkeleton />;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Daily plan"
        subtitle={`${dayLabel(day.date, day.today)} · ${parseIso(day.date).toLocaleDateString(
          DATE_LOCALE,
          { weekday: "long", day: "numeric", month: "long" },
        )}`}
        actions={
          <>
            {/* Stepping one day at a time is fine for tomorrow and hopeless
                for next month — the date field jumps straight there. */}
            <input
              type="date"
              value={day.date}
              onChange={(e) => e.target.value && goTo(e.target.value)}
              aria-label="Jump to a day"
              className="field hidden w-auto py-2 text-xs tabular-nums sm:block"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={() => goTo(shiftIso(day.date, -1))}
                aria-label="Previous day"
                className="btn-icon border border-line-strong"
              >
                <ChevronLeft size={16} />
              </button>
              {!isToday && (
                <button onClick={() => goTo(day.today)} className="btn btn-ghost h-9 min-h-0 px-3">
                  Today
                </button>
              )}
              <button
                onClick={() => goTo(shiftIso(day.date, 1))}
                aria-label="Next day"
                className="btn-icon border border-line-strong"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        }
      />

      {blocks.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(doneCount / blocks.length) * 100}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-ink-soft">
            <span
              className={
                donePercent === 100
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : "font-semibold text-ink-soft"
              }
            >
              {donePercent}%
            </span>{" "}
            {doneCount}/{blocks.length} done
          </span>
          {!selecting && (
            <button
              onClick={() => {
                setEditingId(null);
                setSelecting(true);
              }}
              className="btn btn-ghost h-8 min-h-0 shrink-0 px-2.5 text-xs"
              title="Pick lines and move them all earlier or later"
            >
              <ListChecks size={14} />
              <span className="hidden sm:inline">Shift times</span>
            </button>
          )}
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

      {/* On a wide screen the composer stops chasing the bottom of the
          timeline and parks in a column of its own instead. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
        <div className="min-w-0">
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
              // The time beside a line is the one that was typed for it: when it
              // is FINISHED. Its length comes from the line above — and the first
              // line of the day has none, its start being unknown.
              const length =
                previous === undefined
                  ? null
                  : position(slot.endMinute) - position(previous.endMinute);
              const current = index === currentIndex;
              const leftOfIt = position(slot.endMinute) - nowPosition;

              return (
                <li key={slot.endMinute}>
                  <div className="flex gap-3">
                    {/* the time this is done by — exactly what was typed */}
                    <div className="w-12 shrink-0 pt-1.5 text-right">
                      <div
                        className={`text-sm font-semibold tabular-nums ${
                          current ? "text-amber-600 dark:text-amber-400" : ""
                        }`}
                      >
                        {formatMinute(slot.endMinute)}
                      </div>
                      {length !== null && length > 0 && (
                        <div className="text-[11px] text-ink-faint">{formatGap(length)}</div>
                      )}
                      {current && leftOfIt > 0 && (
                        <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          {formatGap(leftOfIt)} left
                        </div>
                      )}
                      {slot.items.length > 1 && (
                        <div className="text-[11px] text-ink-faint">
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
                          selecting={selecting}
                          selected={selectedIds.has(block.id)}
                          onToggleSelect={() => toggleSelected(block.id)}
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
            {/* Nothing left to be inside of: now sits past the whole plan. */}
            {isToday && currentIndex === -1 && (
              <li className="mt-1">
                <NowLine minute={nowMinute} />
              </li>
            )}
          </ol>
        )}

        {selecting && (
          <ShiftBar
            selectedCount={selectedIds.size}
            totalCount={blocks.length}
            amount={shiftAmount}
            busy={busy}
            onAmount={setShiftAmount}
            onSelectAll={() => setSelectedIds(new Set(blocks.map((b) => b.id)))}
            onClear={() => setSelectedIds(new Set())}
            onShift={shiftSelected}
            onDone={stopSelecting}
          />
        )}
        </div>

        {/* Shift mode is about moving what is already there, and its panel
            floats over the foot of the page — the composer would only sit
            under it with its buttons out of reach. */}
        {!selecting && (
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
          plannedHabitIds={blocks
            .map((b) => b.habitId)
            .filter((id): id is number => id !== null)}
          onAdd={addBlock}
        />
        )}
      </div>
    </PageShell>
  );
}

/** The plan page while its first fetch is in flight. */
function PlanSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6" role="status" aria-label="Loading">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-56" />
      <div className="mt-5 space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-10 w-12 shrink-0" />
            <Skeleton className="h-10 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- pieces ---------- */

/** Reached with the setting off — explain, then point at the switch. */
function PlannerOff() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 p-4">
      <div className="card mt-8 p-6 text-center">
        <ClipboardList size={32} className="mx-auto text-amber-600" />
        <h1 className="mt-3 font-semibold">The daily plan is off</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Turn it on to lay your day out hour by hour and pull habits straight into
          the timeline.
        </p>
        <Link href="/settings" className="btn btn-primary mt-4">
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
    <div className="mb-6 rounded-2xl border border-dashed border-line-strong p-6 text-center">
      <CalendarDays size={28} className="mx-auto text-ink-faint" />
      <p className="mt-2 font-medium">Nothing planned yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
        Add the first line below — what you are doing and the time it is done. Each
        line runs from the end of the one above it.
      </p>
      <p className="mt-3 font-mono text-xs leading-relaxed text-ink-faint">
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
          className="btn btn-ghost mt-4"
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
  selecting,
  selected,
  busy,
  onToggleDone,
  onToggleSelect,
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
  /** Shift mode: the whole row becomes one big pick-me button. */
  selecting: boolean;
  selected: boolean;
  busy: boolean;
  onToggleDone: () => void;
  onToggleSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (title: string, endMinute: number, habitId: number | null) => void;
  onDelete: () => void;
}) {
  const habit = habits.find((h) => h.id === block.habitId) ?? null;
  const checkedIn =
    entry?.todayStatus === "DONE" || entry?.todayStatus === "DONE_TODAY";

  // In shift mode the card itself is the control, so it has to be a button —
  // which also means nothing else inside it may be one.
  const Card: ElementType = selecting ? "button" : "div";

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
      {/* rail: the dot doubles as the done switch — or, in shift mode, as the
          tick box the whole card toggles */}
      <div className="flex w-4 shrink-0 flex-col items-center pt-1.5">
        {selecting ? (
          <span
            aria-hidden
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
              selected
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-line-strong"
            }`}
          >
            {selected && <Check size={10} strokeWidth={3.5} />}
          </span>
        ) : (
          <button
            onClick={onToggleDone}
            disabled={busy}
            aria-label={block.done ? `Undo ${block.title}` : `Mark ${block.title} done`}
            className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90 ${
              block.done
                ? "border-emerald-500 bg-emerald-500 text-white"
                : current
                  ? "border-amber-500 ring-4 ring-amber-500/15"
                  : "border-line-strong hover:border-ink-faint"
            }`}
          >
            {/* A 16px dot is the right SIZE and the wrong TARGET — a thumb
                misses it. This invisible pad grows the tap area to 40px
                without moving the dot: it stops at the card's left edge
                (the rail's 12px gap), so nothing else loses a click. */}
            <span aria-hidden className="absolute -inset-3" />
            {block.done && <Check size={10} strokeWidth={3.5} />}
          </button>
        )}
        {!last && <span className="mt-1 w-px flex-1 bg-line" />}
      </div>

      {/* the block itself */}
      <Card
        {...(selecting
          ? {
              type: "button",
              onClick: onToggleSelect,
              "aria-pressed": selected,
              disabled: busy,
            }
          : {})}
        className={`group min-w-0 flex-1 border px-3 py-2 text-left transition-colors ${
          attachedBelow ? "rounded-b-none" : "mb-2 rounded-b-xl"
        } ${
          // -mt-px folds the two borders into one hairline divider
          attachedAbove ? "-mt-px rounded-t-none" : "rounded-t-xl"
        } ${
          selecting && selected
            ? "border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-400/15"
            : current
              ? "border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-400/10"
              : "border-line bg-surface"
        } ${selecting ? "cursor-pointer hover:border-amber-300" : ""} ${
          block.done ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-medium ${
                block.done ? "text-ink-faint line-through" : ""
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
          {!selecting && (
            <div className="flex shrink-0 gap-0.5">
              <button
                onClick={onEdit}
                aria-label={`Edit ${block.title}`}
                className="btn-icon h-8 w-8"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={onDelete}
                disabled={busy}
                aria-label={`Delete ${block.title}`}
                className="btn-icon h-8 w-8 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-950/40"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

      </Card>
    </div>
  );
}

/**
 * Shift mode's control panel. It rides the bottom of the screen so picking a
 * line at the foot of a long plan never means scrolling back up to move it.
 */
function ShiftBar({
  selectedCount,
  totalCount,
  amount,
  busy,
  onAmount,
  onSelectAll,
  onClear,
  onShift,
  onDone,
}: {
  selectedCount: number;
  totalCount: number;
  amount: number;
  busy: boolean;
  onAmount: (minutes: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onShift: (delta: number) => void;
  onDone: () => void;
}) {
  const valid = amount >= MIN_SHIFT && amount <= MAX_SHIFT;
  const ready = valid && selectedCount > 0 && !busy;

  return (
    // On phones the tab bar owns the bottom of the screen, so the panel
    // parks just above it.
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mb-2 sm:bottom-3">
      <div className="card border-amber-300 p-3 shadow-lg dark:border-amber-500/40">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {selectedCount === 0
              ? "Pick the lines to move"
              : `${selectedCount} of ${totalCount} picked`}
          </span>
          <button
            onClick={selectedCount === totalCount ? onClear : onSelectAll}
            className="btn btn-ghost h-7 min-h-0 px-2 text-xs"
          >
            {selectedCount === totalCount ? "Clear" : "Select all"}
          </button>
          <span className="flex-1" />
          <button onClick={onDone} className="btn-icon h-7 w-7" aria-label="Leave shift mode">
            <X size={15} />
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="field-label mr-0.5">By</span>
          {SHIFT_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => onAmount(preset)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
                amount === preset
                  ? "bg-amber-500 text-white"
                  : "bg-surface-sunken text-ink-soft hover:text-ink"
              }`}
            >
              {formatGap(preset)}
            </button>
          ))}
          {/* Anything the presets don't cover — "we're running 47 late". */}
          <input
            type="number"
            min={MIN_SHIFT}
            max={MAX_SHIFT}
            step={5}
            value={amount}
            onChange={(e) => onAmount(Number(e.target.value))}
            aria-label="Minutes to move by"
            className="field w-20 py-1 text-xs tabular-nums"
          />
          <span className="text-xs text-ink-faint">min</span>
        </div>

        <div className="mt-2.5 flex gap-2">
          <button
            onClick={() => onShift(-amount)}
            disabled={!ready}
            className="btn btn-ghost flex-1 border border-line-strong"
          >
            <ArrowUp size={15} />
            Earlier
          </button>
          <button
            onClick={() => onShift(amount)}
            disabled={!ready}
            className="btn btn-primary flex-1"
          >
            <ArrowDown size={15} />
            Later
          </button>
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
    <div className="card min-w-0 flex-1 p-3">
      <div className="flex gap-2">
        <div className="shrink-0">
          <span className="field-label mb-0.5">Done at</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="The time this is finished"
            className="field w-28 tabular-nums"
          />
        </div>
        <div className="min-w-0 flex-1">
          <span className="field-label mb-0.5">What</span>
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
            className="field"
          />
        </div>
      </div>

      {pickable.length > 0 && (
        <div className="mt-2.5 space-y-1">
          <span className="field-label">Or pick a habit</span>
          <HabitPicker
            habits={pickable}
            selectedIds={habitId === null ? [] : [habitId]}
            onToggle={pickHabit}
            ariaLabel="Habits you can plan"
            placeholder="Search a habit to plan…"
            dimmed={(habit) => plannedHabitIds?.includes(habit.id) ?? false}
            meta={(habit) =>
              pendingIds.has(habit.id) && habitId !== habit.id ? (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                  title="Still unanswered today"
                />
              ) : null
            }
          />
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={busy || !valid}
          className="btn btn-primary flex-1"
        >
          {initial ? null : <Plus size={15} />}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="btn btn-ghost"
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
    <div className="mt-2 flex gap-3 lg:mt-0 lg:block lg:sticky lg:top-20">
      {/* the timeline rail, which only exists in the single-column layout */}
      <span className="w-12 shrink-0 lg:hidden" />
      <div className="flex w-4 shrink-0 justify-center pt-4 lg:hidden">
        <Plus size={14} className="text-ink-faint" />
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
