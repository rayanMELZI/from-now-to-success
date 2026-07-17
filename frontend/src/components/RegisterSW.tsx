"use client";

import { useEffect } from "react";

/** Registers the service worker on every page load (needed for PWA install + push). */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* not fatal: the app works without offline/push support */
      });
    }
  }, []);

  return null;
}
