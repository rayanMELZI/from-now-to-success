import { api } from "./api";

/** The VAPID public key arrives base64url-encoded; the Push API wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

async function saveToBackend(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await api("/api/push/subscribe", {
    method: "POST",
    body: {
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
  });
}

/**
 * The browser and the backend can disagree: the browser may hold a
 * subscription the backend never stored (a failed save), which looks
 * "enabled" but never receives anything. This re-saves it on every load,
 * making the state self-healing. Returns whether push is active.
 */
export async function syncSubscription(): Promise<boolean> {
  if (!pushSupported()) return false;
  const registration = await readyRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  try {
    await saveToBackend(subscription); // idempotent upsert
  } catch {
    /* offline or logged out: the browser sub still exists; try next load */
  }
  return true;
}

export async function subscribeToPush(): Promise<void> {
  const registration = await readyRegistration();
  const { publicKey } = await api<{ publicKey: string }>("/api/push/public-key");
  if (!publicKey) throw new Error("Push is not configured on the server");

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    } catch (err) {
      // Some browsers throw even though a subscription was created
      // (or one already existed with the same key) — check again.
      subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw err;
    }
  }
  await saveToBackend(subscription);
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await readyRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const json = subscription.toJSON();
  try {
    await api("/api/push/subscribe", {
      method: "DELETE",
      body: {
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
    });
  } finally {
    await subscription.unsubscribe();
  }
}

/** Fires a real notification to this device via the server. */
export async function sendTestNotification(): Promise<void> {
  await api("/api/push/test", { method: "POST" });
}
