import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin the workspace root to this app. Without it, Turbopack can infer a stray
// ancestor lockfile (e.g. ~/Documents/package-lock.json) as the root, which
// breaks React Server Components client-manifest module resolution.
const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: { root },
};

export default nextConfig;
