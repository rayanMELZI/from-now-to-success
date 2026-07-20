"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { OnboardingGuide } from "@/components/OnboardingGuide";

interface OnboardingState {
  /** Opens the guide from step 1 — used by the "Replay app guide" button. */
  show: () => void;
}

const OnboardingContext = createContext<OnboardingState | null>(null);

function seenKey(userId: number) {
  return `fnts_guide_seen_${userId}`;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  // Remembers which user id we've already auto-checked, so re-renders (e.g.
  // a background refreshUser() call) never re-open the tour on their own.
  const [checkedUserId, setCheckedUserId] = useState<number | null>(null);

  // Derived-state-from-props during render (React's documented pattern for
  // "run once when a prop changes") — not an effect, so there's no
  // setState-in-effect and no extra render/flash before the modal opens.
  if (user && user.id !== checkedUserId) {
    setCheckedUserId(user.id);
    if (!localStorage.getItem(seenKey(user.id))) {
      setOpen(true);
    }
  }

  const show = useCallback(() => setOpen(true), []);

  const close = useCallback(() => {
    setOpen(false);
    if (user) localStorage.setItem(seenKey(user.id), "1");
  }, [user]);

  return (
    <OnboardingContext.Provider value={{ show }}>
      {children}
      <OnboardingGuide open={open} onClose={close} />
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}
