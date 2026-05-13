#!/usr/bin/env node
/**
 * ESLint harness for AI agent feedback.
 * Runs ESLint, produces lint-report.json with score and violations.
 * Score formula: 100 - (errorCount * 5) - (warningCount * 1), minimum 0.
 */

import { ESLint } from 'eslint';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

async function run() {
  const eslint = new ESLint({ cwd: projectRoot });
  const results = await eslint.lintFiles('.');

  let errorCount = 0;
  let warningCount = 0;
  const violations = [];

  for (const result of results) {
    if (result.messages.length === 0) continue;

    for (const msg of result.messages) {
      const severity = msg.severity === 2 ? 'error' : 'warn';
      if (msg.severity === 2) errorCount += 1;
      else warningCount += 1;

      violations.push({
        ruleId: msg.ruleId ?? 'unknown',
        severity,
        message: msg.message,
        line: msg.line ?? 0,
        column: msg.column ?? 0,
        file: result.filePath.startsWith(projectRoot)
          ? result.filePath.slice(projectRoot.length + 1)
          : result.filePath,
      });
    }
  }

  const score = Math.max(0, 100 - errorCount * 5 - warningCount * 1);

  const report = {
    score,
    errorCount,
    warningCount,
    violations,
  };

  const reportPath = join(projectRoot, 'lint-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(
    `Lint report written to lint-report.json: score=${score}, errors=${errorCount}, warnings=${warningCount}`,
  );

  process.exit(errorCount > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
