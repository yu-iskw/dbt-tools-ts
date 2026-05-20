import { fileURLToPath } from 'node:url';

import { readValidatedUtf8Sync } from '@dbt-tools/core';
import { describe, expect, it } from 'vitest';

import { readMcpPackageVersion } from './package-version.js';

describe('readMcpPackageVersion', () => {
  it('matches packages/mcp/package.json', () => {
    const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const fromDisk = JSON.parse(readValidatedUtf8Sync(pkgPath)) as { version: string };

    expect(readMcpPackageVersion()).toBe(fromDisk.version);
  });
});
