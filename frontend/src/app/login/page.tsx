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
        className="w-full max-w-sm space-y-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 shadow-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="fromNowToSuccess logo" className="mx-auto h-16 w-16" />
        <h1 className="text-center text-xl font-semibold">
          fromNow<span className="text-amber-600">To</span>Success
        </h1>
        <p className="text-center text-sm text-stone-500 dark:text-stone-400">
          Welcome back. Your roadmap is waiting.
        </p>

        {error && (
          <p className="rounded-md bg-red-50 dark:bg-red-950/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
        )}

        <label className="block text-sm">
          <span className="text-stone-600 dark:text-stone-300">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 focus:border-amber-500 focus:outline-none"
          />
        </label>

        <label className="block text-sm">
          <span className="text-stone-600 dark:text-stone-300">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 focus:border-amber-500 focus:outline-none"
          />
        </label>

        <button
          disabled={busy}
          className="w-full rounded-md bg-stone-800 dark:bg-stone-600 py-2 font-medium text-white transition-colors hover:bg-stone-700 dark:hover:bg-stone-500 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-sm text-stone-500 dark:text-stone-400">
          No account?{" "}
          <Link href="/register" className="text-amber-700 hover:underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
