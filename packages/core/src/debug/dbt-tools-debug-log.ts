import { isDbtToolsDebugEnabled } from '../config/dbt-tools-env.js';

/** MCP-safe progress logs (stderr only; stdout is reserved for MCP JSON-RPC). */
export function dbtToolsDebugLog(message: string): void {
  if (!isDbtToolsDebugEnabled()) return;
  process.stderr.write(`[dbt-tools] ${message}\n`);
}

export function dbtToolsDebugLogPhase(phase: string, startedAtMs: number, detail?: string): void {
  if (!isDbtToolsDebugEnabled()) return;
  const elapsedMs = Date.now() - startedAtMs;
  const suffix = detail != null && detail !== '' ? ` ${detail}` : '';
  process.stderr.write(`[dbt-tools] ${phase} (${elapsedMs}ms)${suffix}\n`);
}

export function dbtToolsDebugNow(): number {
  return Date.now();
}
