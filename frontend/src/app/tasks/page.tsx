"use client";

import { useState } from "react";
import Link from "next/link";
import { RequireAuth, useAuth } from "@/lib/auth";
import type { TagColor, Task, TaskTag } from "@/lib/types";
import { CircleCheckBig, Pencil, Trash2, X } from "lucide-react";
import { PageHeader, PageShell } from "@/components/ui/Page";
import { Disclosure } from "@/components/ui/Disclosure";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  TagPicker,
  TagToggle,
  TaskQuickAdd,
  TaskRow,
  useTasks,
} from "@/components/Tasks";

function TasksPage() {
  const { user } = useAuth();
  const enabled = user?.tasksEnabled ?? false;
  const { list, error, setError, add, update, remove, clearDone, toggleDone, addTag } =
    useTasks(enabled);
  const [editingId, setEditingId] = useState<number | null>(null);

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

      {list.open.length > 0 ? (
        <ul className="card mt-4 divide-y divide-line px-4">
          {list.open.map((task) =>
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
          )}
        </ul>
      ) : (
        <div className="card mt-4 p-6 text-center text-sm text-ink-soft">
          <CircleCheckBig size={28} className="mx-auto mb-2 text-emerald-500" />
          All clear. Add something above when it comes to mind.
        </div>
      )}

      {list.done.length > 0 && (
        <div className="mt-4">
          <Disclosure
            title="Finished"
            count={list.done.length}
            storageKey="tasks-finished"
            tone="card"
          >
            <ul className="divide-y divide-line">
              {list.done.map((task) => (
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
  const [picking, setPicking] = useState(task.tags.length > 0);
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
        <TagToggle open={picking} count={tagIds.length} onClick={() => setPicking((v) => !v)} />
      </div>
      {picking && (
        <TagPicker tags={tags} selected={tagIds} onChange={setTagIds} onCreate={onCreateTag} />
      )}
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
