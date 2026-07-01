import { fileURLToPath } from 'node:url';

import { readValidatedUtf8Sync } from '@dbt-tools/core';

/**
 * Resolved at runtime from compiled `dist/internal/version.js` (package root).
 */
export const CLI_PACKAGE_VERSION: string = (
  JSON.parse(
    readValidatedUtf8Sync(fileURLToPath(new URL('../../package.json', import.meta.url))),
  ) as {
    version: string;
  }
).version;
