#!/usr/bin/env node
/**
 * Copies packages/LICENSE into each @dbt-tools/* package so npm
 * tarballs ship the canonical license text. Run from repo root.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'packages', 'LICENSE');
const targets = [
  path.join(root, 'packages', 'core', 'LICENSE'),
  path.join(root, 'packages', 'cli', 'LICENSE'),
  path.join(root, 'packages', 'web', 'LICENSE'),
  path.join(root, 'packages', 'mcp', 'LICENSE'),
];

if (!fs.existsSync(src)) {
  console.error(`copy-dbt-tools-license: missing ${src}`);
  process.exit(1);
}

for (const dest of targets) {
  fs.copyFileSync(src, dest);
}
