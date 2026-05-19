/**
 * Debug logging for the web app. Use `?debug=1` in the URL to enable.
 * For server logs (dbt-target plugin), use `DBT_TOOLS_DEBUG=1` when starting dev.
 */
const DEBUG =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('debug') === '1'
    : false;

export function debug(...args: unknown[]): void {
  if (DEBUG) console.log('[dbt-tools]', ...args);
}

export function markDebug(name: string): void {
  if (!DEBUG || typeof performance === 'undefined') return;
  performance.mark(name);
}

export function measureDebug(name: string, startMark: string, endMark: string): void {
  if (!DEBUG || typeof performance === 'undefined') return;
  performance.measure(name, startMark, endMark);
  const entries = performance.getEntriesByName(name, 'measure');
  const entry = entries[entries.length - 1];
  if (entry) {
    debug(`${name}: ${entry.duration.toFixed(1)}ms`);
  }
}
