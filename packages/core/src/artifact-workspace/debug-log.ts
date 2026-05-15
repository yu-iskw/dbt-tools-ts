import { isDbtToolsDebugEnabled } from '../config/dbt-tools-env';

export const ARTIFACT_WORKSPACE_DEBUG_PREFIX = '[dbt-tools][artifact-workspace]';

const MAX_FIELD_STRING = 120;
const MAX_ERROR_MESSAGE = 200;

function shortenForDebug(value: string, max: number): string {
  const t = value.replace(/\r?\n/g, '↵').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const half = Math.floor((max - 1) / 2);
  return `${t.slice(0, half)}…${t.slice(-half)}`;
}

export function sanitizeDebugErrorMessage(message: string): string {
  return shortenForDebug(message, MAX_ERROR_MESSAGE);
}

export function formatDebugFields(
  fields: Record<string, string | number | boolean | undefined>,
): string {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const display = typeof v === 'string' ? shortenForDebug(v, MAX_FIELD_STRING) : String(v);
      return `${k}=${display}`;
    })
    .join(' ');
}

export function debugArtifactLine(
  message: string,
  fields: Record<string, string | number | boolean | undefined>,
): void {
  if (!isDbtToolsDebugEnabled()) return;
  process.stderr.write(
    `${ARTIFACT_WORKSPACE_DEBUG_PREFIX} ${message} ${formatDebugFields(fields)}\n`,
  );
}

export async function withDebugTiming<T>(
  phase: string,
  fields: Record<string, string | number | boolean | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isDbtToolsDebugEnabled()) return fn();
  const t0 = performance.now();
  debugArtifactLine(`${phase}_start`, fields);
  try {
    return await fn();
  } finally {
    debugArtifactLine(`${phase}_end`, {
      ...fields,
      durationMs: Math.round(performance.now() - t0),
    });
  }
}

export function withDebugTimingSync<T>(
  phase: string,
  fields: Record<string, string | number | boolean | undefined>,
  fn: () => T,
): T {
  if (!isDbtToolsDebugEnabled()) return fn();
  const t0 = performance.now();
  debugArtifactLine(`${phase}_start`, fields);
  try {
    return fn();
  } finally {
    debugArtifactLine(`${phase}_end`, {
      ...fields,
      durationMs: Math.round(performance.now() - t0),
    });
  }
}
