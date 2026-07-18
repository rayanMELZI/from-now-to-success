"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth, useAuth } from "@/lib/auth";
import type { Habit, HistoryDay } from "@/lib/types";
import { GaugeBar } from "@/components/GaugeBar";

const POINTS_PER_LEVEL = 500;

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-800 dark:text-stone-100">{value}</p>
      {hint && <p className="text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

/** Last-30-days stacked bars: done (emerald) over missed (gray). */
function HistoryChart({ history }: { history: HistoryDay[] }) {
  const [hover, setHover] = useState<HistoryDay | null>(null);

  const days = history.slice(-30);
  const maxTotal = Math.max(1, ...days.map((d) => d.done + d.missed));

  const barWidth = 16;
  const gap = 4;
  const chartHeight = 120;
  const width = days.length * (barWidth + gap);

  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Last 30 days</h2>
        <div className="flex gap-4 text-xs text-stone-500 dark:text-stone-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#059669]" /> done
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#78716c]" /> missed
          </span>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">
          No history yet — check in for a few days and your progress shows up here.
        </p>
      ) : (
        <div className="relative">
          {/* viewBox + w-full: the chart scales to any screen width */}
          <svg
            viewBox={`0 0 ${width} ${chartHeight + 18}`}
            className="h-auto w-full"
            preserveAspectRatio="none"
            style={{ maxHeight: 180 }}
          >
            {days.map((day, i) => {
              const x = i * (barWidth + gap);
              const doneH = (day.done / maxTotal) * chartHeight;
              const missedH = (day.missed / maxTotal) * chartHeight;
              const hovered = hover?.date === day.date;
              return (
                <g
                  key={day.date}
                  onMouseEnter={() => setHover(day)}
                  onMouseLeave={() => setHover(null)}
                  opacity={hover && !hovered ? 0.55 : 1}
                >
                  {/* hit target bigger than the mark */}
                  <rect
                    x={x}
                    y={0}
                    width={barWidth + gap}
                    height={chartHeight}
                    fill="transparent"
                  />
                  {day.missed > 0 && (
                    <rect
                      x={x}
                      y={chartHeight - missedH}
                      width={barWidth}
                      height={missedH}
                      fill="#78716c"
                      rx={2}
                    />
                  )}
                  {day.done > 0 && (
                    <rect
                      x={x}
                      // 2px surface gap between stacked segments
                      y={chartHeight - missedH - doneH - (day.missed > 0 ? 2 : 0)}
                      width={barWidth}
                      height={doneH}
                      fill="#059669"
                      rx={2}
                    />
                  )}
                  {i % 7 === 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight + 14}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#a8a29e"
                    >
                      {day.date.slice(5)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {hover && (
            <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md bg-stone-800 dark:bg-stone-600 px-3 py-1.5 text-xs text-white shadow">
              {hover.date}: {hover.done} done · {hover.missed} missed · +{hover.points} pts
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatsPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryDay[] | null>(null);
  const [habits, setHabits] = useState<Habit[] | null>(null);

  useEffect(() => {
    api<HistoryDay[]>("/api/checkins/history?days=30").then(setHistory);
    api<Habit[]>("/api/habits").then(setHabits);
  }, []);

  if (!history || !habits || !user) {
    return (
      <div className="flex flex-1 items-center justify-center text-stone-400">Loading…</div>
    );
  }

  const bestStreak = Math.max(0, ...habits.map((h) => h.bestStreak));
  const validCount = habits.filter((h) => h.status === "VALID").length;
  const intoLevel = user.totalPoints % POINTS_PER_LEVEL;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4">
      <h1 className="text-lg font-semibold">Your progress</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total points" value={String(user.totalPoints)} />
        <StatTile
          label="Level"
          value={String(user.level)}
          hint={`${intoLevel}/${POINTS_PER_LEVEL} to next`}
        />
        <StatTile label="Best streak" value={`${bestStreak} days`} />
        <StatTile
          label="Valid habits"
          value={`${validCount}/${habits.length}`}
          hint="unlock the next tier"
        />
      </div>

      <HistoryChart history={history} />

      {habits.length > 0 && (
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-sm">
          <h2 className="mb-2 font-medium">Streaks</h2>
          <ul className="divide-y divide-stone-100 dark:divide-stone-800 text-sm">
            {habits
              .filter((h) => h.status !== "LOCKED")
              .map((habit) => (
                <li key={habit.id} className="flex items-center justify-between gap-4 py-2">
                  <span className="min-w-0 flex-1">
                    {habit.habitType === "QUIT" ? "🚫 " : ""}
                    {habit.name}
                    {habit.status === "VALID" && (
                      <span className="ml-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                        valid
                      </span>
                    )}
                  </span>
                  <GaugeBar
                    gauge={habit.gauge}
                    max={habit.requiredStreak}
                    valid={habit.status === "VALID"}
                    className="w-36"
                  />
                  <span className="shrink-0 text-stone-500 dark:text-stone-400">
                    🔥 {habit.currentStreak}
                    <span className="ml-2 text-xs text-stone-400">best {habit.bestStreak}</span>
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
      <StatsPage />
    </RequireAuth>
  );
}
