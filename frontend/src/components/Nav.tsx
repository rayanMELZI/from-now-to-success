"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { FeedbackButton } from "./FeedbackButton";
import {
  BarChart3,
  ClipboardList,
  ListChecks,
  Map,
  Moon,
  Settings,
  Star,
  Sun,
} from "lucide-react";

const baseLinks = [
  { href: "/", label: "Roadmap", Icon: Map },
  { href: "/checkin", label: "Check-in", Icon: ListChecks },
  { href: "/stats", label: "Stats", Icon: BarChart3 },
  { href: "/settings", label: "Settings", Icon: Settings },
];

/** The daily plan is opt-in: no tab at all until the user turns it on. */
const planLink = { href: "/plan", label: "Plan", Icon: ClipboardList };

export function Nav() {
  const { user, logout } = useAuth();
  const { resolved, setTheme } = useTheme();
  const pathname = usePathname();

  if (!user) return null;

  const links = user.plannerEnabled
    ? [...baseLinks.slice(0, 2), planLink, ...baseLinks.slice(2)]
    : baseLinks;

  return (
    <>
      {/* stickiness lives on the wrapper in layout.tsx, shared with the
          offline banner so the two never overlap */}
      <header className="border-b border-line-strong bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
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
                aria-current={pathname === link.href ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-accent-soft text-accent-ink"
                    : "text-ink-soft hover:bg-surface-sunken hover:text-ink"
                }`}
              >
                <link.Icon size={14} />
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Now that "Feedback" is a word and not just an icon, the right
              cluster has to survive a 360px phone: tighter gaps, and the
              level rides along with the points only once there is room. */}
          <div className="ml-auto flex shrink-0 items-center gap-2 text-sm sm:gap-3">
            <FeedbackButton />
            <button
              onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
              title="Toggle dark mode"
              aria-label="Toggle dark mode"
              className="btn-icon rounded-full"
            >
              {resolved === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <span
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-400/15 px-2.5 py-1 font-medium text-amber-800 tabular-nums sm:px-3 dark:text-amber-300"
              title={`${user.totalPoints} total points · level ${user.level}`}
            >
              <Star size={13} fill="currentColor" /> {user.totalPoints}
              <span className="max-[380px]:hidden">· Lv {user.level}</span>
            </span>
            <span className="hidden text-ink-soft md:inline">{user.username}</span>
            {/* Signing out is rare; on a phone it lives in Settings so the
                bar keeps room for what you actually came for. */}
            <button
              onClick={logout}
              className="hidden text-ink-faint transition-colors hover:text-ink sm:inline"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* mobile bottom tab bar — the app-like navigation */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden ${
          links.length === 5 ? "grid-cols-5" : "grid-cols-4"
        }`}
      >
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                active ? "text-accent-ink" : "text-ink-faint"
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
