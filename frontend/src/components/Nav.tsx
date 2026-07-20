"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { FeedbackButton } from "./FeedbackButton";
import {
  BarChart3,
  ListChecks,
  Map,
  Moon,
  Settings,
  Star,
  Sun,
} from "lucide-react";

const links = [
  { href: "/", label: "Roadmap", Icon: Map },
  { href: "/checkin", label: "Check-in", Icon: ListChecks },
  { href: "/stats", label: "Stats", Icon: BarChart3 },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function Nav() {
  const { user, logout } = useAuth();
  const { resolved, setTheme } = useTheme();
  const pathname = usePathname();

  if (!user) return null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-stone-300 dark:border-stone-700 bg-white/90 dark:bg-stone-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="h-7 w-7" />
            <span className="hidden sm:inline">
              fromNow<span className="text-amber-600">To</span>Success
            </span>
            <span className="sm:hidden">
              FN<span className="text-amber-600">T</span>S
            </span>
          </Link>

          {/* desktop tabs */}
          <nav className="hidden gap-1 text-sm sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  pathname === link.href
                    ? "bg-stone-800 dark:bg-stone-600 text-white"
                    : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <FeedbackButton />
            <button
              onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
              title="Toggle dark mode"
              className="rounded-full p-2 text-stone-500 dark:text-stone-400 transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              {resolved === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <span
              className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-400/15 px-3 py-1 font-medium text-amber-800 dark:text-amber-300"
              title={`${user.totalPoints} total points`}
            >
              <Star size={13} fill="currentColor" /> {user.totalPoints} · Lv {user.level}
            </span>
            <span className="hidden text-stone-500 dark:text-stone-400 md:inline">{user.username}</span>
            <button
              onClick={logout}
              className="text-stone-400 transition-colors hover:text-stone-700 dark:text-stone-200"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* mobile bottom tab bar — the app-like navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                active
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-stone-400 dark:text-stone-500"
              }`}
            >
              <link.Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
