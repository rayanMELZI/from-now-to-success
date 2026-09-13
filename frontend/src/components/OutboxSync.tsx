"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/offline";
import { flushOutbox, usePendingCount } from "@/lib/outbox";

/**
 * Drains the offline check-in queue whenever there is something to send and a
 * connection to send it on. It lives in the layout rather than on the check-in
 * page so a queue made there still syncs if the user lands anywhere else.
 *
 * Each run either empties a day or drops it, so finishing always lowers the
 * pending count and the effect settles instead of retrying in a loop. A run
 * that fails for lack of network leaves the queue untouched and marks the app
 * offline, which is the signal to try again once the connection returns.
 */
export function OutboxSync() {
  const online = useOnline();
  const waiting = usePendingCount();
  const { user } = useAuth();

  useEffect(() => {
    // No session means no one to attribute the answers to; they keep.
    if (!online || waiting === 0 || !user) return;
    flushOutbox();
  }, [online, waiting, user]);

  return null;
}
