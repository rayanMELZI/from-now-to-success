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
import { Ban, Check, Flame, Footprints, Lock, Sparkles, Zap } from "lucide-react";
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
type AnchorNodeData = { label: string };

function HabitNode({ data }: NodeProps<Node<HabitNodeData>>) {
  const { habit, selected } = data;
  const locked = habit.status === "LOCKED";
  const valid = habit.status === "VALID";
  const pct = habit.requiredStreak > 0
    ? Math.min(100, (habit.gauge / habit.requiredStreak) * 100)
    : 0;

  return (
    // No box-shadow here on purpose: a blurred shadow on every node forces the
    // browser to re-rasterise each one on every frame while React Flow pans the
    // canvas — the main cause of the mobile/PWA lag. Selection is shown with a
    // thicker coloured border, which composites for free.
    <div
      className={`relative h-26 w-47.5 overflow-hidden ${
        selected
          ? "border-[3px] border-amber-500"
          : locked
            ? "border-2 border-stone-300 dark:border-stone-700"
            : valid
              ? "border-2 border-emerald-700/60"
              : "border-2 border-amber-800/50"
      } ${locked ? "bg-stone-200 dark:bg-stone-800" : "bg-amber-50 dark:bg-amber-400/10"}`}
      style={{ borderRadius: blobRadius(habit.id) }}
    >
      {/* gauge liquid — transition scoped to height so it never re-evaluates
          during a pan (transition-all would watch transform too) */}
      {!locked && pct > 0 && (
        <div
          className={`absolute inset-x-0 bottom-0 transition-[height] duration-500 ${
            valid ? "bg-emerald-300/60" : "bg-amber-300/60"
          }`}
          style={{ height: `${pct}%` }}
        />
      )}
      <div className="relative flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
        <p
          className={`flex max-w-full items-center gap-1 truncate text-sm font-semibold ${
            locked ? "text-stone-500 dark:text-stone-400" : "text-stone-800 dark:text-stone-100"
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
              locked ? "text-stone-400" : "text-stone-600 dark:text-stone-300"
            }`}
          >
            {valid && <Check size={12} className="text-emerald-600 dark:text-emerald-400" />}
            <Zap size={11} className="text-amber-600" />
            {habit.gauge}/{habit.requiredStreak}
            <span className="text-stone-300 dark:text-stone-600">·</span>
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
      className="flex h-26 w-37.5 flex-col items-center justify-center gap-1 border-2 border-amber-800/60 bg-amber-100 dark:bg-amber-400/15"
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
        data: { label: "now" },
        draggable: false,
        selectable: false,
      },
      {
        id: "success",
        type: "anchor",
        position: { x: (maxDepth + 2) * COL_W, y: -52 },
        data: { label: "success" },
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
        nodesDraggable={false}
        // Skip off-screen nodes and drop focus/selection bookkeeping we don't
        // use — less work per frame while panning, especially on mobile.
        onlyRenderVisibleElements
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
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
