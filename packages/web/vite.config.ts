import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { dbtTargetPlugin } from './src/dbt-target-plugin';
export default defineConfig({
  plugins: [dbtTargetPlugin(), react()],
  server: {
    port: 5173,
  },
  resolve: {
    // Resolve @dbt-tools/core from its TypeScript source in dev so that Vite
    // always sees the latest code without needing a `pnpm build` or a cache
    // clear. The compiled dist/ is still used for the production build (the
    // alias only applies when "vite dev" processes imports).
    alias: {
      '@web': path.resolve(__dirname, 'src'),
      '@dbt-tools/core/artifact-io': path.resolve(__dirname, '../core/src/artifact-io.ts'),
      '@dbt-tools/core/browser': path.resolve(__dirname, '../core/src/browser.ts'),
      '@dbt-tools/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
  optimizeDeps: {
    // dbt-artifacts-parser sub-entry-points use CJS internally, so they still
    // need Vite's dep-optimisation step. @dbt-tools/core is now aliased to its
    // TypeScript source and processed natively — no pre-bundling needed.
    include: [
      'dbt-artifacts-parser/manifest',
      'dbt-artifacts-parser/run_results',
      'dbt-artifacts-parser/catalog',
      'dbt-artifacts-parser/sources',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@tanstack/react-virtual')) {
            return 'tanstack-virtual-vendor';
          }
        },
      },
    },
  },
});
