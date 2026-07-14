"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth, useAuth } from "@/lib/auth";
import {
  getSubscription,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [reminderHour, setReminderHour] = useState(user?.reminderHour ?? 21);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    // getSubscription resolves to null when push is unsupported.
    getSubscription()
      .then((sub) => setPushOn(!!sub))
      .catch(() => setPushOn(false));
  }, []);

  const timezones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : ["UTC"];

  async function saveSettings() {
    setError(null);
    setSaved(false);
    try {
      await api("/api/users/me/settings", {
        method: "PATCH",
        body: { timezone, reminderHour },
      });
      await refreshUser();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function togglePush() {
    setPushBusy(true);
    setError(null);
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error("Notification permission was denied by the browser");
        }
        await subscribeToPush();
        setPushOn(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push setup failed");
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg flex-1 p-4">
      <h1 className="mb-4 text-lg font-semibold">Settings</h1>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {saved && (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Settings saved.
        </p>
      )}

      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="font-medium">Daily reminder</h2>

        <label className="block text-sm">
          <span className="text-stone-600">Your timezone</span>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-stone-600">Ask me about my day at</span>
          <select
            value={reminderHour}
            onChange={(e) => setReminderHour(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={saveSettings}
          className="rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          Save
        </button>
      </section>

      <section className="mt-4 space-y-3 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="font-medium">Browser notifications</h2>
        <p className="text-sm text-stone-500">
          Get a push notification on this device at your reminder hour — only on days
          you haven&apos;t checked in yet. It never nags twice.
        </p>
        {!pushSupported() ? (
          <p className="text-sm text-stone-400">
            This browser doesn&apos;t support push notifications.
          </p>
        ) : (
          <button
            onClick={togglePush}
            disabled={pushBusy || pushOn === null}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              pushOn
                ? "border border-stone-300 hover:bg-stone-100"
                : "bg-amber-600 text-white hover:bg-amber-500"
            }`}
          >
            {pushBusy
              ? "Working…"
              : pushOn
                ? "Disable notifications on this device"
                : "Enable notifications on this device"}
          </button>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <SettingsPage />
    </RequireAuth>
  );
}
