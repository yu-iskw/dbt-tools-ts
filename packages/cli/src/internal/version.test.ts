import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readValidatedUtf8Sync } from '@dbt-tools/core';
import { describe, expect, it } from 'vitest';

import { CLI_PACKAGE_VERSION } from './version';

describe('CLI package version', () => {
  it('matches package.json (guards __dirname depth under dist/internal/)', () => {
    const internalDir = path.dirname(fileURLToPath(import.meta.url));
    const packageRoot = path.join(internalDir, '..', '..');
    const pkgPath = path.join(packageRoot, 'package.json');
    const raw = readValidatedUtf8Sync(pkgPath);
    const version = (JSON.parse(raw) as { version: string }).version;
    expect(CLI_PACKAGE_VERSION).toBe(version);
  });
});
