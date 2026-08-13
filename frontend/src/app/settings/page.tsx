"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useOnboarding } from "@/lib/onboarding";
import { BookOpen, ClipboardList, MapPin, Monitor, Moon, Sun } from "lucide-react";
import {
  pushSupported,
  sendTestNotification,
  subscribeToPush,
  syncSubscription,
  unsubscribeFromPush,
} from "@/lib/push";

function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { show: showGuide } = useOnboarding();
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [reminderHour, setReminderHour] = useState(user?.reminderHour ?? 21);
  const [dayEndHour, setDayEndHour] = useState(user?.dayEndHour ?? 0);
  const [weekStartDay, setWeekStartDay] = useState(user?.weekStartDay ?? 1);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  // The daily plan is opt-in, so the switch reads straight from the account.
  const plannerOn = user?.plannerEnabled ?? false;
  const [plannerBusy, setPlannerBusy] = useState(false);

  useEffect(() => {
    // Also re-saves the browser subscription to the backend (self-healing).
    syncSubscription()
      .then(setPushOn)
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
        body: { timezone, reminderHour, dayEndHour, weekStartDay },
      });
      await refreshUser();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function togglePlanner() {
    setPlannerBusy(true);
    setError(null);
    try {
      await api("/api/users/me/settings", {
        method: "PATCH",
        body: { plannerEnabled: !plannerOn },
      });
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setPlannerBusy(false);
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
        <p className="mb-4 rounded-md bg-red-50 dark:bg-red-950/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}
      {saved && (
        <p className="mb-4 rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          Settings saved.
        </p>
      )}

      <section className="space-y-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-sm">
        <h2 className="font-medium">Daily reminder</h2>

        <label className="block text-sm">
          <span className="flex items-center justify-between text-stone-600 dark:text-stone-300">
            Your timezone
            <button
              type="button"
              onClick={() =>
                setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
              }
              className="rounded-full bg-amber-100 dark:bg-amber-400/15 px-3 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300 transition-colors hover:bg-amber-200 dark:hover:bg-amber-400/30"
            >
              <span className="flex items-center gap-1"><MapPin size={12} /> Detect automatically</span>
            </button>
          </span>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 focus:border-amber-500 focus:outline-none"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-stone-600 dark:text-stone-300">Ask me about my day at</span>
          <select
            value={reminderHour}
            onChange={(e) => setReminderHour(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 focus:border-amber-500 focus:outline-none"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-stone-600 dark:text-stone-300">My day ends at</span>
          <select
            value={dayEndHour}
            onChange={(e) => setDayEndHour(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 focus:border-amber-500 focus:outline-none"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {h === 0
                  ? "midnight"
                  : `${String(h).padStart(2, "0")}:00 ${h <= 12 ? "(night owl)" : "(early bird)"}`}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-stone-400">
            Checking in before this hour still counts for the previous day.
          </span>
        </label>

        <label className="block text-sm">
          <span className="text-stone-600 dark:text-stone-300">My week starts on</span>
          <select
            value={weekStartDay}
            onChange={(e) => setWeekStartDay(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 focus:border-amber-500 focus:outline-none"
          >
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
              (day, i) => (
                <option key={day} value={i + 1}>
                  {day}
                </option>
              ),
            )}
          </select>
          <span className="mt-1 block text-xs text-stone-400">
            Weekly habits reset on this day.
          </span>
        </label>

        <button
          onClick={saveSettings}
          className="rounded-md bg-stone-800 dark:bg-stone-600 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 dark:hover:bg-stone-500"
        >
          Save
        </button>
      </section>

      <section className="mt-4 space-y-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-sm">
        <h2 className="font-medium">Extras</h2>
        <button
          onClick={togglePlanner}
          disabled={plannerBusy}
          className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all disabled:opacity-50 ${
            plannerOn
              ? "border-amber-400 bg-amber-50 shadow-sm dark:bg-amber-400/10"
              : "border-stone-200 hover:border-stone-300 dark:border-stone-700 dark:hover:border-stone-600"
          }`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
              plannerOn
                ? "scale-110 bg-amber-500 text-white"
                : "bg-amber-100 text-amber-600 dark:bg-amber-900/50"
            }`}
          >
            <ClipboardList size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`block text-sm font-semibold ${
                plannerOn ? "text-amber-800 dark:text-amber-300" : ""
              }`}
            >
              Daily plan
            </span>
            <span className="block text-xs text-stone-500 dark:text-stone-400">
              A timeline of your day — add a &ldquo;Plan&rdquo; tab and pull habits
              straight into it.
            </span>
          </span>
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              plannerOn ? "bg-amber-500" : "bg-stone-300 dark:bg-stone-600"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                plannerOn ? "left-5.5" : "left-0.5"
              }`}
            />
          </span>
        </button>
      </section>

      <section className="mt-4 space-y-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-sm">
        <h2 className="font-medium">Appearance</h2>
        <div className="flex rounded-lg bg-stone-100 dark:bg-stone-800 p-1">
          {(["light", "system", "dark"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setTheme(option)}
              className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium capitalize transition-all ${
                theme === option
                  ? "bg-white dark:bg-stone-600 text-stone-800 dark:text-stone-100 shadow-sm"
                  : "text-stone-500 dark:text-stone-400"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {option === "light" ? <Sun size={14} /> : option === "dark" ? <Moon size={14} /> : <Monitor size={14} />}
                {option}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-sm">
        <h2 className="font-medium">Browser notifications</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Get a push notification on this device at your reminder hour — only on days
          you haven&apos;t checked in yet. It never nags twice.
        </p>
        {!pushSupported() ? (
          <p className="text-sm text-stone-400">
            This browser doesn&apos;t support push notifications.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={togglePush}
              disabled={pushBusy || pushOn === null}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                pushOn
                  ? "border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                  : "bg-amber-600 text-white hover:bg-amber-500"
              }`}
            >
              {pushBusy
                ? "Working…"
                : pushOn
                  ? "Disable on this device"
                  : "Enable notifications on this device"}
            </button>
            {pushOn && (
              <button
                onClick={async () => {
                  setError(null);
                  try {
                    await sendTestNotification();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Test failed");
                  }
                }}
                className="rounded-md border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Send a test notification
              </button>
            )}
          </div>
        )}
      </section>

      <button
        onClick={showGuide}
        className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-stone-400 transition-colors hover:text-stone-600 dark:hover:text-stone-300"
      >
        <BookOpen size={13} /> Replay the app guide
      </button>
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
