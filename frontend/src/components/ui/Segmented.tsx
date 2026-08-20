"use client";

import type { ReactNode } from "react";

/**
 * A row of mutually exclusive choices in one sunken track — the control
 * that replaces a <select> whenever there are two to four options and the
 * choice matters enough to stay visible.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex rounded-lg bg-surface-sunken ${size === "sm" ? "p-0.5" : "p-1"}`}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-md font-medium transition-all ${
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-2 py-1.5 text-sm"
            } ${
              active
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
