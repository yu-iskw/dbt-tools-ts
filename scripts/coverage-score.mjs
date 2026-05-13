#!/usr/bin/env node
/**
 * Coverage harness for AI agent feedback.
 * Runs Vitest with coverage, produces coverage-report.json with score and threshold status.
 * Score: floor of average of lines, branches, functions, statements percentages.
 * Exits 1 if any metric is below its threshold.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const THRESHOLDS = {
  lines: 60,
  branches: 50,
  functions: 60,
  statements: 60,
};

/** Larger heap for Vitest + v8 coverage; default Node heap can OOM during compilation. */
const VITEST_NODE_OPTIONS_HEAP = '--max-old-space-size=8192';

function vitestChildEnv() {
  const existing = process.env.NODE_OPTIONS?.trim() ?? '';
  return {
    ...process.env,
    NODE_OPTIONS: existing ? `${existing} ${VITEST_NODE_OPTIONS_HEAP}` : VITEST_NODE_OPTIONS_HEAP,
  };
}

function run() {
  // 1. Run vitest with coverage (vitest.coverage.mjs serializes workers; see AGENTS.md)
  const r = spawnSync(
    'pnpm',
    ['exec', 'vitest', 'run', '--coverage', '--config', join(projectRoot, 'vitest.coverage.mjs')],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'inherit',
      env: vitestChildEnv(),
    },
  );

  if (r.status !== 0) {
    console.error('Vitest coverage run failed.');
    process.exit(r.status ?? 1);
  }

  // 2. Read coverage summary (Istanbul json-summary format)
  const summaryPath = join(projectRoot, 'coverage', 'coverage-summary.json');
  if (!existsSync(summaryPath)) {
    console.error(
      'coverage/coverage-summary.json not found. Ensure json-summary reporter is enabled.',
    );
    process.exit(1);
  }

  const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
  const total = summary.total;
  if (!total) {
    console.error('No total in coverage-summary.json');
    process.exit(1);
  }

  const linesPct = total.lines?.pct ?? 0;
  const branchesPct = total.branches?.pct ?? 0;
  const functionsPct = total.functions?.pct ?? 0;
  const statementsPct = total.statements?.pct ?? 0;

  const metrics = {
    lines: { pct: linesPct, threshold: THRESHOLDS.lines },
    branches: { pct: branchesPct, threshold: THRESHOLDS.branches },
    functions: { pct: functionsPct, threshold: THRESHOLDS.functions },
    statements: { pct: statementsPct, threshold: THRESHOLDS.statements },
  };

  const belowThreshold =
    linesPct < THRESHOLDS.lines ||
    branchesPct < THRESHOLDS.branches ||
    functionsPct < THRESHOLDS.functions ||
    statementsPct < THRESHOLDS.statements;

  const avg = (linesPct + branchesPct + functionsPct + statementsPct) / 4;
  const score = Math.min(100, Math.floor(avg));

  const violations = [];
  if (linesPct < THRESHOLDS.lines) {
    violations.push({
      metric: 'lines',
      pct: linesPct,
      threshold: THRESHOLDS.lines,
    });
  }
  if (branchesPct < THRESHOLDS.branches) {
    violations.push({
      metric: 'branches',
      pct: branchesPct,
      threshold: THRESHOLDS.branches,
    });
  }
  if (functionsPct < THRESHOLDS.functions) {
    violations.push({
      metric: 'functions',
      pct: functionsPct,
      threshold: THRESHOLDS.functions,
    });
  }
  if (statementsPct < THRESHOLDS.statements) {
    violations.push({
      metric: 'statements',
      pct: statementsPct,
      threshold: THRESHOLDS.statements,
    });
  }

  // Per-package breakdown: group file entries by package prefix
  const packagePrefixes = ['packages/core/', 'packages/cli/', 'packages/web/'];
  const packageNames = {
    'packages/core/': 'dbt-tools/core',
    'packages/cli/': 'dbt-tools/cli',
    'packages/web/': 'dbt-tools/web',
  };
  const byPackage = {};
  for (const [filePath, data] of Object.entries(summary)) {
    if (filePath === 'total' || !data || typeof data !== 'object') continue;
    const normalizedPath = filePath.replace(/^\.\//, '').replace(/\\/g, '/');
    let pkg = null;
    for (const prefix of packagePrefixes) {
      if (normalizedPath.includes(prefix)) {
        pkg = packageNames[prefix];
        break;
      }
    }
    if (!pkg) continue;
    if (!byPackage[pkg]) {
      byPackage[pkg] = {
        lines: { total: 0, covered: 0 },
        branches: { total: 0, covered: 0 },
        functions: { total: 0, covered: 0 },
        statements: { total: 0, covered: 0 },
      };
    }
    const b = byPackage[pkg];
    for (const metric of ['lines', 'branches', 'functions', 'statements']) {
      const m = data[metric];
      if (m && typeof m.total === 'number' && typeof m.covered === 'number') {
        b[metric].total += m.total;
        b[metric].covered += m.covered;
      }
    }
  }
  const byPackageFormatted = {};
  for (const [pkg, agg] of Object.entries(byPackage)) {
    byPackageFormatted[pkg] = {};
    for (const metric of ['lines', 'branches', 'functions', 'statements']) {
      const { total, covered } = agg[metric];
      const pct = total > 0 ? (covered / total) * 100 : 0;
      byPackageFormatted[pkg][metric] = pct;
    }
  }

  const report = {
    score,
    belowThreshold,
    lines: metrics.lines,
    branches: metrics.branches,
    functions: metrics.functions,
    statements: metrics.statements,
    violations,
    byPackage: byPackageFormatted,
  };

  const reportPath = join(projectRoot, 'coverage-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(
    `Coverage report written to coverage-report.json: score=${score}, belowThreshold=${belowThreshold}, violations=${violations.length}`,
  );
  if (belowThreshold && Object.keys(byPackageFormatted).length > 0) {
    console.log('Per-package coverage:');
    for (const [pkg, pct] of Object.entries(byPackageFormatted)) {
      console.log(
        `  ${pkg}: lines=${pct.lines?.toFixed(1)}% branches=${pct.branches?.toFixed(1)}% functions=${pct.functions?.toFixed(1)}% statements=${pct.statements?.toFixed(1)}%`,
      );
    }
  }

  process.exit(belowThreshold ? 1 : 0);
}

run();
