"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const links = [
  { href: "/", label: "Roadmap" },
  { href: "/checkin", label: "Check-in" },
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  return (
    <header className="border-b border-stone-300 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
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

        <nav className="order-last flex w-full gap-1 text-sm sm:order-0 sm:w-auto">
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
  );
}
