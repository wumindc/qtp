import { defineConfig, env } from 'prisma/config';

/**
 * @author codex
 * Keeps Prisma 7 connection configuration outside schema.prisma.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
