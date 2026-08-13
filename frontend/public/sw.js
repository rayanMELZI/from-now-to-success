/* Service worker: web-push notifications + the offline cache. */

/**
 * Two caches with different lifetimes:
 *  - the shell (documents, JS/CSS chunks, icons) is what makes the app *open*
 *    with no network at all;
 *  - the data cache holds GET /api responses so those pages have something to
 *    render once they do.
 * Bumping VERSION drops both on the next activate.
 */
const VERSION = "v1";
const SHELL_CACHE = `fnts-shell-${VERSION}`;
const DATA_CACHE = `fnts-data-${VERSION}`;

/** Warmed at install so every tab opens offline, even one never visited. */
const ROUTES = ["/", "/checkin", "/plan", "/stats", "/settings", "/login"];

/**
 * Stamped onto any response that came from the cache because the network was
 * unreachable. Without it the page sees a perfectly ordinary 200 and has no
 * way to tell it is looking at yesterday's data.
 */
const STALE_HEADER = "x-fnts-offline";

/* ------------------------------------------------------------------ cache */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(ROUTES))
      // Installing while already offline is fine — the cache fills in later.
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== SHELL_CACHE && name !== DATA_CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Re-wraps a cached response so the app can label it as stale. */
function markStale(response) {
  const headers = new Headers(response.headers);
  headers.set(STALE_HEADER, "1");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Always prefer the server; keep a copy of what it said. Online this behaves
 * exactly like no service worker at all, which is the point — offline support
 * must not make the live app staler.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    // `basic` excludes redirects and opaque cross-origin replies.
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreVary: true });
    return cached ? markStale(cached) : null;
  }
}

/** Build assets are content-hashed, so a hit is always correct. */
async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return null;
  }
}

/** Last resort: a navigation offline to a page that was never cached. */
function offlineDocument() {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline — fromNowToSuccess</title>
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;
align-items:center;justify-content:center;gap:.5rem;background:#f5f5f4;color:#44403c;
font-family:system-ui,sans-serif;text-align:center;padding:2rem}
h1{font-size:1.1rem;margin:0}p{margin:0;color:#78716c;font-size:.9rem}
@media(prefers-color-scheme:dark){body{background:#0c0a09;color:#e7e5e4}p{color:#a8a29e}}</style>
</head><body><h1>You're offline</h1>
<p>This page hasn't been saved for offline use yet.</p></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Writes need the real server — queueing them is a separate feature.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Auth exchanges are short-lived secrets; replaying them offline is useless
  // and keeping a token on disk would undo the in-memory-only token design.
  if (url.pathname.startsWith("/api/auth/")) return;

  // Next prefetches every visible <Link> as an RSC payload whose ?_rsc= hash
  // changes with router state, so caching them grows without bound for no gain:
  // when one fails, Next falls back to a full navigation, which we do cache.
  if (url.searchParams.has("_rsc") || request.headers.get("rsc") === "1") return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request).then((res) => res ?? Response.error()));
    return;
  }

  const cacheName = url.pathname.startsWith("/api/") ? DATA_CACHE : SHELL_CACHE;
  event.respondWith(
    networkFirst(request, cacheName).then((res) => {
      if (res) return res;
      // A document must render *something*; anything else should look like the
      // network failure it is, so the app's own error handling kicks in.
      return request.mode === "navigate" ? offlineDocument() : Response.error();
    }),
  );
});

/* ------------------------------------------------------------------- push */

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "fromNowToSuccess", {
      body: data.body || "Time for your daily check-in.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/checkin" },
    }),
  );
});

/* Browsers occasionally rotate the push subscription; resubscribe silently. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription?.options ?? { userVisibleOnly: true })
      .then((subscription) =>
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            p256dh: subscription.toJSON().keys?.p256dh,
            auth: subscription.toJSON().keys?.auth,
          }),
        }),
      )
      .catch(() => {}),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/checkin";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
