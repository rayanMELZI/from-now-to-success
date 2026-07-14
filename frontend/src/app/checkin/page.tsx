"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth, useAuth } from "@/lib/auth";
import type { CheckinResult, TodayResponse } from "@/lib/types";

function CheckinPage() {
  const { refreshUser } = useAuth();
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [busy, setBusy] = useState(false);
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

  if (!today) {
    return (
      <div className="flex flex-1 items-center justify-center text-stone-400">Loading…</div>
    );
  }

  const pending = today.entries.filter((e) => e.todayStatus === "PENDING");
  const answered = today.entries.filter((e) => e.todayStatus !== "PENDING");

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const submission = await api<CheckinResult>("/api/checkins", {
        method: "POST",
        body: {
          entries: pending.map((e) => ({
            habitId: e.habitId,
            done: answers[e.habitId] ?? false,
          })),
        },
      });
      setResult(submission);
      await Promise.all([reload(), refreshUser()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4">
      <h1 className="text-lg font-semibold">Daily check-in</h1>
      <p className="mb-4 text-sm text-stone-500">
        {today.date} — what did you do today? Honesty builds the streak that counts.
      </p>

      {result && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-medium text-emerald-800">
            +{result.earnedPoints} points! Total: {result.totalPoints} (level {result.level})
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

      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((entry) => {
            const answer = answers[entry.habitId];
            return (
              <div
                key={entry.habitId}
                className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{entry.name}</p>
                  <p className="text-sm text-stone-500">
                    🔥 {entry.currentStreak}/{entry.requiredStreak}
                    {entry.multiplier > 1 && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        ×{entry.multiplier} streak bonus
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setAnswers((a) => ({ ...a, [entry.habitId]: true }))}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      answer === true
                        ? "bg-emerald-600 text-white"
                        : "border border-stone-300 hover:bg-stone-100"
                    }`}
                  >
                    Did it ✓
                  </button>
                  <button
                    onClick={() => setAnswers((a) => ({ ...a, [entry.habitId]: false }))}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      answer === false
                        ? "bg-stone-600 text-white"
                        : "border border-stone-300 hover:bg-stone-100"
                    }`}
                  >
                    Missed ✗
                  </button>
                </div>
              </div>
            );
          })}

          <button
            onClick={submit}
            disabled={busy || pending.some((e) => answers[e.habitId] === undefined)}
            className="mt-2 w-full rounded-md bg-stone-800 py-3 font-medium text-white hover:bg-stone-700 disabled:opacity-40"
          >
            {busy
              ? "Submitting…"
              : pending.some((e) => answers[e.habitId] === undefined)
                ? "Answer every habit to submit"
                : "Submit check-in"}
          </button>
        </div>
      )}

      {pending.length === 0 && today.entries.length > 0 && !result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800">
          ✓ All checked in for today (+{today.pointsToday} points). See you tomorrow!
        </div>
      )}

      {answered.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-stone-500">Answered today</h2>
          <ul className="space-y-1 text-sm">
            {answered.map((entry) => (
              <li
                key={entry.habitId}
                className="flex justify-between rounded-md bg-white px-3 py-2"
              >
                <span>{entry.name}</span>
                <span
                  className={
                    entry.todayStatus === "DONE" ? "text-emerald-600" : "text-stone-400"
                  }
                >
                  {entry.todayStatus === "DONE" ? "done ✓" : "missed"}
                </span>
              </li>
            ))}
          </ul>
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
