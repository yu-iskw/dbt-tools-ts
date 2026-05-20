export const coveragePolicy = {
  glob: 'packages/cli/src/{actions,internal}/**',
  thresholds: {
    lines: 63,
    branches: 44,
    functions: 61,
    statements: 62,
  },
};
