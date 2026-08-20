"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlertTriangle,
  Ban,
  Check,
  Flame,
  Footprints,
  Lock,
  Sparkles,
  Zap,
} from "lucide-react";
import { habitRisk, riskNote, type Habit } from "@/lib/types";
import { useTheme } from "@/lib/theme";

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/*                                                                     */
/* A custom layered layout. Columns are prerequisite depth (left to    */
/* right). The longest dependency chain (the "spine") is pinned to a   */
/* straight line down the vertical CENTRE; in every column the other   */
/* habits are split evenly above and below it, ordered near their      */
/* prerequisites so arcs stay untangled. Lone habits fall to the top   */
/* and bottom edges, and the map reads as one main path to success.    */
/* ------------------------------------------------------------------ */

const NODE_W = 190;
const NODE_H = 104;
const COL_W = 240; // horizontal gap between depth columns
const ROW_H = 132; // vertical gap between stacked habits
const ANCHOR_W = 150;
const ANCHOR_GAP = 60;

interface Layout {
  positions: Map<string, { x: number; y: number }>;
}

function computeLayout(habits: Habit[]): Layout {
  if (habits.length === 0) return { positions: new Map() };

  const ids = new Set(habits.map((h) => h.id));
  const byId = new Map(habits.map((h) => [h.id, h]));
  const prereqsOf = (h: Habit) => h.prerequisiteIds.filter((p) => ids.has(p));

  // Longest dependency chain ending at each habit → its depth (rank), plus the
  // best predecessor so we can walk back the single longest chain (the spine).
  const chainLen = new Map<number, number>();
  const chainPrev = new Map<number, number | null>();
  const lenOf = (h: Habit): number => {
    const cached = chainLen.get(h.id);
    if (cached !== undefined) return cached;
    chainLen.set(h.id, 1); // guard against cycles (backend forbids them anyway)
    let best = 0;
    let prev: number | null = null;
    for (const p of prereqsOf(h)) {
      const v = lenOf(byId.get(p)!);
      if (v > best) {
        best = v;
        prev = p;
      }
    }
    chainLen.set(h.id, best + 1);
    chainPrev.set(h.id, prev);
    return best + 1;
  };
  habits.forEach(lenOf);

  let last = habits[0];
  habits.forEach((h) => {
    if ((chainLen.get(h.id) ?? 0) > (chainLen.get(last.id) ?? 0)) last = h;
  });
  const spineIds = new Set<number>();
  for (let cur: number | null | undefined = last.id; cur != null; cur = chainPrev.get(cur)) {
    spineIds.add(cur);
  }

  const rankOf = (id: number) => (chainLen.get(id) ?? 1) - 1;
  const maxRank = Math.max(...habits.map((h) => rankOf(h.id)));

  const columns: Habit[][] = Array.from({ length: maxRank + 1 }, () => []);
  habits.forEach((h) => columns[rankOf(h.id)].push(h));

  // Assign y column by column (left → right, so prerequisites are placed first).
  // Each column is centred on its spine node; the rest are ordered by the mean
  // y of their prerequisites and split half above, half below.
  const yOf = new Map<number, number>();
  const barycentre = (h: Habit) => {
    const ps = prereqsOf(h);
    if (!ps.length) return 0;
    return ps.reduce((sum, p) => sum + (yOf.get(p) ?? 0), 0) / ps.length;
  };
  for (let r = 0; r <= maxRank; r++) {
    const spineNode = columns[r].find((h) => spineIds.has(h.id));
    const others = columns[r]
      .filter((h) => !spineIds.has(h.id))
      .sort((a, b) => barycentre(a) - barycentre(b) || a.id - b.id);
    const half = Math.round(others.length / 2);
    const ordered = spineNode
      ? [...others.slice(0, half), spineNode, ...others.slice(half)]
      : others;
    const centre = spineNode ? half : (ordered.length - 1) / 2;
    ordered.forEach((h, i) => yOf.set(h.id, (i - centre) * ROW_H));
  }

  const positions = new Map<string, { x: number; y: number }>();
  habits.forEach((h) =>
    positions.set(String(h.id), {
      x: rankOf(h.id) * COL_W,
      y: (yOf.get(h.id) ?? 0) - NODE_H / 2,
    }),
  );

  // now / success: edge-free decorative bookends at the ends, aligned with the spine.
  positions.set("now", { x: -ANCHOR_GAP - ANCHOR_W, y: -NODE_H / 2 });
  positions.set("success", { x: maxRank * COL_W + NODE_W + ANCHOR_GAP, y: -NODE_H / 2 });

  return { positions };
}

/* Stable organic blob per habit: varied border-radius from the id. */
function blobRadius(seed: number): string {
  const r = (n: number) => 38 + ((seed * (n * 13 + 7)) % 25);
  return `${r(1)}% ${100 - r(1)}% ${r(2)}% ${100 - r(2)}% / ${r(3)}% ${r(4)}% ${100 - r(4)}% ${100 - r(3)}%`;
}

/* ------------------------------------------------------------------ */
/* Custom nodes                                                        */
/* ------------------------------------------------------------------ */

type HabitNodeData = { habit: Habit; selected: boolean };
type AnchorNodeData = { label: string };

function HabitNode({ data }: NodeProps<Node<HabitNodeData>>) {
  const { habit, selected } = data;
  const locked = habit.status === "LOCKED";
  const valid = habit.status === "VALID";
  // A validated island drifting back down: it stops being green and starts
  // asking for a day of attention.
  const risk = habitRisk(habit);
  const pct = habit.requiredStreak > 0
    ? Math.min(100, (habit.gauge / habit.requiredStreak) * 100)
    : 0;

  return (
    <div
      title={risk ? `${habit.name} — ${riskNote[risk]}` : undefined}
      className={`relative h-26 w-47.5 overflow-hidden border-2 shadow-sm transition-shadow ${
        selected
          ? "border-amber-500 shadow-lg shadow-amber-200/60"
          : locked
            ? "border-line-strong"
            : risk === "critical"
              ? "border-rose-500 shadow-md shadow-rose-200/70 dark:shadow-rose-950"
              : risk === "caution"
                ? "border-amber-600"
                : valid
                  ? "border-emerald-700/60"
                  : "border-amber-800/50"
      } ${locked ? "bg-surface-sunken" : "bg-amber-50 dark:bg-amber-400/10"}`}
      style={{ borderRadius: blobRadius(habit.id) }}
    >
      {/* gauge liquid */}
      {!locked && pct > 0 && (
        <div
          className={`absolute inset-x-0 bottom-0 transition-all duration-700 ${
            risk === "critical"
              ? "bg-rose-300/70"
              : valid && !risk
                ? "bg-emerald-300/60"
                : "bg-amber-300/60"
          }`}
          style={{ height: `${pct}%` }}
        />
      )}
      <div className="relative flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
        <p
          className={`flex max-w-full items-center gap-1 truncate text-sm font-semibold ${
            locked ? "text-ink-soft" : "text-ink"
          }`}
        >
          {locked && <Lock size={12} className="shrink-0" />}
          {!locked && habit.habitType === "QUIT" && (
            <Ban size={12} className="shrink-0 text-red-500" />
          )}
          <span className="truncate">{habit.name}</span>
        </p>
        {locked ? (
          <p className="text-xs text-stone-400">locked</p>
        ) : (
          <p
            className={`flex items-center gap-1 text-xs ${
              locked ? "text-stone-400" : "text-ink-soft"
            }`}
          >
            {risk ? (
              <AlertTriangle
                size={12}
                className={
                  risk === "critical"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-amber-600 dark:text-amber-400"
                }
              />
            ) : (
              valid && <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
            )}
            <Zap size={11} className="text-amber-600" />
            {habit.gauge}/{habit.requiredStreak}
            <span className="text-ink-faint">·</span>
            <Flame size={11} className="text-orange-500" />
            {habit.currentStreak}
          </p>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="invisible!" />
      <Handle type="source" position={Position.Right} className="invisible!" />
    </div>
  );
}

function AnchorNode({ data }: NodeProps<Node<AnchorNodeData>>) {
  const Icon = data.label === "now" ? Footprints : Sparkles;
  return (
    <div
      className="flex h-26 w-37.5 flex-col items-center justify-center gap-1 border-2 border-amber-800/60 bg-amber-100 dark:bg-amber-400/15 shadow-sm"
      style={{ borderRadius: blobRadius(data.label === "now" ? 5 : 9) }}
    >
      <Icon size={22} className="text-amber-700 dark:text-amber-300" />
      <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">{data.label}</span>
      <Handle type="target" position={Position.Left} className="invisible!" />
      <Handle type="source" position={Position.Right} className="invisible!" />
    </div>
  );
}

const nodeTypes: NodeTypes = { habit: HabitNode, anchor: AnchorNode };

/* ------------------------------------------------------------------ */

interface IslandMapProps {
  habits: Habit[];
  selectedId: number | null;
  onSelect: (habit: Habit | null) => void;
}

export function IslandMap({ habits, selectedId, onSelect }: IslandMapProps) {
  const { resolved } = useTheme();

  // Layout depends only on graph STRUCTURE (which habit points to which), so
  // memoise it on a signature of ids + prerequisites — selection or a gauge
  // change then doesn't recompute positions.
  const structure = habits
    .map((h) => `${h.id}>${[...h.prerequisiteIds].sort((a, b) => a - b).join(",")}`)
    .join("|");
  const layout = useMemo(() => computeLayout(habits), [structure]); // eslint-disable-line react-hooks/exhaustive-deps

  const nodes = useMemo<Node[]>(() => {
    const list: Node[] = [
      {
        id: "now",
        type: "anchor",
        position: layout.positions.get("now") ?? { x: 0, y: 0 },
        data: { label: "now" },
        draggable: false,
        selectable: false,
      },
      {
        id: "success",
        type: "anchor",
        position: layout.positions.get("success") ?? { x: 0, y: 0 },
        data: { label: "success" },
        draggable: false,
        selectable: false,
      },
    ];
    habits.forEach((habit) => {
      list.push({
        id: String(habit.id),
        type: "habit",
        position: layout.positions.get(String(habit.id)) ?? { x: 0, y: 0 },
        data: { habit, selected: habit.id === selectedId },
        draggable: false,
      });
    });
    return list;
  }, [habits, layout, selectedId]);

  const edges = useMemo<Edge[]>(
    () =>
      habits.flatMap((habit) =>
        habit.prerequisiteIds.map((prereqId) => {
          const prereq = habits.find((h) => h.id === prereqId);
          const flowing = prereq?.status === "VALID";
          return {
            id: `${prereqId}-${habit.id}`,
            source: String(prereqId),
            target: String(habit.id),
            animated: flowing,
            style: {
              stroke: flowing ? "#d97706" : "#a8a29e",
              strokeWidth: 1.5,
              strokeDasharray: flowing ? undefined : "6 6",
            },
          };
        }),
      ),
    [habits],
  );

  return (
    // React Flow needs a concrete height, not just min/flex sizing.
    <div className="h-[calc(100dvh-220px)] min-h-105 overflow-hidden rounded-xl border border-line-strong bg-surface-sunken">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={resolved}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.6}
        nodesConnectable={false}
        onNodeClick={(_, node) => {
          const habit = habits.find((h) => String(h.id) === node.id);
          if (habit) onSelect(habit);
        }}
        onPaneClick={() => onSelect(null)}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
