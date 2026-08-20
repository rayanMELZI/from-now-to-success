"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import * as apiClient from "./api";
import { recallUser, rememberUser } from "./offline";
import type { UserInfo } from "./types";

interface AuthState {
  user: UserInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On first load, try to restore the session from the refresh cookie.
  useEffect(() => {
    apiClient
      .tryRefresh()
      .then((restored) => {
        setUser(restored);
        rememberUser(restored);
      })
      .catch(() => {
        // No network: fall back to the last account this device showed, so the
        // app opens on cached data instead of bouncing everyone to /login.
        setUser(recallUser());
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const loggedIn = await apiClient.login(email, password);
      setUser(loggedIn);
      rememberUser(loggedIn);
      router.push("/");
    },
    [router],
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      const registered = await apiClient.register(username, email, password);
      setUser(registered);
      rememberUser(registered);
      router.push("/");
    },
    [router],
  );

  const logout = useCallback(async () => {
    await apiClient.logout();
    rememberUser(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const refreshUser = useCallback(async () => {
    const fresh = await apiClient.api<UserInfo>("/api/users/me");
    setUser(fresh);
    rememberUser(fresh);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Wrap a page that requires login; redirects to /login otherwise. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center text-ink-faint">
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
