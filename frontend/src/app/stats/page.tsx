"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth, useAuth } from "@/lib/auth";
import type { Habit, HistoryDay } from "@/lib/types";
import { GaugeBar } from "@/components/GaugeBar";
import { Ban, Flame } from "lucide-react";

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

/** yyyy-mm-dd in local time; noon-UTC parsing sidesteps DST/offset issues. */
function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Last-30-days stacked bars: done (emerald) over missed (gray).
 * Drawn in real pixels from the measured container width — no SVG
 * scaling, so bars and labels never distort. Missing days are
 * zero-filled to keep the time axis continuous.
 */
function HistoryChart({ history }: { history: HistoryDay[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<HistoryDay | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const days = useMemo(() => {
    const byDate = new Map(history.map((d) => [d.date, d]));
    const localToday = new Date().toLocaleDateString("sv"); // yyyy-mm-dd
    const lastData = history.length ? history[history.length - 1].date : localToday;
    const end = lastData > localToday ? lastData : localToday;
    return Array.from({ length: 30 }, (_, i) => {
      const date = shiftDate(end, i - 29);
      return byDate.get(date) ?? { date, done: 0, missed: 0, points: 0 };
    });
  }, [history]);

  const maxTotal = Math.max(1, ...days.map((d) => d.done + d.missed));
  const chartHeight = 130;
  const gap = 3;
  const barWidth = width > 0
    ? Math.max(3, (width - (days.length - 1) * gap) / days.length)
    : 0;

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

      {history.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">
          No history yet — check in for a few days and your progress shows up here.
        </p>
      ) : (
        <div ref={containerRef} className="relative">
          {width > 0 && (
            <svg width={width} height={chartHeight + 18}>
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
                    {i % 7 === 1 && (
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
          )}

          {hover && (
            <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md bg-stone-800 dark:bg-stone-600 px-3 py-1.5 text-xs whitespace-nowrap text-white shadow">
              {hover.date}: {hover.done} done · {hover.missed} missed ·{" "}
              {hover.points >= 0 ? "+" : ""}
              {hover.points} pts
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
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    {habit.habitType === "QUIT" && <Ban size={13} className="shrink-0 text-red-500" />}
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
                  <span className="flex shrink-0 items-center gap-1 text-stone-500 dark:text-stone-400">
                    <Flame size={13} className="text-orange-500" /> {habit.currentStreak}
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
