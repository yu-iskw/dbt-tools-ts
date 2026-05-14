import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readMcpPackageVersion } from './package-version.js';

describe('readMcpPackageVersion', () => {
  it('matches packages/mcp/package.json', () => {
    const fromDisk = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
    ) as { version: string };

    expect(readMcpPackageVersion()).toBe(fromDisk.version);
  });
});
