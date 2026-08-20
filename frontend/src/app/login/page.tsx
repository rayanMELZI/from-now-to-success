"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-8 shadow-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="fromNowToSuccess logo" className="mx-auto h-16 w-16" />
        <h1 className="text-center text-xl font-semibold">
          fromNow<span className="text-amber-600">To</span>Success
        </h1>
        <p className="text-center text-sm text-ink-soft">
          Welcome back. Your roadmap is waiting.
        </p>

        {error && (
          <p className="rounded-md bg-red-50 dark:bg-red-950/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
        )}

        <label className="block text-sm">
          <span className="text-ink-soft">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field mt-1 py-2.5 text-base"
          />
        </label>

        <label className="block text-sm">
          <span className="text-ink-soft">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field mt-1 py-2.5 text-base"
          />
        </label>

        <button
          disabled={busy}
          className="btn btn-primary w-full"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-sm text-ink-soft">
          No account?{" "}
          <Link href="/register" className="text-amber-700 hover:underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
