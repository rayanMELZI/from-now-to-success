import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal server bundle for the Docker image.
  output: "standalone",

  // The browser only ever talks to this app's origin; Next.js forwards
  // /api/* to the backend. This removes the need for CORS entirely and
  // lets the refresh cookie behave as a first-party cookie.
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? "http://localhost:8080";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
