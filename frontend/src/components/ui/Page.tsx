import type { ReactNode } from "react";

/**
 * Page width, in one place.
 *
 * Every page used to pick its own `max-w-*`, and most picked `max-w-2xl` —
 * which on a laptop left two thirds of the window empty either side of a
 * single column of cards. These three widths are the whole vocabulary now,
 * and the nav bar lines up with `wide` so nothing looks off-centre.
 */
const WIDTHS = {
  /** Forms and settings: a single readable column. */
  form: "max-w-2xl",
  /** Lists that turn into a grid on a big screen. */
  wide: "max-w-6xl",
  /** The roadmap canvas — as much room as there is. */
  full: "max-w-7xl",
} as const;

export type PageWidth = keyof typeof WIDTHS;

export function PageShell({
  width = "wide",
  className = "",
  children,
}: {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`mx-auto w-full flex-1 px-4 py-4 sm:px-6 ${WIDTHS[width]} ${className}`}
    >
      {children}
    </div>
  );
}

/** Title, one line of context, and whatever action belongs beside them. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
