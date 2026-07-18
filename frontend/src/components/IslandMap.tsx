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
import type { Habit } from "@/lib/types";
import { useTheme } from "@/lib/theme";

/* ------------------------------------------------------------------ */
/* Layout: column = prerequisite depth, rows spread middle-out.        */
/* ------------------------------------------------------------------ */

const COL_W = 240;
const ROW_H = 150;

function computeDepths(habits: Habit[]): Map<number, number> {
  const byId = new Map(habits.map((h) => [h.id, h]));
  const depths = new Map<number, number>();

  function depthOf(id: number, visiting: Set<number>): number {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // cycle guard (backend forbids cycles anyway)
    visiting.add(id);
    const prereqs = byId.get(id)?.prerequisiteIds ?? [];
    const depth = prereqs.length
      ? 1 + Math.max(...prereqs.map((p) => depthOf(p, visiting)))
      : 0;
    depths.set(id, depth);
    return depth;
  }

  habits.forEach((h) => depthOf(h.id, new Set()));
  return depths;
}

function middleOutRows(count: number): number[] {
  const rows: number[] = [];
  for (let i = 0; i < count; i++) {
    rows.push(Math.ceil(i / 2) * (i % 2 === 0 ? 1 : -1));
  }
  return rows;
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
type AnchorNodeData = { label: string; icon: string };

function HabitNode({ data }: NodeProps<Node<HabitNodeData>>) {
  const { habit, selected } = data;
  const locked = habit.status === "LOCKED";
  const valid = habit.status === "VALID";
  const pct = habit.requiredStreak > 0
    ? Math.min(100, (habit.gauge / habit.requiredStreak) * 100)
    : 0;

  return (
    <div
      className={`relative h-26 w-47.5 overflow-hidden border-2 shadow-sm transition-shadow ${
        selected
          ? "border-amber-500 shadow-lg shadow-amber-200/60"
          : locked
            ? "border-stone-300 dark:border-stone-700"
            : valid
              ? "border-emerald-700/60"
              : "border-amber-800/50"
      } ${locked ? "bg-stone-200 dark:bg-stone-800" : "bg-amber-50 dark:bg-amber-400/10"}`}
      style={{ borderRadius: blobRadius(habit.id) }}
    >
      {/* gauge liquid */}
      {!locked && pct > 0 && (
        <div
          className={`absolute inset-x-0 bottom-0 transition-all duration-700 ${
            valid ? "bg-emerald-300/60" : "bg-amber-300/60"
          }`}
          style={{ height: `${pct}%` }}
        />
      )}
      <div className="relative flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
        <p
          className={`max-w-full truncate text-sm font-semibold ${
            locked ? "text-stone-500 dark:text-stone-400" : "text-stone-800 dark:text-stone-100"
          }`}
        >
          {locked ? "🔒 " : habit.habitType === "QUIT" ? "🚫 " : ""}
          {habit.name}
        </p>
        <p className={`text-xs ${locked ? "text-stone-400" : "text-stone-600 dark:text-stone-300"}`}>
          {locked
            ? "locked"
            : `${valid ? "✓ " : ""}⚡ ${habit.gauge}/${habit.requiredStreak} · 🔥 ${habit.currentStreak}`}
        </p>
      </div>
      <Handle type="target" position={Position.Left} className="invisible!" />
      <Handle type="source" position={Position.Right} className="invisible!" />
    </div>
  );
}

function AnchorNode({ data }: NodeProps<Node<AnchorNodeData>>) {
  return (
    <div
      className="flex h-26 w-37.5 flex-col items-center justify-center border-2 border-amber-800/60 bg-amber-100 dark:bg-amber-400/15 shadow-sm"
      style={{ borderRadius: blobRadius(data.label === "now" ? 5 : 9) }}
    >
      <span className="text-2xl">{data.icon}</span>
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
  const { nodes, edges } = useMemo(() => {
    const depths = computeDepths(habits);
    const maxDepth = habits.length ? Math.max(...depths.values()) : 0;

    const byDepth = new Map<number, Habit[]>();
    habits.forEach((h) => {
      const d = depths.get(h.id) ?? 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d)!.push(h);
    });

    const nodes: Node[] = [
      {
        id: "now",
        type: "anchor",
        position: { x: 0, y: -52 },
        data: { label: "now", icon: "🚶" },
        draggable: false,
        selectable: false,
      },
      {
        id: "success",
        type: "anchor",
        position: { x: (maxDepth + 2) * COL_W, y: -52 },
        data: { label: "success", icon: "✨" },
        draggable: false,
        selectable: false,
      },
    ];

    byDepth.forEach((group, depth) => {
      const sorted = [...group].sort((a, b) => a.id - b.id);
      const rows = middleOutRows(sorted.length);
      sorted.forEach((habit, i) => {
        nodes.push({
          id: String(habit.id),
          type: "habit",
          position: { x: (depth + 1) * COL_W, y: rows[i] * ROW_H - 52 },
          data: { habit, selected: habit.id === selectedId },
          draggable: false,
        });
      });
    });

    const edges: Edge[] = habits.flatMap((habit) =>
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
    );

    return { nodes, edges };
  }, [habits, selectedId]);

  return (
    // React Flow needs a concrete height, not just min/flex sizing.
    <div className="h-[calc(100dvh-220px)] min-h-105 overflow-hidden rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900">
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
