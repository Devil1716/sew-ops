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
  ...(standalone ? { output: "standalone" as const, outputFileTracingRoot: path.join(process.cwd(), "../..") } : {}),
  transpilePackages: ["@sew-ops/shared"],
  // Strip the dev-only fixtures module from production bundles.
  env: {
    NEXT_PUBLIC_USE_FIXTURES: process.env.NEXT_PUBLIC_USE_FIXTURES ?? "false",
  },
};

export default withSerwist(withNextIntl(nextConfig));
