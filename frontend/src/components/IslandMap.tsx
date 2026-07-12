"use client";

import { useMemo } from "react";
import type { Habit } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Deterministic randomness: same seed -> same shape, so the map is    */
/* stable across renders instead of wobbling.                          */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Organic cell shape: jittered points around the cell's center,       */
/* joined with smooth quadratic curves through midpoints.              */
/* ------------------------------------------------------------------ */

function organicCellPath(
  cx: number,
  cy: number,
  w: number,
  h: number,
  seed: number,
): string {
  const rand = mulberry32(seed);
  const pointCount = 8;
  const points: [number, number][] = [];

  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2 + rand() * 0.35;
    // Radius of a rectangle-ish blob, jittered between 82% and 105%.
    const jitter = 0.82 + rand() * 0.23;
    points.push([
      cx + Math.cos(angle) * (w / 2) * jitter,
      cy + Math.sin(angle) * (h / 2) * jitter,
    ]);
  }

  // Smooth closed curve: quadratic beziers through segment midpoints.
  let d = "";
  for (let i = 0; i < pointCount; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % pointCount];
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    if (i === 0) d = `M ${mx.toFixed(1)} ${my.toFixed(1)} `;
    else {
      // handled by Q below
    }
    const [x3, y3] = points[(i + 1) % pointCount];
    const [x4, y4] = points[(i + 2) % pointCount];
    d += `Q ${x3.toFixed(1)} ${y3.toFixed(1)}, ${((x3 + x4) / 2).toFixed(1)} ${((y3 + y4) / 2).toFixed(1)} `;
  }
  return d + "Z";
}

/* ------------------------------------------------------------------ */
/* Layout: column = prerequisite depth, rows spread middle-out.        */
/* ------------------------------------------------------------------ */

const CELL_W = 168;
const CELL_H = 118;
const PAD = 24;

interface PlacedHabit {
  habit: Habit;
  col: number;
  row: number;
}

function computeDepths(habits: Habit[]): Map<number, number> {
  const byId = new Map(habits.map((h) => [h.id, h]));
  const depths = new Map<number, number>();

  function depthOf(id: number, visiting: Set<number>): number {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // cycle guard (backend forbids cycles anyway)
    visiting.add(id);
    const habit = byId.get(id);
    const prereqs = habit?.prerequisiteIds ?? [];
    const depth = prereqs.length
      ? 1 + Math.max(...prereqs.map((p) => depthOf(p, visiting)))
      : 0;
    depths.set(id, depth);
    return depth;
  }

  habits.forEach((h) => depthOf(h.id, new Set()));
  return depths;
}

function middleOutRows(count: number, totalRows: number): number[] {
  // 1 habit -> middle row; 2 -> rows around middle; etc.
  const mid = Math.floor(totalRows / 2);
  const rows: number[] = [];
  for (let i = 0; i < count; i++) {
    const offset = Math.ceil(i / 2) * (i % 2 === 0 ? 1 : -1);
    rows.push(Math.max(0, Math.min(totalRows - 1, mid + offset)));
  }
  return rows;
}

/* ------------------------------------------------------------------ */

const statusStyle: Record<
  Habit["status"] | "mystery" | "anchor",
  { fill: string; stroke: string; text: string }
> = {
  LOCKED: { fill: "#e7e5e4", stroke: "#a8a29e", text: "#78716c" },
  ACTIVE: { fill: "#fffbeb", stroke: "#92400e", text: "#44403c" },
  VALID: { fill: "#dcfce7", stroke: "#166534", text: "#14532d" },
  mystery: { fill: "#f5f5f4", stroke: "#d6d3d1", text: "#a8a29e" },
  anchor: { fill: "#fef3c7", stroke: "#92400e", text: "#78350f" },
};

interface IslandMapProps {
  habits: Habit[];
  selectedId: number | null;
  onSelect: (habit: Habit | null) => void;
}

export function IslandMap({ habits, selectedId, onSelect }: IslandMapProps) {
  const { placed, cols, rows } = useMemo(() => {
    const depths = computeDepths(habits);
    const maxDepth = habits.length ? Math.max(...depths.values()) : 0;
    const byDepth = new Map<number, Habit[]>();
    habits.forEach((h) => {
      const d = depths.get(h.id) ?? 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d)!.push(h);
    });

    const maxPerCol = Math.max(1, ...[...byDepth.values()].map((v) => v.length));
    const rows = Math.max(3, maxPerCol);
    // col 0 = "now" anchor, cols 1..maxDepth+1 = habits, last col = "success"
    const cols = maxDepth + 3;

    const placed: PlacedHabit[] = [];
    byDepth.forEach((group, depth) => {
      const sorted = [...group].sort((a, b) => a.id - b.id);
      const rowsFor = middleOutRows(sorted.length, rows);
      sorted.forEach((habit, i) =>
        placed.push({ habit, col: depth + 1, row: rowsFor[i] }),
      );
    });

    return { placed, cols, rows };
  }, [habits]);

  const width = cols * CELL_W + PAD * 2;
  const height = rows * CELL_H + PAD * 2;
  const center = (col: number, row: number): [number, number] => [
    PAD + col * CELL_W + CELL_W / 2,
    PAD + row * CELL_H + CELL_H / 2,
  ];

  const posById = new Map(placed.map((p) => [p.habit.id, center(p.col, p.row)]));
  const occupied = new Set(placed.map((p) => `${p.col}:${p.row}`));
  const midRow = Math.floor(rows / 2);

  /* Mystery filler cells: every free grid slot, like the sketch's "..." */
  const fillers: [number, number][] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const isNow = c === 0 && r === midRow;
      const isSuccess = c === cols - 1 && r === midRow;
      if (!occupied.has(`${c}:${r}`) && !isNow && !isSuccess) fillers.push([c, r]);
    }
  }

  return (
    <div className="overflow-auto rounded-xl border border-stone-300 bg-stone-50">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        onClick={() => onSelect(null)}
      >
        {/* dependency lines, under the cells */}
        {placed.map(({ habit }) =>
          habit.prerequisiteIds.map((prereqId) => {
            const from = posById.get(prereqId);
            const to = posById.get(habit.id);
            if (!from || !to) return null;
            return (
              <path
                key={`${prereqId}-${habit.id}`}
                d={`M ${from[0]} ${from[1]} C ${(from[0] + to[0]) / 2} ${from[1]}, ${(from[0] + to[0]) / 2} ${to[1]}, ${to[0]} ${to[1]}`}
                fill="none"
                stroke="#a8a29e"
                strokeWidth={1.5}
                strokeDasharray="5 5"
              />
            );
          }),
        )}

        {/* mystery cells */}
        {fillers.map(([c, r]) => {
          const [cx, cy] = center(c, r);
          const style = statusStyle.mystery;
          return (
            <g key={`f-${c}-${r}`}>
              <path
                d={organicCellPath(cx, cy, CELL_W - 14, CELL_H - 14, c * 31 + r * 7 + 1)}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={1.5}
              />
              <text
                x={cx}
                y={cy + 5}
                textAnchor="middle"
                fontSize={16}
                fill={style.text}
              >
                · · ·
              </text>
            </g>
          );
        })}

        {/* now + success anchors */}
        {(
          [
            [0, midRow, "now", "🚶", "anchor"],
            [cols - 1, midRow, "success", "✨", "anchor"],
          ] as const
        ).map(([c, r, label, icon]) => {
          const [cx, cy] = center(c, r);
          const style = statusStyle.anchor;
          return (
            <g key={label}>
              <path
                d={organicCellPath(cx, cy, CELL_W - 14, CELL_H - 14, c * 31 + r * 7 + 5)}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={2}
              />
              <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22}>
                {icon}
              </text>
              <text
                x={cx}
                y={cy + 22}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                fill={style.text}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* habit cells */}
        {placed.map(({ habit, col, row }) => {
          const [cx, cy] = center(col, row);
          const style = statusStyle[habit.status];
          const selected = habit.id === selectedId;
          const locked = habit.status === "LOCKED";
          return (
            <g
              key={habit.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(habit);
              }}
            >
              <path
                d={organicCellPath(cx, cy, CELL_W - 14, CELL_H - 14, habit.id * 131 + 17)}
                fill={style.fill}
                stroke={selected ? "#d97706" : style.stroke}
                strokeWidth={selected ? 3 : 1.8}
              />
              <text
                x={cx}
                y={cy - 6}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                fill={style.text}
              >
                {locked ? "🔒 " : ""}
                {habit.name.length > 18 ? habit.name.slice(0, 17) + "…" : habit.name}
              </text>
              <text x={cx} y={cy + 16} textAnchor="middle" fontSize={12} fill={style.text}>
                {habit.status === "VALID"
                  ? `✓ valid · 🔥 ${habit.currentStreak}`
                  : locked
                    ? "locked"
                    : `🔥 ${habit.currentStreak}/${habit.requiredStreak}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
