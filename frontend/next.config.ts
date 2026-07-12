import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal server bundle for the Docker image.
  // /api/* is forwarded to the backend by src/app/api/[...path]/route.ts,
  // so the browser only ever talks to this app's origin (no CORS anywhere).
  output: "standalone",
};

export default nextConfig;
