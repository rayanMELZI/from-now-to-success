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
import dagre from "@dagrejs/dagre";
import { Ban, Check, Flame, Footprints, Lock, Sparkles, Zap } from "lucide-react";
import type { Habit } from "@/lib/types";
import { useTheme } from "@/lib/theme";

/* ------------------------------------------------------------------ */
/* Layout: dagre lays the prerequisite DAG out left-to-right. It ranks */
/* nodes by prerequisite depth AND minimises edge crossings within     */
/* each rank, so connected habits line up and the arcs read cleanly —  */
/* instead of the old creation-order (FIFO) row placement.             */
/* ------------------------------------------------------------------ */

const NODE_W = 190;
const NODE_H = 104;
const ANCHOR_W = 150;
const ANCHOR_GAP = 60;

interface Positioned {
  positions: Map<number, { x: number; y: number }>;
  now: { x: number; y: number };
  success: { x: number; y: number };
}

/** Runs dagre; returns React Flow top-left positions plus anchor spots. */
function layoutHabits(habits: Habit[]): Positioned {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep: 80, nodesep: 28, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  const ids = new Set(habits.map((h) => h.id));
  habits.forEach((h) => g.setNode(String(h.id), { width: NODE_W, height: NODE_H }));
  habits.forEach((h) =>
    h.prerequisiteIds
      .filter((p) => ids.has(p)) // ignore dangling prereqs
      .forEach((p) => g.setEdge(String(p), String(h.id))),
  );

  dagre.layout(g);

  const positions = new Map<number, { x: number; y: number }>();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  habits.forEach((h) => {
    const n = g.node(String(h.id)); // dagre gives the node CENTRE
    const x = n.x - NODE_W / 2;
    const y = n.y - NODE_H / 2;
    positions.set(h.id, { x, y });
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + NODE_W);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + NODE_H);
  });

  const centreY = (minY + maxY) / 2 - NODE_H / 2;
  return {
    positions,
    now: { x: minX - ANCHOR_GAP - ANCHOR_W, y: centreY },
    success: { x: maxX + ANCHOR_GAP, y: centreY },
  };
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

  // The dagre layout only depends on the graph STRUCTURE (which habit points
  // to which), so memoise it on a signature of ids + prerequisites. Changing
  // selection or a gauge value then doesn't recompute positions.
  const structure = habits
    .map((h) => `${h.id}>${[...h.prerequisiteIds].sort((a, b) => a - b).join(",")}`)
    .join("|");
  const layout = useMemo(() => layoutHabits(habits), [structure]); // eslint-disable-line react-hooks/exhaustive-deps

  const nodes = useMemo<Node[]>(() => {
    const list: Node[] = [
      {
        id: "now",
        type: "anchor",
        position: layout.now,
        data: { label: "now" },
        draggable: false,
        selectable: false,
      },
      {
        id: "success",
        type: "anchor",
        position: layout.success,
        data: { label: "success" },
        draggable: false,
        selectable: false,
      },
    ];
    habits.forEach((habit) => {
      list.push({
        id: String(habit.id),
        type: "habit",
        position: layout.positions.get(habit.id) ?? { x: 0, y: 0 },
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
