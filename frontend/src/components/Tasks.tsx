"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Check, Plus, Tag } from "lucide-react";
import { api } from "@/lib/api";
import {
  MAX_TAGS,
  MAX_TAGS_PER_TASK,
  TAG_COLORS,
  type TagColor,
  type Task,
  type TaskList,
  type TaskTag,
} from "@/lib/types";

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
 * Each palette name spelled out in full so Tailwind sees the classes:
 * a soft chip for the label, a solid dot for swatches and filters.
 */
export const TAG_STYLES: Record<TagColor, { chip: string; dot: string }> = {
  gray: {
    chip: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
    dot: "bg-stone-400",
  },
  red: { chip: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300", dot: "bg-red-500" },
  orange: {
    chip: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  amber: {
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    dot: "bg-amber-400",
  },
  green: {
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  teal: {
    chip: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  sky: { chip: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300", dot: "bg-sky-500" },
  indigo: {
    chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  violet: {
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  pink: {
    chip: "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300",
    dot: "bg-pink-500",
  },
};

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

  const add = (title: string, dueDate: string | null, tagIds: number[] = []) =>
    attempt(() =>
      api<Task>("/api/tasks", { method: "POST", body: { title, dueDate, tagIds } }),
    );

  const update = (id: number, title: string, dueDate: string | null, tagIds: number[]) =>
    attempt(() =>
      api<Task>(`/api/tasks/${id}`, { method: "PUT", body: { title, dueDate, tagIds } }),
    );

  /** Resolves to the new tag, so a picker can select it straight away. */
  async function addTag(name: string, color: TagColor): Promise<TaskTag | null> {
    const made: { tag: TaskTag | null } = { tag: null };
    await attempt(async () => {
      made.tag = await api<TaskTag>("/api/tasks/tags", {
        method: "POST",
        body: { name, color },
      });
    });
    return made.tag;
  }

  const updateTag = (id: number, name: string, color: TagColor) =>
    attempt(() =>
      api<TaskTag>(`/api/tasks/tags/${id}`, { method: "PUT", body: { name, color } }),
    );

  const removeTag = (id: number) =>
    attempt(() => api(`/api/tasks/tags/${id}`, { method: "DELETE" }));

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

  return {
    list,
    error,
    setError,
    reload,
    add,
    update,
    remove,
    clearDone,
    toggleDone,
    addTag,
    updateTag,
    removeTag,
  };
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
        {(task.tags.length > 0 || (task.dueDate && !task.done)) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {task.dueDate && !task.done && <DueChip due={task.dueDate} today={today} />}
            {task.tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** A tag as a small coloured label. */
export function TagChip({ tag, className = "" }: { tag: TaskTag; className?: string }) {
  return (
    <span
      className={`inline-flex max-w-40 items-center rounded-full px-2 py-px text-[11px] font-medium ${TAG_STYLES[tag.color].chip} ${className}`}
    >
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

/** The palette as a row of round swatches, the chosen one ringed. */
export function TagColorSwatches({
  value,
  onChange,
}: {
  value: TagColor;
  onChange: (color: TagColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tag colour">
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          title={color}
          onClick={() => onChange(color)}
          className={`h-5 w-5 rounded-full transition-transform active:scale-90 ${TAG_STYLES[color].dot} ${
            value === color
              ? "ring-2 ring-ink ring-offset-2 ring-offset-surface"
              : "hover:scale-110"
          }`}
        />
      ))}
    </div>
  );
}

/** A colour for the next tag: the first one not used yet, so tags stay apart. */
export function nextTagColor(tags: TaskTag[]): TagColor {
  const used = new Set(tags.map((t) => t.color));
  return TAG_COLORS.find((c) => c !== "gray" && !used.has(c)) ?? "gray";
}

/**
 * Picks a task's tags: every existing tag as a toggle, then a small form to
 * make a new one (which is selected as soon as it exists).
 */
export function TagPicker({
  tags,
  selected,
  onChange,
  onCreate,
}: {
  tags: TaskTag[];
  selected: number[];
  onChange: (ids: number[]) => void;
  onCreate: (name: string, color: TagColor) => Promise<TaskTag | null>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>(() => nextTagColor(tags));
  const [busy, setBusy] = useState(false);
  const full = selected.length >= MAX_TAGS_PER_TASK;

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const tag = await onCreate(trimmed, color);
    setBusy(false);
    if (!tag) return;
    if (!full) onChange([...selected, tag.id]);
    setName("");
    setColor(nextTagColor([...tags, tag]));
    setCreating(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => {
          const on = selected.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => toggle(tag.id)}
              className={`inline-flex max-w-40 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-all disabled:opacity-40 ${
                on
                  ? `${TAG_STYLES[tag.color].chip} ring-1 ring-current`
                  : "text-ink-soft ring-1 ring-line-strong hover:text-ink"
              }`}
            >
              {on ? (
                <Check size={11} strokeWidth={3} />
              ) : (
                <span className={`h-2 w-2 shrink-0 rounded-full ${TAG_STYLES[tag.color].dot}`} />
              )}
              <span className="truncate">{tag.name}</span>
            </button>
          );
        })}
        {!creating && tags.length < MAX_TAGS && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border border-dashed border-line-strong text-ink-soft hover:text-ink"
          >
            <Plus size={11} />
            New tag
          </button>
        )}
      </div>
      {creating && (
        <div className="space-y-2 rounded-lg bg-surface-sunken p-2">
          <div className="flex gap-2">
            <input
              value={name}
              maxLength={24}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  void create();
                }
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setCreating(false);
                }
              }}
              placeholder="Tag name"
              aria-label="New tag name"
              className="field min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={() => void create()}
              disabled={busy || !name.trim()}
              className="btn btn-primary shrink-0 px-3"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="btn btn-ghost shrink-0 px-3"
            >
              Cancel
            </button>
          </div>
          <TagColorSwatches value={color} onChange={setColor} />
        </div>
      )}
    </div>
  );
}

/** The icon button that opens a tag picker, with how many are chosen. */
export function TagToggle({
  open,
  count,
  onClick,
}: {
  open: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label="Tags"
      title="Tags"
      className={`btn shrink-0 px-2.5 ${open || count > 0 ? "btn-ghost text-ink" : "btn-ghost text-ink-faint"}`}
    >
      <Tag size={15} />
      {count > 0 && <span className="text-xs tabular-nums">{count}</span>}
    </button>
  );
}
