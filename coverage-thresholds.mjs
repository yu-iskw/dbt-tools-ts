// Global coverage minimums (repo policy). Workspace mins live in each packages/<name>/coverage.policy.ts

export const GLOBAL_THRESHOLDS = {
  lines: 60,
  branches: 50,
  functions: 60,
  statements: 60,
};

/** Path prefixes for coverage-report.json byPackage rollup. */
export const PACKAGE_LABELS = {
  'packages/core/': '@dbt-tools/core',
  'packages/cli/': '@dbt-tools/cli',
  'packages/web/': '@dbt-tools/web',
  'packages/mcp/': '@dbt-tools/mcp',
};

/**
 * @param {{ lines: { pct: number }, branches: { pct: number }, functions: { pct: number }, statements: { pct: number } }} metrics
 */
export function isBelowGlobalThresholds(metrics) {
  return (
    metrics.lines.pct < GLOBAL_THRESHOLDS.lines ||
    metrics.branches.pct < GLOBAL_THRESHOLDS.branches ||
    metrics.functions.pct < GLOBAL_THRESHOLDS.functions ||
    metrics.statements.pct < GLOBAL_THRESHOLDS.statements
  );
}
