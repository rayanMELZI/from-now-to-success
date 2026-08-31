import { reportReachable, reportUnreachable } from "./offline";
import type { UserInfo } from "./types";

/**
 * The access token lives only in memory (never localStorage — XSS-safe).
 * When it expires, the httpOnly refresh cookie silently gets a new one.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Status 0 means the request never reached the server at all. */
export function isOfflineError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

interface AuthPayload {
  accessToken: string;
  user: UserInfo;
}

/**
 * Every request goes through here so connectivity has exactly one source of
 * truth. The service worker answers from cache when the network is down, and
 * stamps those replies — a 200 alone no longer proves we are online.
 */
async function send(path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    reportUnreachable();
    throw new ApiError(0, "You're offline — this didn't reach the server.");
  }
  if (res.headers.get("x-fnts-offline") === "1") reportUnreachable();
  else reportReachable();
  return res;
}

/**
 * Cached API responses belong to one account; never let them outlive it.
 * Called on every login and logout so a second user on a shared device can't
 * be shown the first one's habits.
 */
export async function clearCachedData(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n.startsWith("fnts-data")).map((n) => caches.delete(n)),
    );
  } catch {
    /* cache API unavailable (private mode) — nothing was stored anyway */
  }
}

/**
 * The refresh currently in flight, if any. Pages fire several requests at
 * once, so when a 15-minute access token expires they ALL come back 401 at
 * the same moment — and each one used to start its own refresh.
 *
 * That is worse than wasteful. Refresh tokens rotate: the first refresh
 * revokes the cookie it was given, so the second one presents a token that
 * has just been revoked, which the server correctly reads as a stolen-token
 * replay and answers by revoking every session the account has. The user is
 * thrown back to the login screen for doing nothing but opening a page.
 *
 * One refresh at a time; everybody waits on the same answer.
 */
let refreshing: Promise<UserInfo | null> | null = null;

/** Try to get a fresh access token from the refresh cookie. */
export function tryRefresh(): Promise<UserInfo | null> {
  refreshing ??= runRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function runRefresh(): Promise<UserInfo | null> {
  const res = await send("/api/auth/refresh", { method: "POST" });
  if (!res.ok) return null;
  const data: AuthPayload = await res.json();
  accessToken = data.accessToken;
  return data.user;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const doFetch = () =>
    send(path, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  const tokenUsed = accessToken;
  let res = await doFetch();

  // Expired access token? Refresh once and retry the original request —
  // unless another request already replaced the token while this one was in
  // the air, in which case retrying with the new one is enough. Every refresh
  // rotates the cookie, so the ones we can skip are worth skipping.
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    if (accessToken !== tokenUsed) {
      res = await doFetch();
    } else {
      const user = await tryRefresh();
      if (user) res = await doFetch();
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function login(email: string, password: string): Promise<UserInfo> {
  await clearCachedData();
  const data = await api<AuthPayload>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  accessToken = data.accessToken;
  return data.user;
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<UserInfo> {
  await clearCachedData();
  const data = await api<AuthPayload>("/api/auth/register", {
    method: "POST",
    body: { username, email, password },
  });
  accessToken = data.accessToken;
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await send("/api/auth/logout", { method: "POST" });
  } catch {
    // Offline: the cookie outlives us server-side, but this device must still
    // forget the account it was showing.
  }
  accessToken = null;
  await clearCachedData();
}
