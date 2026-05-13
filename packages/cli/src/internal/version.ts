import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolved at runtime from compiled `dist/internal/version.js` (package root).
 */
export const CLI_PACKAGE_VERSION: string = (
  JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')) as {
    version: string;
  }
).version;
