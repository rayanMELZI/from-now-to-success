"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Check, Plus, Tag, X } from "lucide-react";
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

  /**
   * Retags a saved task straight from its row: shown at once, sent with its
   * title and deadline unchanged, and only reloaded if the server refuses.
   */
  async function setTags(task: Task, tagIds: number[]) {
    setError(null);
    setList((current) =>
      current && {
        ...current,
        open: current.open.map((t) =>
          t.id === task.id ? { ...t, tags: current.tags.filter((g) => tagIds.includes(g.id)) } : t,
        ),
      },
    );
    try {
      await api<Task>(`/api/tasks/${task.id}`, {
        method: "PUT",
        body: { title: task.title, dueDate: task.dueDate, tagIds },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change its tags");
      await reload();
    }
  }

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
    setTags,
    addTag,
    updateTag,
    removeTag,
  };
}

/** One line: title in, optional deadline and tags, Enter adds it. */
export function TaskQuickAdd({
  onAdd,
  tags,
  onCreateTag,
  compact = false,
  autoFocus = false,
}: {
  onAdd: (title: string, dueDate: string | null, tagIds: number[]) => Promise<boolean>;
  /** With both of these the tags button appears (never in compact mode). */
  tags?: TaskTag[];
  onCreateTag?: (name: string, color: TagColor) => Promise<TaskTag | null>;
  /** The plan's side panel: no date field, just the title. */
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const withTags = !compact && tags !== undefined && onCreateTag !== undefined;

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    // A tag deleted meanwhile would be dropped by the server anyway.
    const ok = await onAdd(
      trimmed,
      dueDate || null,
      tagIds.filter((id) => tags?.some((t) => t.id === id)),
    );
    setBusy(false);
    if (ok) {
      setTitle("");
      setDueDate("");
      setTagIds([]);
    }
  }

  return (
    <div>
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
        {withTags && (
          <TagMenuButton
            tags={tags}
            selected={tagIds}
            onChange={setTagIds}
            onCreate={onCreateTag}
            label="Tag it"
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
      {withTags && tagIds.length > 0 && (
        <div className="mt-2">
          <ChosenTags tags={tags} selected={tagIds} onChange={setTagIds} />
        </div>
      )}
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
 * The tags a user can choose from, as a checklist: an empty box for "not on
 * it", a ticked one for "on it" — nothing can be mistaken for already chosen.
 * Typing filters the list; Enter applies the match, or makes the tag.
 */
function TagMenu({
  tags,
  selected,
  onToggle,
  onCreate,
  onClose,
}: {
  tags: TaskTag[];
  selected: number[];
  onToggle: (id: number) => void;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const shown = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  const exact = tags.find((t) => t.name.toLowerCase() === q);
  const full = selected.length >= MAX_TAGS_PER_TASK;
  const canCreate = q.length > 0 && !exact && tags.length < MAX_TAGS && !full;

  // Clicks anywhere else close it, like any menu.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);

  async function create() {
    if (!canCreate || busy) return;
    setBusy(true);
    await onCreate(query.trim());
    setBusy(false);
    setQuery("");
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-30 mt-1 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-lg"
    >
      <input
        value={query}
        maxLength={24}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            if (exact) {
              if (selected.includes(exact.id) || !full) onToggle(exact.id);
              setQuery("");
            } else void create();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
        placeholder={tags.length > 0 ? "Find or make a tag…" : "Name your first tag…"}
        aria-label="Find or make a tag"
        className="field h-9 text-sm"
      />
      <ul className="mt-1 max-h-56 overflow-y-auto" role="listbox" aria-multiselectable="true">
        {shown.map((tag) => {
          const on = selected.includes(tag.id);
          return (
            <li key={tag.id}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                disabled={!on && full}
                onClick={() => onToggle(tag.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-sunken disabled:opacity-40"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    on ? "border-ink bg-ink text-surface" : "border-line-strong"
                  }`}
                >
                  {on && <Check size={11} strokeWidth={3.5} />}
                </span>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TAG_STYLES[tag.color].dot}`} />
                <span className="min-w-0 flex-1 truncate">{tag.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {canCreate && (
        <button
          type="button"
          onClick={() => void create()}
          disabled={busy}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink-soft hover:bg-surface-sunken"
        >
          <Plus size={14} className="shrink-0" />
          <span className="min-w-0 truncate">
            Make <span className="font-medium text-ink">“{query.trim()}”</span>
          </span>
        </button>
      )}
      {shown.length === 0 && !canCreate && (
        <p className="px-2 py-1.5 text-xs text-ink-faint">
          {full ? `${MAX_TAGS_PER_TASK} tags at most per task.` : "No tag by that name."}
        </p>
      )}
      {full && shown.length > 0 && (
        <p className="px-2 pt-1 text-[11px] text-ink-faint">
          {MAX_TAGS_PER_TASK} tags at most per task.
        </p>
      )}
    </div>
  );
}

/**
 * A button that opens the tag checklist. Each tick is handed straight to
 * onChange, so on a saved task it applies at once — no form to submit.
 */
export function TagMenuButton({
  tags,
  selected,
  onChange,
  onCreate,
  label = "Tags",
  className = "btn btn-ghost shrink-0 px-2.5",
}: {
  tags: TaskTag[];
  selected: number[];
  onChange: (ids: number[]) => void;
  onCreate: (name: string, color: TagColor) => Promise<TaskTag | null>;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  async function create(name: string) {
    const tag = await onCreate(name, nextTagColor(tags));
    if (tag) onChange([...selected, tag.id]);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        title={label}
        className={className}
      >
        <Tag size={15} />
      </button>
      {open && (
        <TagMenu
          tags={tags}
          selected={selected}
          onToggle={toggle}
          onCreate={create}
          onClose={close}
        />
      )}
    </div>
  );
}

/** The tags chosen so far in a form, each with its own × to take it off. */
export function ChosenTags({
  tags,
  selected,
  onChange,
}: {
  tags: TaskTag[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const chosen = tags.filter((t) => selected.includes(t.id));
  if (chosen.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chosen.map((tag) => (
        <span
          key={tag.id}
          className={`inline-flex max-w-44 items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-xs font-medium ${TAG_STYLES[tag.color].chip}`}
        >
          <span className="truncate">{tag.name}</span>
          <button
            type="button"
            onClick={() => onChange(selected.filter((id) => id !== tag.id))}
            aria-label={`Remove the ${tag.name} tag`}
            className="rounded-full p-0.5 opacity-70 hover:opacity-100"
          >
            <X size={11} strokeWidth={3} />
          </button>
        </span>
      ))}
    </div>
  );
}
