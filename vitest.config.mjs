import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '@web': path.resolve(__dirname, 'packages/web/src'),
      '@dbt-tools/core/artifact-io': path.resolve(__dirname, 'packages/core/src/artifact-io.ts'),
      '@dbt-tools/core/artifact-workspace': path.resolve(
        __dirname,
        'packages/core/src/artifact-workspace.ts',
      ),
      '@dbt-tools/core/browser': path.resolve(__dirname, 'packages/core/src/browser.ts'),
      '@dbt-tools/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      'dbt-artifacts-parser/test-utils': path.resolve(
        __dirname,
        'packages/test-fixtures/dbt-artifacts-parser/test-utils.ts',
      ),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'packages/**/*.test.tsx'],
    exclude: ['.trunk/**', '**/node_modules/**'],
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      include: ['packages/**/src/**/*.ts', 'packages/**/src/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.generated.ts', '**/test-utils.ts'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 60,
        branches: 50,
        functions: 60,
        statements: 60,
      },
    },
  },
});
