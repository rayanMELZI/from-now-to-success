"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(username, email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-stone-200 bg-white p-8 shadow-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="fromNowToSuccess logo" className="mx-auto h-16 w-16" />
        <h1 className="text-center text-xl font-semibold">Start your roadmap</h1>
        <p className="text-center text-sm text-stone-500">
          From now to success, one habit at a time.
        </p>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <label className="block text-sm">
          <span className="text-stone-600">Username</span>
          <input
            required
            minLength={2}
            maxLength={50}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
          />
        </label>

        <label className="block text-sm">
          <span className="text-stone-600">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
          />
        </label>

        <label className="block text-sm">
          <span className="text-stone-600">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
          />
          <span className="mt-1 block text-xs text-stone-400">At least 8 characters</span>
        </label>

        <button
          disabled={busy}
          className="w-full rounded-md bg-stone-800 py-2 font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-sm text-stone-500">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-700 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
