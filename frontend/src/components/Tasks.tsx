"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Check, Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { Task, TaskList } from "@/lib/types";

/** Same rule as the plan page: dates in the app's language, not the browser's. */
const DATE_LOCALE = "en-GB";

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * "Overdue · 2 days", "Today", "Tomorrow", else "Thu 30 Oct" — what a
 * deadline means from where the user stands, plus whether it is late.
 */
export function dueLabel(due: string, today: string): { text: string; late: boolean } {
  const delta = Math.round((parseIso(due).getTime() - parseIso(today).getTime()) / 86_400_000);
  if (delta < 0) {
    return { text: `Overdue · ${-delta} day${delta === -1 ? "" : "s"}`, late: true };
  }
  if (delta === 0) return { text: "Today", late: false };
  if (delta === 1) return { text: "Tomorrow", late: false };
  return {
    text: parseIso(due).toLocaleDateString(DATE_LOCALE, {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    late: false,
  };
}

/**
 * The tasks list and every way to change it, shared by the tasks page and
 * the plan's side panel. Ticking is optimistic — it lands on screen first and
 * only bounces back if the server refuses it.
 */
export function useTasks(enabled: boolean) {
  const [list, setList] = useState<TaskList | null>(null);
  const [error, setError] = useState<string | null>(null);

  // setState only inside the promise callbacks (react-hooks/set-state-in-effect).
  const reload = useCallback(
    () =>
      api<TaskList>("/api/tasks")
        .then(setList)
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : "Could not load your tasks"),
        ),
    [],
  );

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  async function attempt(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await reload();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    }
  }

  const add = (title: string, dueDate: string | null) =>
    attempt(() => api<Task>("/api/tasks", { method: "POST", body: { title, dueDate } }));

  const update = (id: number, title: string, dueDate: string | null) =>
    attempt(() => api<Task>(`/api/tasks/${id}`, { method: "PUT", body: { title, dueDate } }));

  const remove = (id: number) =>
    attempt(() => api(`/api/tasks/${id}`, { method: "DELETE" }));

  const clearDone = () => attempt(() => api("/api/tasks/done", { method: "DELETE" }));

  async function toggleDone(task: Task) {
    const done = !task.done;
    // Move it across at once: open ↔ done, the way it will come back.
    setList((current) => {
      if (!current) return current;
      const moved = { ...task, done };
      return done
        ? {
            ...current,
            open: current.open.filter((t) => t.id !== task.id),
            done: [moved, ...current.done],
          }
        : {
            ...current,
            open: [...current.open, moved],
            done: current.done.filter((t) => t.id !== task.id),
          };
    });
    const ok = await attempt(() =>
      api<Task>(`/api/tasks/${task.id}/done`, { method: "PUT", body: { done } }),
    );
    if (!ok) await reload();
  }

  return { list, error, setError, reload, add, update, remove, clearDone, toggleDone };
}

/** One line: title in, optional deadline, Enter adds it. */
export function TaskQuickAdd({
  onAdd,
  compact = false,
  autoFocus = false,
}: {
  onAdd: (title: string, dueDate: string | null) => Promise<boolean>;
  /** The plan's side panel: no date field, just the title. */
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const ok = await onAdd(trimmed, dueDate || null);
    setBusy(false);
    if (ok) {
      setTitle("");
      setDueDate("");
    }
  }

  return (
    <div className="flex gap-2">
      <input
        value={title}
        maxLength={120}
        autoFocus={autoFocus}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        placeholder="Something to get done…"
        aria-label="New task"
        className="field min-w-0 flex-1"
      />
      {!compact && (
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Due by (optional)"
          title="Due by (optional)"
          className="field w-auto shrink-0 tabular-nums"
        />
      )}
      <button
        onClick={() => void submit()}
        disabled={busy || !title.trim()}
        aria-label="Add task"
        className="btn btn-primary shrink-0 px-3"
      >
        <Plus size={15} />
        {!compact && <span className="hidden sm:inline">Add</span>}
      </button>
    </div>
  );
}

/** The round tick box a task is finished with. */
export function TaskCheck({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={task.done ? `Put ${task.title} back on the list` : `Mark ${task.title} done`}
      className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90 ${
        task.done
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-line-strong hover:border-ink-faint"
      }`}
    >
      {/* grows the tap area to 40px without moving the box */}
      <span aria-hidden className="absolute -inset-2.5" />
      {task.done && <Check size={12} strokeWidth={3.5} />}
    </button>
  );
}

/** The deadline chip — red once it has passed. */
export function DueChip({ due, today }: { due: string; today: string }) {
  const { text, late } = dueLabel(due, today);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-medium tabular-nums ${
        late ? "text-red-600 dark:text-red-400" : "text-ink-faint"
      }`}
    >
      <CalendarDays size={11} />
      {text}
    </span>
  );
}

/** A task line with a tick box on the left and whatever actions on the right. */
export function TaskRow({
  task,
  today,
  onToggle,
  dimmed = false,
  children,
}: {
  task: Task;
  today: string;
  onToggle: () => void;
  /** Drawn back without being disabled — e.g. already on today's plan. */
  dimmed?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 py-2 ${dimmed ? "opacity-55" : ""}`}>
      <TaskCheck task={task} onToggle={onToggle} />
      <div className="min-w-0 flex-1">
        <div
          className={`break-words text-sm ${
            task.done ? "text-ink-faint line-through" : "font-medium"
          }`}
        >
          {task.title}
        </div>
        {task.dueDate && !task.done && <DueChip due={task.dueDate} today={today} />}
      </div>
      {children}
    </div>
  );
}
