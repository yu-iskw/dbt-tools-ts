import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.dirname(fileURLToPath(import.meta.url));

/** Shared Vitest options merged into each workspace project. */
export default {
  resolve: {
    alias: {
      '@web': path.resolve(repoRoot, 'packages/web/src'),
      '@dbt-tools/core/artifact-io': path.resolve(repoRoot, 'packages/core/src/artifact-io.ts'),
      '@dbt-tools/core/artifact-workspace': path.resolve(
        repoRoot,
        'packages/core/src/artifact-workspace.ts',
      ),
      '@dbt-tools/core/contracts': path.resolve(repoRoot, 'packages/core/src/contracts/index.ts'),
      '@dbt-tools/core/progress/artifact-load-progress': path.resolve(
        repoRoot,
        'packages/core/src/progress/artifact-load-progress.ts',
      ),
      '@dbt-tools/core/util/sql-truncation': path.resolve(
        repoRoot,
        'packages/core/src/util/sql-truncation.ts',
      ),
      '@dbt-tools/core/browser': path.resolve(repoRoot, 'packages/core/src/browser.ts'),
      '@dbt-tools/core': path.resolve(repoRoot, 'packages/core/src/index.ts'),
      'dbt-artifacts-parser/test-utils': path.resolve(
        repoRoot,
        'packages/test-fixtures/dbt-artifacts-parser/test-utils.ts',
      ),
    },
  },
  test: {
    exclude: ['.trunk/**', '**/node_modules/**'],
    pool: 'threads' as const,
  },
};
