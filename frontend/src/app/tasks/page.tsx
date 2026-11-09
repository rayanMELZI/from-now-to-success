"use client";

import { useState } from "react";
import Link from "next/link";
import { RequireAuth, useAuth } from "@/lib/auth";
import { MAX_TAGS, type TagColor, type Task, type TaskTag } from "@/lib/types";
import { CircleCheckBig, Pencil, Settings2, Trash2, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { PageHeader, PageShell } from "@/components/ui/Page";
import { Disclosure } from "@/components/ui/Disclosure";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  TAG_STYLES,
  TagChip,
  TagColorSwatches,
  nextTagColor,
  ChosenTags,
  TagMenuButton,
  TaskQuickAdd,
  TaskRow,
  useTasks,
} from "@/components/Tasks";

type SortBy = "date" | "tag";
const SORT_KEY = "tasks-sort";

/**
 * Open tasks bunched by tag, in the order the tags were made: a task sits
 * under its first tag, untagged ones last. Within a bunch the server's order
 * (deadlines first) stays.
 */
function groupByTag(tasks: Task[], tags: TaskTag[]): { tag: TaskTag | null; tasks: Task[] }[] {
  const rank = new Map(tags.map((t, i) => [t.id, i]));
  const first = (task: Task) =>
    task.tags.reduce<TaskTag | null>(
      (best, t) => (best === null || rank.get(t.id)! < rank.get(best.id)! ? t : best),
      null,
    );
  const groups = [...tags, null].map((tag) => ({
    tag,
    tasks: tasks.filter((task) => (first(task)?.id ?? null) === (tag?.id ?? null)),
  }));
  return groups.filter((g) => g.tasks.length > 0);
}

function TasksPage() {
  const { user } = useAuth();
  const enabled = user?.tasksEnabled ?? false;
  const {
    list,
    error,
    setError,
    add,
    update,
    remove,
    clearDone,
    toggleDone,
    setTags,
    addTag,
    updateTag,
    removeTag,
  } = useTasks(enabled);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterId, setFilterId] = useState<number | null>(null);
  const [managing, setManaging] = useState(false);
  // Lazy init reads the saved choice on the first client render (the page
  // only renders once signed in, never on the server).
  const [sortBy, setSortBy] = useState<SortBy>(() =>
    typeof window !== "undefined" && localStorage.getItem(SORT_KEY) === "tag" ? "tag" : "date",
  );
  const changeSort = (next: SortBy) => {
    setSortBy(next);
    localStorage.setItem(SORT_KEY, next);
  };

  if (!enabled) return <TasksOff />;
  if (!list) {
    return error ? (
      <PageShell width="form">
        <ErrorNote message={error} onDismiss={() => setError(null)} />
      </PageShell>
    ) : (
      <TasksSkeleton />
    );
  }

  const overdue = list.open.filter((t) => t.dueDate !== null && t.dueDate < list.today).length;
  // A filter on a tag that has since been deleted simply falls away.
  const filter = list.tags.find((t) => t.id === filterId) ?? null;
  const matches = (task: Task) => filter === null || task.tags.some((t) => t.id === filter.id);
  const open = list.open.filter(matches);
  const done = list.done.filter(matches);
  const groups =
    sortBy === "tag" && list.tags.length > 0
      ? groupByTag(open, list.tags)
      : [{ tag: null, tasks: open }];
  const showHeads = groups.length > 1 || (sortBy === "tag" && groups[0]?.tag != null);

  return (
    <PageShell width="form">
      <PageHeader
        title="Tasks"
        subtitle={
          list.open.length === 0
            ? "Nothing waiting on you."
            : `${list.open.length} to get done${overdue > 0 ? ` · ${overdue} overdue` : ""}`
        }
      />

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      <div className="card p-3">
        <TaskQuickAdd onAdd={add} tags={list.tags} onCreateTag={addTag} autoFocus />
      </div>

      {list.tags.length > 0 && (
        <TagFilter
          tags={list.tags}
          value={filter?.id ?? null}
          onChange={setFilterId}
          sortBy={sortBy}
          onSort={changeSort}
          onManage={() => setManaging(true)}
        />
      )}

      <Modal open={managing} onClose={() => setManaging(false)}>
        <TagManager
          tags={list.tags}
          onCreate={addTag}
          onUpdate={updateTag}
          onRemove={removeTag}
          onClose={() => setManaging(false)}
        />
      </Modal>

      {open.length > 0 ? (
        <ul className="card mt-4 divide-y divide-line px-4">
          {groups.flatMap(({ tag, tasks }) => [
            ...(showHeads
              ? [
                  <li
                    key={`head-${tag?.id ?? "none"}`}
                    className="flex items-center gap-2 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    {tag ? <TagChip tag={tag} className="normal-case tracking-normal" /> : "No tag"}
                    <span className="tabular-nums">{tasks.length}</span>
                  </li>,
                ]
              : []),
            ...tasks.map((task) =>
            editingId === task.id ? (
              <li key={task.id} className="py-2">
                <TaskEditor
                  task={task}
                  tags={list.tags}
                  onCreateTag={addTag}
                  onCancel={() => setEditingId(null)}
                  onSave={async (title, dueDate, tagIds) => {
                    if (await update(task.id, title, dueDate, tagIds)) setEditingId(null);
                  }}
                />
              </li>
            ) : (
              <li key={task.id}>
                <TaskRow task={task} today={list.today} onToggle={() => toggleDone(task)}>
                  <TagMenuButton
                    tags={list.tags}
                    selected={task.tags.map((t) => t.id)}
                    onChange={(ids) => void setTags(task, ids)}
                    onCreate={addTag}
                    label={`Tag ${task.title}`}
                    className="btn-icon"
                  />
                  <button
                    onClick={() => setEditingId(task.id)}
                    aria-label={`Edit ${task.title}`}
                    className="btn-icon"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => remove(task.id)}
                    aria-label={`Delete ${task.title}`}
                    className="btn-icon hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </TaskRow>
              </li>
            ),
          ),
          ])}
        </ul>
      ) : filter !== null && list.open.length > 0 ? (
        <div className="card mt-4 p-6 text-center text-sm text-ink-soft">
          Nothing open is tagged <TagChip tag={filter} className="align-middle" />.
        </div>
      ) : (
        <div className="card mt-4 p-6 text-center text-sm text-ink-soft">
          <CircleCheckBig size={28} className="mx-auto mb-2 text-emerald-500" />
          All clear. Add something above when it comes to mind.
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-4">
          <Disclosure
            title="Finished"
            count={done.length}
            storageKey="tasks-finished"
            tone="card"
          >
            <ul className="divide-y divide-line">
              {done.map((task) => (
                <li key={task.id}>
                  <TaskRow task={task} today={list.today} onToggle={() => toggleDone(task)}>
                    <button
                      onClick={() => remove(task.id)}
                      aria-label={`Delete ${task.title}`}
                      className="btn-icon hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </TaskRow>
                </li>
              ))}
            </ul>
            <button onClick={clearDone} className="btn btn-ghost mt-2 w-full text-xs">
              Clear finished tasks
            </button>
          </Disclosure>
        </div>
      )}
    </PageShell>
  );
}

/** Title, deadline and tags, edited in place. */
function TaskEditor({
  task,
  tags,
  onCreateTag,
  onSave,
  onCancel,
}: {
  task: Task;
  tags: TaskTag[];
  onCreateTag: (name: string, color: TagColor) => Promise<TaskTag | null>;
  onSave: (title: string, dueDate: string | null, tagIds: number[]) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [tagIds, setTagIds] = useState(() => task.tags.map((t) => t.id));
  const valid = title.trim().length > 0;
  const save = () =>
    valid &&
    onSave(
      title.trim(),
      dueDate || null,
      tagIds.filter((id) => tags.some((t) => t.id === id)),
    );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={title}
          maxLength={120}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onCancel();
          }}
          aria-label="Task"
          className="field min-w-0 flex-1"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Due by (optional)"
          className="field w-auto shrink-0 tabular-nums"
        />
        <TagMenuButton
          tags={tags}
          selected={tagIds}
          onChange={setTagIds}
          onCreate={onCreateTag}
          label="Tag it"
        />
      </div>
      <ChosenTags tags={tags} selected={tagIds} onChange={setTagIds} />
      <div className="flex gap-2">
        <button onClick={save} disabled={!valid} className="btn btn-primary flex-1">
          Save
        </button>
        <button onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** One tag at a time narrows both lists; "All" lifts it. */
function TagFilter({
  tags,
  value,
  onChange,
  sortBy,
  onSort,
  onManage,
}: {
  tags: TaskTag[];
  value: number | null;
  onChange: (id: number | null) => void;
  sortBy: SortBy;
  onSort: (sortBy: SortBy) => void;
  onManage: () => void;
}) {
  const chip = (active: boolean) =>
    `inline-flex max-w-40 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
      active ? "bg-ink text-surface" : "bg-surface-sunken text-ink-soft hover:text-ink"
    }`;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="Filter by tag">
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={chip(value === null)}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          aria-pressed={value === tag.id}
          onClick={() => onChange(value === tag.id ? null : tag.id)}
          className={chip(value === tag.id)}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${TAG_STYLES[tag.color].dot}`} />
          <span className="truncate">{tag.name}</span>
        </button>
      ))}
      <div className="ml-auto flex items-center gap-1">
        <Segmented
          size="sm"
          ariaLabel="Sort tasks"
          value={sortBy}
          onChange={onSort}
          options={[
            { value: "date", label: "By date", title: "Deadlines first" },
            { value: "tag", label: "By tag", title: "Grouped under their tags" },
          ]}
        />
        <button
          type="button"
          onClick={onManage}
          aria-label="Edit tags"
          title="Edit tags"
          className="btn-icon h-7 w-7 min-h-0"
        >
          <Settings2 size={14} />
        </button>
      </div>
    </div>
  );
}

/** Rename, recolour, delete or add tags; each change is saved as it is made. */
function TagManager({
  tags,
  onCreate,
  onUpdate,
  onRemove,
  onClose,
}: {
  tags: TaskTag[];
  onCreate: (name: string, color: TagColor) => Promise<TaskTag | null>;
  onUpdate: (id: number, name: string, color: TagColor) => Promise<boolean>;
  onRemove: (id: number) => Promise<boolean>;
  onClose: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Tags</h2>
        <button onClick={onClose} aria-label="Close" className="btn-icon h-8 w-8 min-h-0">
          <X size={16} />
        </button>
      </div>
      {tags.length === 0 ? (
        <p className="text-sm text-ink-soft">No tags yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {tags.map((tag) => (
            <li key={tag.id} className="py-3">
              <TagEditorRow tag={tag} onUpdate={onUpdate} onRemove={onRemove} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 border-t border-line pt-3">
        <NewTagForm tags={tags} onCreate={onCreate} />
      </div>
      <p className="mt-3 text-xs text-ink-faint">
        Renaming or recolouring a tag changes it on every task; deleting it takes it off them.
      </p>
    </div>
  );
}

/** Name and colour for a new tag, made from the tags dialog. */
function NewTagForm({
  tags,
  onCreate,
}: {
  tags: TaskTag[];
  onCreate: (name: string, color: TagColor) => Promise<TaskTag | null>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>(() => nextTagColor(tags));
  const [busy, setBusy] = useState(false);
  const full = tags.length >= MAX_TAGS;

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const tag = await onCreate(trimmed, color);
    setBusy(false);
    if (!tag) return;
    setName("");
    setColor(nextTagColor([...tags, tag]));
  }

  if (full) return <p className="text-xs text-ink-faint">{MAX_TAGS} tags at most.</p>;
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void create();
          }}
          placeholder="New tag"
          aria-label="New tag name"
          className="field min-w-0 flex-1"
        />
        <button
          onClick={() => void create()}
          disabled={busy || !name.trim()}
          className="btn btn-primary shrink-0 px-3"
        >
          Add
        </button>
      </div>
      <TagColorSwatches value={color} onChange={setColor} />
    </div>
  );
}

function TagEditorRow({
  tag,
  onUpdate,
  onRemove,
}: {
  tag: TaskTag;
  onUpdate: (id: number, name: string, color: TagColor) => Promise<boolean>;
  onRemove: (id: number) => Promise<boolean>;
}) {
  const [name, setName] = useState(tag.name);
  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) setName(tag.name);
    else if (trimmed !== tag.name) void onUpdate(tag.id, trimmed, tag.color);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 shrink-0 rounded-full ${TAG_STYLES[tag.color].dot}`} />
        <input
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-label={`Name of the ${tag.name} tag`}
          className="field min-w-0 flex-1"
        />
        <button
          onClick={() => {
            if (confirm(`Delete the "${tag.name}" tag? Tasks keep everything else.`)) {
              void onRemove(tag.id);
            }
          }}
          aria-label={`Delete the ${tag.name} tag`}
          className="btn-icon hover:text-red-600"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <TagColorSwatches
        value={tag.color}
        onChange={(color) => {
          if (color !== tag.color) void onUpdate(tag.id, name.trim() || tag.name, color);
        }}
      />
    </div>
  );
}

function ErrorNote({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <p className="mb-4 flex items-center justify-between gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
      {message}
      <button onClick={onDismiss} aria-label="Dismiss">
        <X size={14} />
      </button>
    </p>
  );
}

function TasksSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 sm:px-6" role="status" aria-label="Loading">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="mt-2 h-4 w-48" />
      <Skeleton className="mt-5 h-12 w-full" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Reached with the setting off — explain, then point at the switch. */
function TasksOff() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 p-4">
      <div className="card mt-8 p-6 text-center">
        <CircleCheckBig size={32} className="mx-auto text-amber-600" />
        <h1 className="mt-3 font-semibold">Tasks are off</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Turn them on to keep a list of one-off things to get done, and pull them
          straight into your daily plan.
        </p>
        <Link href="/settings" className="btn btn-primary mt-4">
          Open settings
        </Link>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <TasksPage />
    </RequireAuth>
  );
}
