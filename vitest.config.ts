import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// Load .env.local at config-evaluation time so DATABASE_URL is set before
// Prisma client is instantiated by tests.
loadEnv({ path: '.env.local' });

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tests/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'features/**/*.test.ts',
      'lib/**/*.test.ts',
    ],
    setupFiles: ['tests/setup.ts'],
    // Integration tests share one DB; run them serially to avoid cross-test
    // truncate races. Unit tests later can parallelize via vitest projects.
    fileParallelism: false,
    // Integration tests round-trip to Neon (us-east-1). Multi-step workflows
    // (state-machine + StockLevel upsert + completion) chain several
    // transactions; the default 5s timeout is too tight at network latency.
    testTimeout: 15_000,
  },
});
