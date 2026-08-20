"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Clock, MessageSquarePlus } from "lucide-react";
import { api } from "@/lib/api";
import { Modal } from "./Modal";

const MAX_LEN = 2000;

interface SubmitResult {
  id: number;
  delivered: boolean;
  notificationsConfigured: boolean;
}

export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SubmitResult | null>(null);

  function close() {
    setOpen(false);
    // Reset after the close animation has time to finish.
    setTimeout(() => {
      setMessage("");
      setError(null);
      setSent(null);
    }, 200);
  }

  async function submit() {
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setSent(
        await api<SubmitResult>("/api/feedback", {
          method: "POST",
          body: { message: message.trim(), page: pathname },
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that — try again?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* An icon on its own said nothing to anyone who had not already been
          told what it was. The word does the explaining; same colours. */}
      <button
        onClick={() => setOpen(true)}
        title="Send feedback or request a feature"
        aria-label="Send feedback"
        className="flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink sm:px-3"
      >
        <MessageSquarePlus size={15} />
        Feedback
      </button>

      <Modal open={open} onClose={close}>
        {sent ? (
          <div className="flex flex-col items-center py-2 text-center">
            <span
              className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                sent.delivered
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400"
              }`}
            >
              {sent.delivered ? <Check size={22} /> : <Clock size={22} />}
            </span>
            <h2 className="text-base font-semibold">
              {sent.delivered ? "Thanks!" : "Saved!"}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {sent.delivered
                ? "Your feedback reached the developer. Good ideas make it into the app."
                : "Your feedback is safely stored. It couldn't be forwarded to the developer just yet — it'll be retried automatically."}
            </p>
            <button
              onClick={close}
              className="btn btn-primary mt-4"
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
            <p className="mt-1 text-sm text-ink-soft">
              Bug, rough edge, or a feature you wish existed — it goes straight to the
              developer.
            </p>

            {error && (
              <p className="mt-3 rounded-md bg-red-50 dark:bg-red-950/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}

            {/* text-base (16px): anything smaller makes iOS zoom in on focus */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
              rows={5}
              placeholder="I'd love it if…"
              className="field mt-3 resize-none text-base"
            />
            <div className="mt-1 text-right text-xs text-stone-400">
              {message.length}/{MAX_LEN}
            </div>

            <div className="mt-2 flex gap-2">
              <button
                onClick={submit}
                disabled={busy || !message.trim()}
                className="flex-1 rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-500 active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send feedback"}
              </button>
              <button
                onClick={close}
                className="btn btn-ghost"
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
