"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

/* System preference as an external store: SSR sees "light", the client
 * subscribes to live changes without any setState-in-effect. */
function subscribeSystem(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const systemIsDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === "undefined"
      ? "system"
      : ((localStorage.getItem("theme") as Theme | null) ?? "system"),
  );
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    systemIsDark,
    () => false,
  );

  const resolved: "light" | "dark" =
    theme === "dark" || (theme === "system" && systemDark) ? "dark" : "light";

  // Keep the <html> class in sync (DOM = external system; allowed in effects).
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem("theme", t);
    setThemeState(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
