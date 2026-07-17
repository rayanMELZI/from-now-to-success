"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth, useAuth } from "@/lib/auth";
import { habitVerbs, type CheckinResult, type TodayEntry, type TodayResponse } from "@/lib/types";
import { GaugeBar } from "@/components/GaugeBar";

interface MissDraft {
  habitId: number;
  reason: string;
  freeze: boolean;
}

function CheckinPage() {
  const { refreshUser } = useAuth();
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [missDraft, setMissDraft] = useState<MissDraft | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // setState happens in the promise callback, never in the effect body itself
  // (react-hooks/set-state-in-effect).
  const reload = useCallback(
    () => api<TodayResponse>("/api/checkins/today").then(setToday),
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

  if (!today) {
    return (
      <div className="flex flex-1 items-center justify-center text-stone-400">Loading…</div>
    );
  }

  const pending = today.entries.filter((e) => e.todayStatus === "PENDING");
  const answered = today.entries.filter((e) => e.todayStatus !== "PENDING");

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Daily check-in</h1>
        <span className="text-xs text-stone-500">
          🧊 {today.freezesLeft} freeze{today.freezesLeft === 1 ? "" : "s"} left this month
        </span>
      </div>
      <p className="mb-4 text-sm text-stone-500">
        {today.date} — answer any habit as soon as you know. Honesty builds the gauge
        that counts.
      </p>

      {result && (
        <div
          className={`mb-4 rounded-xl border p-4 ${
            result.earnedPoints >= 0
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <p
            className={`font-medium ${
              result.earnedPoints >= 0 ? "text-emerald-800" : "text-amber-800"
            }`}
          >
            {result.earnedPoints >= 0 ? "+" : ""}
            {result.earnedPoints} points · Total: {result.totalPoints} (level {result.level})
          </p>
          {result.becameValid.length > 0 && (
            <p className="mt-1 text-sm text-emerald-700">
              ✓ Now valid: {result.becameValid.join(", ")}
            </p>
          )}
          {result.unlocked.length > 0 && (
            <p className="mt-1 text-sm text-emerald-700">
              🔓 Unlocked: {result.unlocked.join(", ")}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {today.entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
          No active habits yet — add some on your roadmap first.
        </div>
      )}

      <div className="space-y-2">
        {pending.map((entry) => (
          <PendingRow
            key={entry.habitId}
            entry={entry}
            busy={busyId === entry.habitId}
            missDraft={missDraft?.habitId === entry.habitId ? missDraft : null}
            freezesLeft={today.freezesLeft}
            onDone={() => answer(entry.habitId, true)}
            onMissClick={() =>
              setMissDraft({ habitId: entry.habitId, reason: "", freeze: false })
            }
            onMissConfirm={(draft) =>
              answer(entry.habitId, false, draft.reason, draft.freeze)
            }
            onMissCancel={() => setMissDraft(null)}
            onDraftChange={setMissDraft}
          />
        ))}
      </div>

      {pending.length === 0 && today.entries.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800">
          ✓ All answered for now ({today.pointsToday >= 0 ? "+" : ""}
          {today.pointsToday} points today). See you tomorrow!
        </div>
      )}

      {answered.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-stone-500">Answered</h2>
          <ul className="space-y-1 text-sm">
            {answered.map((entry) => (
              <li
                key={entry.habitId}
                className="flex justify-between rounded-md bg-white px-3 py-2"
              >
                <span>
                  {entry.habitType === "QUIT" ? "🚫 " : ""}
                  {entry.name}
                </span>
                <span
                  className={
                    entry.todayStatus === "MISSED" ? "text-stone-400" : "text-emerald-600"
                  }
                >
                  {entry.todayStatus === "MISSED"
                    ? "missed"
                    : entry.todayStatus === "DONE_TODAY"
                      ? `done today · ${entry.doneThisPeriod}/${entry.timesPerPeriod} this ${entry.schedule === "WEEKLY" ? "week" : "month"}`
                      : entry.habitType === "QUIT"
                        ? "avoided ✓"
                        : "done ✓"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PendingRow({
  entry,
  busy,
  missDraft,
  freezesLeft,
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
  onDone: () => void;
  onMissClick: () => void;
  onMissConfirm: (draft: MissDraft) => void;
  onMissCancel: () => void;
  onDraftChange: (draft: MissDraft) => void;
}) {
  const verbs = habitVerbs(entry.habitType);
  const periodic = entry.schedule !== "DAILY";

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {entry.habitType === "QUIT" ? "🚫 " : ""}
            {entry.name}
            {periodic && (
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  entry.daysLeftInPeriod <= entry.timesPerPeriod - entry.doneThisPeriod
                    ? "bg-amber-100 font-medium text-amber-800"
                    : "bg-stone-100 text-stone-500"
                }`}
              >
                {entry.doneThisPeriod}/{entry.timesPerPeriod} this{" "}
                {entry.schedule === "WEEKLY" ? "week" : "month"} · {entry.daysLeftInPeriod}{" "}
                day{entry.daysLeftInPeriod === 1 ? "" : "s"} left
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
            <span className="text-xs text-stone-400">🔥 {entry.currentStreak}</span>
            {entry.multiplier > 1 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
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
            {busy ? "…" : verbs.did}
          </button>
          {!periodic && (
            <button
              onClick={onMissClick}
              disabled={busy}
              className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm transition-all hover:bg-stone-100 active:scale-95 disabled:opacity-50"
            >
              {verbs.missed}
            </button>
          )}
        </div>
      </div>

      {missDraft && (
        <div className="mt-3 space-y-2 rounded-lg bg-stone-50 p-3">
          <label className="block text-sm">
            <span className="text-stone-600">
              What happened? (a reason halves the point loss)
            </span>
            <textarea
              value={missDraft.reason}
              maxLength={500}
              rows={2}
              onChange={(e) => onDraftChange({ ...missDraft, reason: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              placeholder="e.g. traveled all day, was sick…"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={missDraft.freeze}
              disabled={freezesLeft <= 0}
              onChange={(e) => onDraftChange({ ...missDraft, freeze: e.target.checked })}
            />
            <span className={freezesLeft <= 0 ? "text-stone-400" : ""}>
              🧊 Use a streak freeze — gauge and streak untouched ({freezesLeft} left)
            </span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => onMissConfirm(missDraft)}
              disabled={busy}
              className="rounded-md bg-stone-700 px-4 py-1.5 text-sm text-white hover:bg-stone-600 disabled:opacity-50"
            >
              Confirm miss
            </button>
            <button
              onClick={onMissCancel}
              className="rounded-md border border-stone-300 px-4 py-1.5 text-sm hover:bg-stone-100"
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
