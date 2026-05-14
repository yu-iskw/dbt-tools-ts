import { readFileSync } from 'node:fs';

/**
 * Resolved at runtime from compiled `dist/*.js` (package root is `..`).
 */
export function readMcpPackageVersion(): string {
  const url = new URL('../package.json', import.meta.url);
  const parsed = JSON.parse(readFileSync(url, 'utf-8')) as { version?: string };
  if (typeof parsed.version !== 'string' || parsed.version.trim() === '') {
    throw new Error('Invalid or missing "version" in @dbt-tools/mcp package.json');
  }
  return parsed.version;
}
