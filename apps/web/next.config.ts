import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // SW is for the operator PWA (offline queue); keep dev builds clean.
  disable: process.env.NODE_ENV === "development",
});

// Only the Docker build sets NEXT_OUTPUT=standalone (a small self-contained server). Dev and fast mode are unchanged.
const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Socket.IO's handshake is `/socket.io/?...`. Next's trailing-slash redirect
  // answers that with 308 before the rewrite, and browsers drop the upgrade.
  skipTrailingSlashRedirect: true,
  ...(standalone ? { output: "standalone" as const, outputFileTracingRoot: path.join(process.cwd(), "../..") } : {}),
  transpilePackages: ["@sew-ops/shared"],
  // Strip the dev-only fixtures module from production bundles.
  env: {
    NEXT_PUBLIC_USE_FIXTURES: process.env.NEXT_PUBLIC_USE_FIXTURES ?? "false",
  },
  async rewrites() {
    const rawBackendUrl =
      process.env.INTERNAL_API_URL ||
      process.env.API_URL ||
      (process.env.NEXT_PUBLIC_API_BASE_URL && !process.env.NEXT_PUBLIC_API_BASE_URL.startsWith("/")
        ? process.env.NEXT_PUBLIC_API_BASE_URL
        : "");

    if (!rawBackendUrl) {
      if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
        throw new Error(
          "[SewOps Web] INTERNAL_API_URL is required for Vercel production builds. Set it to the deployed SewOps API origin (for example, https://sew-ops-api.vercel.app) so /v1, /health, and /socket.io are routed correctly."
        );
      }
      return [];
    }

    // Strip trailing /v1 or / to obtain the backend base origin
    const backendOrigin = rawBackendUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "");

    return {
      beforeFiles: [
        // Exact paths first so `/socket.io/` is not rewritten to `/socket.io` (no slash),
        // which the API then sees as a normal GET and Socket.IO never accepts the upgrade.
        { source: "/socket.io", destination: `${backendOrigin}/socket.io/` },
        { source: "/socket.io/", destination: `${backendOrigin}/socket.io/` },
        { source: "/socket.io/:path*", destination: `${backendOrigin}/socket.io/:path*` },
      ],
      afterFiles: [
        {
          source: "/v1/:path*",
          destination: `${backendOrigin}/v1/:path*`,
        },
        {
          source: "/health",
          destination: `${backendOrigin}/health`,
        },
      ],
    };
  },
};

export default withSerwist(withNextIntl(nextConfig));
