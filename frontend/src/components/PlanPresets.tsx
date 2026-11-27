"use client";

import { useState } from "react";
import { ArrowLeft, Bookmark, LayoutTemplate, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { plainText } from "@/lib/richText";
import { formatMinute, parseMinute, type Habit, type PlanPreset } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { RichField, RichText } from "@/components/ui/RichText";

/** The server's limits, so the editor stops before it is told off. */
const MAX_LINES = 60;
const MAX_NAME = 60;
const MAX_TITLE = 120;

/** "6 lines · 07:30 → 22:00" — enough to tell two presets apart at a glance. */
export function presetSummary(preset: PlanPreset): string {
  const count = `${preset.lines.length} line${preset.lines.length === 1 ? "" : "s"}`;
  if (preset.lines.length === 0) return count;
  const first = preset.lines[0].endMinute;
  const last = preset.lines[preset.lines.length - 1].endMinute;
  return first === last
    ? `${count} · ${formatMinute(first)}`
    : `${count} · ${formatMinute(first)} → ${formatMinute(last)}`;
}

/** A line being edited; `key` keeps each row's text field its own across removals. */
interface DraftLine {
  key: number;
  time: string;
  title: string;
  habitId: number | null;
}

let nextKey = 1;
const draftLine = (time: string, title = "", habitId: number | null = null): DraftLine => ({
  key: nextKey++,
  time,
  title,
  habitId,
});

/**
 * Everything about presets in one place: the list, using one on the day being
 * looked at, saving that day as a new one, and editing or deleting them.
 */
export function PresetsDialog({
  open,
  onClose,
  presets,
  habits,
  dayHasPlan,
  busy,
  onChanged,
  onApply,
  onSaveDay,
}: {
  open: boolean;
  onClose: () => void;
  presets: PlanPreset[];
  habits: Habit[];
  /** A preset only ever goes onto an empty day; with a plan, it can be saved instead. */
  dayHasPlan: boolean;
  busy: boolean;
  /** The list changed on the server: read it again. */
  onChanged: () => Promise<void>;
  onApply: (preset: PlanPreset) => Promise<void>;
  onSaveDay: (name: string) => Promise<boolean>;
}) {
  // null: the list; "new": a blank preset; a preset: that one being edited.
  const [editing, setEditing] = useState<PlanPreset | "new" | null>(null);
  const [saveName, setSaveName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  function close() {
    setEditing(null);
    setConfirmDelete(null);
    setError(null);
    onClose();
  }

  async function attempt(action: () => Promise<void>) {
    setWorking(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setWorking(false);
    }
  }

  const remove = (preset: PlanPreset) =>
    attempt(async () => {
      await api(`/api/plan/presets/${preset.id}`, { method: "DELETE" });
      setConfirmDelete(null);
      await onChanged();
    });

  const saveDay = () =>
    attempt(async () => {
      const name = saveName.trim();
      if (!name) return;
      if (await onSaveDay(name)) setSaveName("");
    });

  const disabled = busy || working;

  return (
    <Modal open={open} onClose={close} size="lg">
      {editing !== null ? (
        <PresetEditor
          // A different preset is a different form, not this one refilled.
          key={editing === "new" ? "new" : editing.id}
          preset={editing === "new" ? null : editing}
          habits={habits}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            await onChanged();
            setEditing(null);
          }}
        />
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <LayoutTemplate size={18} className="text-amber-600" />
              Day presets
            </h2>
            <button onClick={close} aria-label="Close" className="btn-icon">
              <X size={16} />
            </button>
          </div>
          <p className="mb-4 text-sm text-ink-soft">
            The kinds of day you live — a workday, a gym day, a Sunday. An empty day
            starts from one in a tap, and stays yours to change.
          </p>

          {error && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}

          {presets.length === 0 ? (
            <p className="mb-4 rounded-xl border border-dashed border-line-strong p-4 text-center text-sm text-ink-soft">
              No presets yet. Save a day you planned, or write one from scratch.
            </p>
          ) : (
            <ul className="mb-4 space-y-2">
              {presets.map((preset) => (
                <li key={preset.id} className="card p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{preset.name}</p>
                      <p className="text-xs text-ink-faint tabular-nums">
                        {presetSummary(preset)}
                      </p>
                    </div>
                    {!dayHasPlan && (
                      <button
                        onClick={() => attempt(() => onApply(preset))}
                        disabled={disabled}
                        className="btn btn-primary h-8 min-h-0 px-3 text-xs"
                      >
                        Use
                      </button>
                    )}
                    <button
                      onClick={() => setEditing(preset)}
                      disabled={disabled}
                      aria-label={`Edit ${preset.name}`}
                      className="btn-icon"
                    >
                      <Pencil size={14} />
                    </button>
                    {confirmDelete === preset.id ? (
                      <button
                        onClick={() => remove(preset)}
                        disabled={disabled}
                        className="btn h-8 min-h-0 bg-red-600 px-3 text-xs text-white hover:bg-red-700"
                      >
                        Delete?
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(preset.id)}
                        disabled={disabled}
                        aria-label={`Delete ${preset.name}`}
                        className="btn-icon"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <ol className="mt-2 space-y-0.5 text-xs text-ink-soft">
                    {preset.lines.slice(0, 4).map((line, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="w-10 shrink-0 tabular-nums text-ink-faint">
                          {formatMinute(line.endMinute)}
                        </span>
                        <span className="min-w-0 truncate">
                          <RichText text={line.title} />
                        </span>
                      </li>
                    ))}
                    {preset.lines.length > 4 && (
                      <li className="pl-12 text-ink-faint">
                        and {preset.lines.length - 4} more
                      </li>
                    )}
                  </ol>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-3 border-t border-line pt-4">
            {dayHasPlan && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="field-label mb-0.5">Save this day as a preset</span>
                  <input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveDay()}
                    maxLength={MAX_NAME}
                    placeholder="Workday"
                    className="field"
                  />
                </label>
                <button
                  onClick={saveDay}
                  disabled={disabled || !saveName.trim()}
                  className="btn btn-primary"
                >
                  <Bookmark size={14} />
                  Save
                </button>
              </div>
            )}
            <button
              onClick={() => setEditing("new")}
              disabled={disabled}
              className="btn btn-ghost self-start"
            >
              <Plus size={14} />
              New preset
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/** Writes a preset line by line: a name, then "done at" times and what they are. */
function PresetEditor({
  preset,
  habits,
  onCancel,
  onSaved,
}: {
  preset: PlanPreset | null;
  habits: Habit[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(preset?.name ?? "");
  const [lines, setLines] = useState<DraftLine[]>(() =>
    preset && preset.lines.length > 0
      ? preset.lines.map((l) => draftLine(formatMinute(l.endMinute), l.title, l.habitId))
      : [draftLine("08:00")],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Archived habits are off the map; one a line already names stays listed.
  const linkedIds = new Set(lines.map((l) => l.habitId));
  const pickable = habits.filter((h) => !h.archivedAt || linkedIds.has(h.id));

  const patch = (key: number, change: Partial<DraftLine>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...change } : l)));

  function addLine() {
    // The next line usually follows the last one: start it a little later.
    const last = parseMinute(lines[lines.length - 1]?.time ?? "");
    const time = last === null ? "08:00" : formatMinute(Math.min(1439, last + 30));
    setLines((current) => [...current, draftLine(time)]);
  }

  async function save() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the preset a name");
      return;
    }
    // A blank row is just an unused one, not a mistake.
    const filled = lines.filter((l) => plainText(l.title).trim() !== "");
    if (filled.length === 0) {
      setError("A preset needs at least one line");
      return;
    }
    const body = [];
    for (const line of filled) {
      const endMinute = parseMinute(line.time);
      if (endMinute === null) {
        setError(`"${plainText(line.title)}" needs a time`);
        return;
      }
      body.push({ title: line.title.trim(), endMinute, habitId: line.habitId });
    }
    setSaving(true);
    try {
      await api<PlanPreset>(preset ? `/api/plan/presets/${preset.id}` : "/api/plan/presets", {
        method: preset ? "PUT" : "POST",
        body: { name: trimmed, lines: body },
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the preset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onCancel} aria-label="Back to the presets" className="btn-icon">
          <ArrowLeft size={16} />
        </button>
        <h2 className="font-semibold">{preset ? "Edit preset" : "New preset"}</h2>
      </div>

      <label className="mb-4 block">
        <span className="field-label mb-0.5">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME}
          placeholder="Workday"
          autoFocus={!preset}
          className="field"
        />
      </label>

      <span className="field-label mb-1">Lines — the time each thing is done</span>
      <ol className="mb-3 space-y-2">
        {lines.map((line) => (
          <li key={line.key} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
            <input
              type="time"
              value={line.time}
              onChange={(e) => patch(line.key, { time: e.target.value })}
              aria-label="The time this is finished"
              className="field w-28 shrink-0 tabular-nums"
            />
            <div className="min-w-0 flex-1 basis-40">
              <RichField
                value={line.title}
                onChange={(title) => patch(line.key, { title })}
                maxLength={MAX_TITLE}
                placeholder="What"
                ariaLabel="What this line is"
              />
            </div>
            {pickable.length > 0 && (
              <select
                value={line.habitId ?? ""}
                onChange={(e) => {
                  const habitId = e.target.value ? Number(e.target.value) : null;
                  const habit = habits.find((h) => h.id === habitId);
                  // Picking a habit for an untitled line names the line after it.
                  patch(line.key, {
                    habitId,
                    ...(habit && plainText(line.title).trim() === ""
                      ? { title: habit.name }
                      : {}),
                  });
                }}
                aria-label="The habit this line stands for"
                className="field w-36 shrink-0 py-2 text-xs"
              >
                <option value="">No habit</option>
                {pickable.map((h) => (
                  <option key={h.id} value={h.id}>
                    {plainText(h.name)}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
              disabled={lines.length === 1}
              aria-label="Remove this line"
              className="btn-icon shrink-0"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ol>
      <button
        onClick={addLine}
        disabled={lines.length >= MAX_LINES}
        className="btn btn-ghost mb-4"
      >
        <Plus size={14} />
        Add a line
      </button>

      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} disabled={saving} className="btn btn-ghost">
          Cancel
        </button>
        <button onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? "Saving…" : "Save preset"}
        </button>
      </div>
    </div>
  );
}
