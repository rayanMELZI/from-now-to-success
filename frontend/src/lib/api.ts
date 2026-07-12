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

interface AuthPayload {
  accessToken: string;
  user: UserInfo;
}

/** Try to get a fresh access token from the refresh cookie. */
export async function tryRefresh(): Promise<UserInfo | null> {
  const res = await fetch("/api/auth/refresh", { method: "POST" });
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
    fetch(path, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let res = await doFetch();

  // Expired access token? Refresh once and retry the original request.
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    const user = await tryRefresh();
    if (user) res = await doFetch();
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
  const data = await api<AuthPayload>("/api/auth/register", {
    method: "POST",
    body: { username, email, password },
  });
  accessToken = data.accessToken;
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
  accessToken = null;
}
