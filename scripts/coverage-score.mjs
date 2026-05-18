#!/usr/bin/env node
/**
 * Coverage harness for AI agent feedback.
 * Runs Vitest with coverage, produces coverage-report.json with score and threshold status.
 * Threshold enforcement is Vitest's job (vitest.config.ts); this script mirrors global policy for agents.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  GLOBAL_THRESHOLDS,
  PACKAGE_LABELS,
  isBelowGlobalThresholds,
} from '../coverage-thresholds.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

/** Larger heap for Vitest + v8 coverage; default Node heap can OOM during compilation. */
const VITEST_NODE_OPTIONS_HEAP = '--max-old-space-size=8192';

function vitestChildEnv() {
  const existing = process.env.NODE_OPTIONS?.trim() ?? '';
  return {
    ...process.env,
    NODE_OPTIONS: existing ? `${existing} ${VITEST_NODE_OPTIONS_HEAP}` : VITEST_NODE_OPTIONS_HEAP,
  };
}

function buildViolations(metrics) {
  const violations = [];
  for (const metric of ['lines', 'branches', 'functions', 'statements']) {
    if (metrics[metric].pct < GLOBAL_THRESHOLDS[metric]) {
      violations.push({
        metric,
        pct: metrics[metric].pct,
        threshold: GLOBAL_THRESHOLDS[metric],
      });
    }
  }
  return violations;
}

function run() {
  const r = spawnSync(
    'pnpm',
    ['exec', 'vitest', 'run', '--coverage', '--config', join(projectRoot, 'vitest.coverage.ts')],
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
    lines: { pct: linesPct, threshold: GLOBAL_THRESHOLDS.lines },
    branches: { pct: branchesPct, threshold: GLOBAL_THRESHOLDS.branches },
    functions: { pct: functionsPct, threshold: GLOBAL_THRESHOLDS.functions },
    statements: { pct: statementsPct, threshold: GLOBAL_THRESHOLDS.statements },
  };

  const belowThreshold = isBelowGlobalThresholds(metrics);
  const violations = buildViolations(metrics);

  const avg = (linesPct + branchesPct + functionsPct + statementsPct) / 4;
  const score = Math.min(100, Math.floor(avg));

  const packagePrefixes = Object.keys(PACKAGE_LABELS);
  const byPackage = {};
  for (const [filePath, data] of Object.entries(summary)) {
    if (filePath === 'total' || !data || typeof data !== 'object') continue;
    const normalizedPath = filePath.replace(/^\.\//, '').replace(/\\/g, '/');
    let pkg = null;
    for (const prefix of packagePrefixes) {
      if (normalizedPath.includes(prefix)) {
        pkg = PACKAGE_LABELS[prefix];
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
      const { total: metricTotal, covered } = agg[metric];
      const pct = metricTotal > 0 ? (covered / metricTotal) * 100 : 0;
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
