"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Check, MessageSquarePlus } from "lucide-react";
import { api } from "@/lib/api";
import { Modal } from "./Modal";

const MAX_LEN = 2000;

export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function close() {
    setOpen(false);
    // Reset after the close animation has time to finish.
    setTimeout(() => {
      setMessage("");
      setError(null);
      setSent(false);
    }, 200);
  }

  async function submit() {
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/feedback", {
        method: "POST",
        body: { message: message.trim(), page: pathname },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that — try again?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Send feedback or request a feature"
        className="rounded-full p-2 text-stone-500 dark:text-stone-400 transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
      >
        <MessageSquarePlus size={17} />
      </button>

      <Modal open={open} onClose={close}>
        {sent ? (
          <div className="flex flex-col items-center py-2 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-400">
              <Check size={22} />
            </span>
            <h2 className="text-base font-semibold">Thanks!</h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Your feedback was sent. Good ideas make it into the app.
            </p>
            <button
              onClick={close}
              className="mt-4 rounded-lg bg-stone-800 dark:bg-stone-600 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 dark:hover:bg-stone-500"
            >
              Close
            </button>
          </div>
        ) : (
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <MessageSquarePlus size={18} className="text-amber-600" />
              Feedback & feature ideas
            </h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Bug, rough edge, or a feature you wish existed — it goes straight to the
              developer.
            </p>

            {error && (
              <p className="mt-3 rounded-md bg-red-50 dark:bg-red-950/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
              rows={5}
              autoFocus
              placeholder="I'd love it if…"
              className="mt-3 w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
            <div className="mt-1 text-right text-xs text-stone-400">
              {message.length}/{MAX_LEN}
            </div>

            <div className="mt-2 flex gap-2">
              <button
                onClick={submit}
                disabled={busy || !message.trim()}
                className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-500 active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send feedback"}
              </button>
              <button
                onClick={close}
                className="rounded-lg border border-stone-300 dark:border-stone-700 px-4 py-2.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
