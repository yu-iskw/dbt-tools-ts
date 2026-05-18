import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineProject, mergeConfig } from 'vitest/config';
import shared from '../../vitest.shared.js';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  shared,
  defineProject({
    root: packageRoot,
    test: {
      name: '@dbt-tools/mcp',
      include: ['src/**/*.test.ts'],
    },
  }),
);
