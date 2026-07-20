"use client";

import { useState, type ReactNode } from "react";
import {
  Bell,
  Ban,
  Check,
  ListChecks,
  Lock,
  Map,
  MessageSquarePlus,
  Snowflake,
  Sprout,
  Zap,
} from "lucide-react";
import { Modal } from "./Modal";
import { GaugeBar } from "./GaugeBar";

interface Step {
  icon: ReactNode;
  color: string; // icon badge background
  title: string;
  body: ReactNode;
}

const steps: Step[] = [
  {
    icon: <Map size={26} />,
    color: "bg-amber-100 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300",
    title: "Your habits, as a roadmap",
    body: (
      <>
        Every habit is a stop on the map from <strong>now</strong> to{" "}
        <strong>success</strong>. Start with a few basic habits — advanced ones
        stay locked until the habits they depend on are validated.
      </>
    ),
  },
  {
    icon: <Zap size={26} />,
    color: "bg-emerald-100 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-300",
    title: "The gauge is everything",
    body: (
      <>
        <p className="mb-3">
          Each habit has a gauge. Doing it fills the gauge by one; missing it
          drains one. A <strong>full gauge validates the habit</strong> and
          unlocks whatever comes next — a couple of missed days won&apos;t
          undo it, but let it sink far enough and the habit gets demoted.
        </p>
        <GaugeBar gauge={4} max={6} valid={false} />
      </>
    ),
  },
  {
    icon: <ListChecks size={26} />,
    color: "bg-sky-100 dark:bg-sky-400/15 text-sky-700 dark:text-sky-300",
    title: "Check in the moment you know",
    body: (
      <>
        No need to wait for the end of the day — answer each habit as soon as
        you&apos;ve done it (or not). Habits can run <strong>daily</strong>,{" "}
        <strong>weekly</strong> or <strong>monthly</strong>, and you can set
        exactly how many times per period.
      </>
    ),
  },
  {
    icon: <Snowflake size={26} />,
    color: "bg-rose-100 dark:bg-rose-400/15 text-rose-700 dark:text-rose-300",
    title: "Misses, reasons & freezes",
    body: (
      <>
        A miss costs points — but writing a reason halves the loss. Out of
        control? Spend a <strong>freeze</strong> (3 per month, for daily and
        weekly habits) to protect your gauge and streak completely. Monthly
        habits get a single rare <strong>Deep Freeze</strong> every 3 months.
      </>
    ),
  },
  {
    icon: <Sprout size={26} />,
    color: "bg-lime-100 dark:bg-lime-400/15 text-lime-700 dark:text-lime-300",
    title: "Build good ones, quit bad ones",
    body: (
      <>
        <span className="mr-1 inline-flex items-center gap-1">
          <Sprout size={14} className="text-emerald-600" /> Build
        </span>
        habits track something you want to start doing;
        <span className="mx-1 inline-flex items-center gap-1">
          <Ban size={14} className="text-red-500" /> Quit
        </span>
        habits track something you&apos;re avoiding. Link a habit to
        prerequisites and it stays{" "}
        <span className="inline-flex items-center gap-1">
          <Lock size={13} /> locked
        </span>{" "}
        until they&apos;re all validated.
      </>
    ),
  },
  {
    icon: <Bell size={26} />,
    color: "bg-violet-100 dark:bg-violet-400/15 text-violet-700 dark:text-violet-300",
    title: "Make it yours",
    body: (
      <>
        Turn on notifications in Settings for a nudge on days you haven&apos;t
        checked in, pick when your day and week start, and switch to dark
        mode any time. You can replay this guide from Settings whenever you
        like.
      </>
    ),
  },
  {
    icon: <MessageSquarePlus size={26} />,
    color: "bg-amber-100 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300",
    title: "Shape what comes next",
    body: (
      <>
        See the{" "}
        <span className="inline-flex items-center gap-1 align-middle">
          <MessageSquarePlus size={14} className="text-amber-600" />
        </span>{" "}
        icon in the top bar? Tap it any time to send an idea, a bug, or a
        feature you wish existed — it goes straight to the developer. This app
        grows from what its users ask for.
      </>
    ),
  },
];

export function OnboardingGuide({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;

  function handleClose() {
    setIndex(0);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="flex flex-col items-center px-1 text-center">
        <span
          className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${step.color}`}
        >
          {step.icon}
        </span>
        <h2 className="text-lg font-semibold">{step.title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {step.body}
        </div>

        <div className="mt-5 flex gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-5 bg-amber-500"
                  : "w-1.5 bg-stone-200 dark:bg-stone-700"
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex w-full items-center gap-2">
          {!last && (
            <button
              onClick={handleClose}
              className="px-2 py-2 text-sm text-stone-400 transition-colors hover:text-stone-600 dark:hover:text-stone-200"
            >
              Skip
            </button>
          )}
          {index > 0 && (
            <button
              onClick={() => setIndex((i) => i - 1)}
              className="rounded-lg border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Back
            </button>
          )}
          <button
            onClick={() => (last ? handleClose() : setIndex((i) => i + 1))}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-500 active:scale-95"
          >
            {last ? (
              <>
                <Check size={15} /> Get started
              </>
            ) : (
              "Next"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
