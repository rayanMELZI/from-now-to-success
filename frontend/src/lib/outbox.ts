"use client";

import { useSyncExternalStore } from "react";
import { api, isOfflineError } from "./api";
import type { CheckinResult, UserInfo } from "./types";

/**
 * Check-ins answered with no connection, held until one comes back.
 *
 * The queue stores INTENTS ("habit 4, done, on this day"), never outcomes:
 * the gauge, the streak and the points are the server's to work out, and a
 * second copy of those rules living here is exactly how the two would drift.
 * So an answer made offline shows as answered and nothing more — the numbers
 * land when it syncs.
 *
 * Each answer carries the logical day it was given, because by the time the
 * queue drains the server's "today" may have rolled on. See forDate in the
 * check-in API.
 */

const KEY = "fnts.outbox";

export interface QueuedAnswer {
  habitId: number;
  done: boolean;
  reason?: string;
  freeze?: boolean;
  /** The logical day this answer belongs to, as yyyy-mm-dd. */
  forDate: string;
  queuedAt: number;
}

/** Why the server refused a day's answers, kept so the user can be told. */
export interface OutboxRejection {
  forDate: string;
  count: number;
  message: string;
}

/* ------------------------------------------------------------------ store */

const listeners = new Set<() => void>();
/**
 * useSyncExternalStore compares snapshots by identity, so the parsed array has
 * to be the same object until something actually changes — re-parsing on every
 * read would re-render for ever.
 */
let cached: QueuedAnswer[] | null = null;
let rejection: OutboxRejection | null = null;

const EMPTY: QueuedAnswer[] = [];

function read(): QueuedAnswer[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedAnswer[]) : [];
  } catch {
    // Private mode, a full quota, or a half-written value: an unreadable
    // queue must not take the app down with it.
    return [];
  }
}

function write(next: QueuedAnswer[]) {
  cached = next;
  try {
    if (next.length > 0) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* nothing persisted, but this session still knows what is pending */
  }
  notify();
}

function notify() {
  for (const listener of listeners) listener();
}

function snapshot(): QueuedAnswer[] {
  if (typeof window === "undefined") return EMPTY;
  cached ??= read();
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab may have queued or drained something.
  const fromOtherTab = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      cached = null;
      notify();
    }
  };
  window.addEventListener("storage", fromOtherTab);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", fromOtherTab);
  };
}

/* --------------------------------------------------------------- the queue */

/**
 * Queue one answer. Answering the same habit twice for the same day before a
 * sync replaces the first — the user changed their mind, they did not answer
 * twice.
 */
export function enqueue(answer: Omit<QueuedAnswer, "queuedAt">) {
  const rest = snapshot().filter(
    (queued) =>
      !(queued.habitId === answer.habitId && queued.forDate === answer.forDate),
  );
  write([...rest, { ...answer, queuedAt: Date.now() }]);
}

export function clearRejection() {
  if (rejection === null) return;
  rejection = null;
  notify();
}

/** Reactive pending count, for the chrome that reports it. */
export function usePendingCount(): number {
  return useSyncExternalStore(
    subscribe,
    () => snapshot().length,
    () => 0,
  );
}

/** Reactive view of the last refusal, so it can be shown once and dismissed. */
export function useRejection(): OutboxRejection | null {
  return useSyncExternalStore(
    subscribe,
    () => rejection,
    () => null,
  );
}

/** Everything this device is holding, for the account that just signed out. */
export function clearOutbox() {
  rejection = null;
  write([]);
}

/* -------------------------------------------------------------- the logical day */

/**
 * The user's own "today", the same way the server works it out: a day-end
 * hour of 3 keeps 01:00 on yesterday's sheet, and one of 20 starts tomorrow
 * at 20:00. Trusting the last cached response instead would stamp a stale
 * day onto an answer given after midnight.
 */
export function logicalToday(
  user: Pick<UserInfo, "timezone" | "dayEndHour">,
  now: Date = new Date(),
): string {
  const boundary = user.dayEndHour;
  const shiftHours = boundary <= 12 ? -boundary : 24 - boundary;
  return dateInZone(new Date(now.getTime() + shiftHours * 3_600_000), user.timezone);
}

function dateInZone(at: Date, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  try {
    // en-CA renders exactly yyyy-mm-dd, which is what the API expects.
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone }).format(at);
  } catch {
    // An unknown zone must not lose the answer; the device's own is close.
    return new Intl.DateTimeFormat("en-CA", options).format(at);
  }
}

/* ------------------------------------------------------------------ syncing */

let flushing: Promise<void> | null = null;

/**
 * Send everything queued, oldest day first so the server rebuilds the history
 * in the order it happened. One request per day, because a check-in answers
 * one day.
 *
 * Concurrent callers (a reconnect and a page mount racing) share one run.
 */
export function flushOutbox(): Promise<void> {
  flushing ??= runFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function runFlush(): Promise<void> {
  const queue = snapshot();
  if (queue.length === 0) return;

  const byDate = new Map<string, QueuedAnswer[]>();
  for (const answer of queue) {
    const group = byDate.get(answer.forDate);
    if (group) group.push(answer);
    else byDate.set(answer.forDate, [answer]);
  }

  for (const forDate of [...byDate.keys()].sort()) {
    const group = byDate.get(forDate)!;
    try {
      await api<CheckinResult>("/api/checkins", {
        method: "POST",
        body: {
          forDate,
          entries: group.map((answer) => ({
            habitId: answer.habitId,
            done: answer.done,
            reason: answer.reason,
            freeze: answer.freeze,
          })),
        },
      });
    } catch (err) {
      // Still no connection: keep the whole queue exactly as it is.
      if (isOfflineError(err)) return;
      // The server refused this day and always will (too old to save, or a
      // habit that no longer exists). Dropping it is what stops every later
      // day from queueing up behind a request that can never succeed.
      rejection = {
        forDate,
        count: group.length,
        message: err instanceof Error ? err.message : "The server refused it",
      };
    }
    drop(forDate);
  }
}

function drop(forDate: string) {
  write(snapshot().filter((answer) => answer.forDate !== forDate));
}
