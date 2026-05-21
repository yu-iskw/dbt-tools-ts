import { fileURLToPath } from 'node:url';

import { readValidatedUtf8Sync } from '@dbt-tools/core';

/**
 * Resolved at runtime from compiled `dist/*.js` (package root is `..`).
 */
export function readWebPackageVersion(): string {
  const pkgPath = fileURLToPath(new URL('../../package.json', import.meta.url));
  const parsed = JSON.parse(readValidatedUtf8Sync(pkgPath)) as { version?: string };
  if (typeof parsed.version !== 'string' || parsed.version.trim() === '') {
    throw new Error('Invalid or missing "version" in @dbt-tools/web package.json');
  }
  return parsed.version;
}
