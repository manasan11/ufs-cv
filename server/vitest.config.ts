import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Set before any module loads so config/env.ts picks up the test database.
    // dotenv does not override values that are already present.
    env: {
      NODE_ENV: 'test',
      DB_NAME: process.env.DB_TEST_NAME ?? 'cv_generator_test',
    },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
  },
});
