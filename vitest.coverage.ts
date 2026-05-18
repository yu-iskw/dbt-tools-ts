import { defineConfig, mergeConfig } from 'vitest/config';
import vitestConfig from './vitest.config.js';

/**
 * Used only by `scripts/coverage-score.mjs` (`pnpm coverage:report`).
 * Single worker reduces intermittent SIGSEGV risk from @vitest/coverage-v8 under high parallelism.
 */
export default mergeConfig(
  vitestConfig,
  defineConfig({
    test: {
      maxWorkers: 1,
    },
  }),
);
