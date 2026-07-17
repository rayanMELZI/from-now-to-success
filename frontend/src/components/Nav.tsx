"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const links = [
  { href: "/", label: "Roadmap", icon: "🗺️" },
  { href: "/checkin", label: "Check-in", icon: "✅" },
  { href: "/stats", label: "Stats", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Nav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-stone-300 bg-white/90 backdrop-blur">
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
                    ? "bg-stone-800 text-white"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span
              className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800"
              title={`${user.totalPoints} total points`}
            >
              ⭐ {user.totalPoints} · Lv {user.level}
            </span>
            <span className="hidden text-stone-500 md:inline">{user.username}</span>
            <button
              onClick={logout}
              className="text-stone-400 transition-colors hover:text-stone-700"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* mobile bottom tab bar — the app-like navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                active ? "text-amber-700" : "text-stone-400"
              }`}
            >
              <span className={`text-xl leading-none ${active ? "" : "grayscale opacity-70"}`}>
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
