"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useOnboarding } from "@/lib/onboarding";
import { BookOpen, ClipboardList, LogOut, MapPin, Monitor, Moon, Sun } from "lucide-react";
import { PageHeader, PageShell } from "@/components/ui/Page";
import { Segmented } from "@/components/ui/Segmented";
import {
  pushSupported,
  sendTestNotification,
  subscribeToPush,
  syncSubscription,
  unsubscribeFromPush,
} from "@/lib/push";

function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
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
    <PageShell width="form">
      <PageHeader title="Settings" subtitle="How the app fits around your day." />

      {error && (
        <p className="mb-4 rounded-md bg-red-50 dark:bg-red-950/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}
      {saved && (
        <p className="mb-4 rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          Settings saved.
        </p>
      )}

      <section className="card space-y-4 p-5">
        <h2 className="font-medium">Daily reminder</h2>

        <label className="block text-sm">
          <span className="flex items-center justify-between text-ink-soft">
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
            className="field mt-1"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-ink-soft">Ask me about my day at</span>
          <select
            value={reminderHour}
            onChange={(e) => setReminderHour(Number(e.target.value))}
            className="field mt-1"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-ink-soft">My day ends at</span>
          <select
            value={dayEndHour}
            onChange={(e) => setDayEndHour(Number(e.target.value))}
            className="field mt-1"
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
          <span className="text-ink-soft">My week starts on</span>
          <select
            value={weekStartDay}
            onChange={(e) => setWeekStartDay(Number(e.target.value))}
            className="field mt-1"
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
          className="btn btn-primary"
        >
          Save
        </button>
      </section>

      <section className="card mt-4 space-y-3 p-5">
        <h2 className="font-medium">Extras</h2>
        <button
          onClick={togglePlanner}
          disabled={plannerBusy}
          className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all disabled:opacity-50 ${
            plannerOn
              ? "border-amber-400 bg-amber-50 shadow-sm dark:bg-amber-400/10"
              : "border-stone-200 hover:border-line-strong dark:hover:border-stone-600"
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
            <span className="block text-xs text-ink-soft">
              A timeline of your day — add a &ldquo;Plan&rdquo; tab and pull habits
              straight into it.
            </span>
          </span>
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              plannerOn ? "bg-amber-500" : "bg-line-strong"
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

      <section className="card mt-4 space-y-3 p-5">
        <h2 className="font-medium">Appearance</h2>
        <Segmented
          value={theme}
          onChange={setTheme}
          ariaLabel="Colour theme"
          options={[
            {
              value: "light",
              label: (
                <span className="flex items-center justify-center gap-1.5">
                  <Sun size={14} /> Light
                </span>
              ),
            },
            {
              value: "system",
              label: (
                <span className="flex items-center justify-center gap-1.5">
                  <Monitor size={14} /> System
                </span>
              ),
            },
            {
              value: "dark",
              label: (
                <span className="flex items-center justify-center gap-1.5">
                  <Moon size={14} /> Dark
                </span>
              ),
            },
          ]}
        />
      </section>

      <section className="card mt-4 space-y-3 p-5">
        <h2 className="font-medium">Browser notifications</h2>
        <p className="text-sm text-ink-soft">
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
              className={`btn ${pushOn ? "btn-ghost" : "btn-primary"}`}
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
                className="btn btn-ghost"
              >
                Send a test notification
              </button>
            )}
          </div>
        )}
      </section>

      <section className="card mt-4 space-y-3 p-5">
        <h2 className="font-medium">Account</h2>
        <p className="text-sm text-ink-soft">
          Signed in as <span className="font-medium text-ink">{user?.username}</span>
          {user?.email ? ` · ${user.email}` : ""}
        </p>
        {/* The nav bar only offers this on a desktop, so it has to be here. */}
        <button onClick={logout} className="btn btn-ghost">
          <LogOut size={15} /> Sign out
        </button>
      </section>

      <button
        onClick={showGuide}
        className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-ink"
      >
        <BookOpen size={13} /> Replay the app guide
      </button>
    </PageShell>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <SettingsPage />
    </RequireAuth>
  );
}
