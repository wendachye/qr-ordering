import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Replaces the deprecated `prisma` block in package.json. When this file is
// present, Prisma no longer auto-loads .env, so we load it here to populate
// DATABASE_URL for CLI commands (migrate / generate / studio / seed).
// `quiet` suppresses dotenv v17's startup banner.
dotenv.config({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Prisma 7: connection URL for the CLI/Migrate lives here (removed from the
  // schema datasource). The app runtime connects via the PrismaPg adapter.
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
