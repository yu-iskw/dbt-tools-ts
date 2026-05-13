import path from 'path';
import { defineConfig } from 'vite';

const serverEntry = path.resolve(__dirname, 'src/server/cli.ts');

// Node SSR bundle for `npx @dbt-tools/web`. `build.ssr` keeps Node semantics
// (e.g. real `process.env` for `--target`) even if `vite build` is run without `--ssr`.
// npm deps and node: built-ins stay external; only local `@web` sources are bundled.
export default defineConfig({
  build: {
    ssr: serverEntry,
    outDir: 'dist-serve',
    emptyOutDir: true,
    rollupOptions: {
      input: serverEntry,
      external: [
        // Node.js built-ins
        /^node:/,
        // All npm packages (runtime deps already listed in package.json)
        /^@dbt-tools\//,
        /^dbt-artifacts-parser/,
        /^@aws-sdk\//,
        /^@google-cloud\//,
      ],
      output: {
        format: 'es',
        entryFileNames: 'server/[name].js',
        chunkFileNames: 'server/[name]-[hash].js',
        banner: (chunk) => (chunk.name === 'cli' ? '#!/usr/bin/env node' : ''),
      },
    },
  },
  resolve: {
    alias: {
      '@web': path.resolve(__dirname, 'src'),
    },
  },
});
