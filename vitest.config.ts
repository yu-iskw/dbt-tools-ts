import { defineConfig } from 'vitest/config';
import { GLOBAL_THRESHOLDS } from './coverage-thresholds.mjs';
import { coveragePolicy as corePolicy } from './packages/core/coverage.policy.js';
import { coveragePolicy as cliPolicy } from './packages/cli/coverage.policy.js';
import { coveragePolicy as webPolicy } from './packages/web/coverage.policy.js';
import { coveragePolicy as mcpPolicy } from './packages/mcp/coverage.policy.js';

const workspacePolicies = [corePolicy, cliPolicy, webPolicy, mcpPolicy];

function buildCoverageThresholds() {
  const workspaceGlobs = Object.fromEntries(workspacePolicies.map((p) => [p.glob, p.thresholds]));
  return { ...GLOBAL_THRESHOLDS, ...workspaceGlobs };
}

export default defineConfig({
  test: {
    projects: [
      'packages/core/vitest.config.ts',
      'packages/cli/vitest.config.ts',
      'packages/web/vitest.config.ts',
      'packages/mcp/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportsDirectory: 'coverage',
      include: workspacePolicies.map((p) => p.glob),
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.generated.ts',
        '**/test-utils.ts',
        '**/*.md',
      ],
      thresholds: buildCoverageThresholds(),
    },
  },
});
