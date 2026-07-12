import { type NextRequest } from "next/server";

/**
 * Forwards every /api/* request to the backend at request time.
 * A next.config rewrite would be resolved at BUILD time and baked into the
 * image; reading the env here keeps the image configurable at runtime
 * (12-factor: build once, run anywhere).
 */
const FORWARDED_REQUEST_HEADERS = ["content-type", "authorization", "cookie"];

async function proxy(request: NextRequest) {
  const backend = process.env.BACKEND_URL ?? "http://localhost:8080";
  const url = new URL(request.url);

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const response = await fetch(backend + url.pathname + url.search, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.arrayBuffer(),
    redirect: "manual",
  });

  // Strip hop-by-hop headers; Next re-computes length/encoding itself.
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
};
