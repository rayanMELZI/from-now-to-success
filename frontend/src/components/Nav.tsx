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
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          fromNow<span className="text-amber-600">To</span>Success
        </Link>

        <nav className="flex gap-1 text-sm">
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

        <div className="ml-auto flex items-center gap-4 text-sm">
          <span
            className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800"
            title={`${user.totalPoints} total points`}
          >
            ⭐ {user.totalPoints} · Lv {user.level}
          </span>
          <span className="hidden text-stone-500 sm:inline">{user.username}</span>
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
