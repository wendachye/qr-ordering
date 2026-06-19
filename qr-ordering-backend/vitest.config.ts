import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';

// Load .env.test for local runs, but NEVER override values already present in
// the environment — CI sets DATABASE_URL (and friends) via the job, and those
// must win. The config runs in the main process before workers spawn, so the
// values propagate to every test worker.
const parsed = loadEnv({ path: '.env.test', quiet: true }).parsed ?? {};
for (const [key, value] of Object.entries(parsed)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Reset shared seeded fixtures once before the suite.
    globalSetup: ['./tests/globalSetup.ts'],
    // Integration tests share one database; run files serially to avoid races.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 20_000,
  },
});
