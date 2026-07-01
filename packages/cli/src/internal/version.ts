import { join } from 'node:path';

import { readValidatedUtf8Sync } from '@dbt-tools/core';

/**
 * Resolved at runtime from compiled `dist/internal/version.js` (package root).
 */
export const CLI_PACKAGE_VERSION: string = (
  JSON.parse(readValidatedUtf8Sync(join(__dirname, '..', '..', 'package.json'))) as {
    version: string;
  }
).version;
