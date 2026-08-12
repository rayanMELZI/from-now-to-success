"use client";

import { useSyncExternalStore } from "react";
import type { UserInfo } from "./types";

/**
 * `navigator.onLine` only reports whether a network interface exists — a
 * captive Wi-Fi portal or a backend that is simply down both read as "online".
 * So the authoritative signal is the request layer: api.ts says whether its
 * last call actually reached the server, and the browser events are treated as
 * hints on top of that.
 */

let reachable = true;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (reachable === next) return;
  reachable = next;
  for (const listener of listeners) listener();
}

/** A request came back from the server (or from cache, marked as stale). */
export function reportReachable() {
  set(true);
}

export function reportUnreachable() {
  set(false);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const offline = () => set(false);
  // Regaining an interface is only a guess; the next request confirms it.
  const online = () => set(true);
  window.addEventListener("offline", offline);
  window.addEventListener("online", online);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("offline", offline);
    window.removeEventListener("online", online);
  };
}

const getSnapshot = () => reachable && navigator.onLine;
/** The server can't know; assume online so the markup matches first paint. */
const getServerSnapshot = () => true;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* --------------------------------------------------------- offline identity */

const USER_KEY = "fnts.lastUser";

/**
 * The session itself still lives in an httpOnly cookie and the access token
 * still never leaves memory — this is only the profile already painted on
 * screen, kept so a cold start with no network can render the app instead of
 * bouncing to /login.
 */
export function rememberUser(user: UserInfo | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* private mode or a full quota — offline restore is a nicety, not a must */
  }
}

export function recallUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}
