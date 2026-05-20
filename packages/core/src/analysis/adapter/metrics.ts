/**
 * Best-effort normalization of dbt run_results adapter_response objects.
 * Shapes vary by warehouse adapter. We keep stable normalized metrics for
 * aggregate/report use-cases and also preserve a browser-safe field model for
 * arbitrary UI rendering.
 */

import { getObjectProperty, incrementMapCount, setObjectProperty } from '../../util/typed-map';

export type AdapterResponseFieldKind =
  | 'array'
  | 'boolean'
  | 'null'
  | 'number'
  | 'object'
  | 'string';

export interface AdapterResponseField {
  key: string;
  label: string;
  kind: AdapterResponseFieldKind;
  displayValue: string;
  isScalar: boolean;
  sortValue?: number | string;
}

export interface AdapterResponseMetrics {
  bytesProcessed?: number;
  bytesBilled?: number;
  slotMs?: number;
  rowsAffected?: number;
  adapterCode?: string;
  adapterMessage?: string;
  /** BigQuery job id, Snowflake query id, etc. */
  queryId?: string;
  projectId?: string;
  location?: string;
  /** Snowflake DML stats: rows inserted in this statement. */
  rowsInserted?: number;
  /** Snowflake DML stats: rows deleted in this statement. */
  rowsDeleted?: number;
  /** Snowflake DML stats: rows updated in this statement. */
  rowsUpdated?: number;
  /** Snowflake DML stats: rows duplicated in this statement. */
  rowsDuplicated?: number;
  /** Top-level keys present on the raw object (for debugging). */
  rawKeys: string[];
}

export interface AdapterTotalsSnapshot {
  nodesWithAdapterData: number;
  totalBytesProcessed?: number;
  totalBytesBilled?: number;
  totalSlotMs?: number;
  totalRowsAffected?: number;
  totalRowsInserted?: number;
  totalRowsUpdated?: number;
  totalRowsDeleted?: number;
  totalRowsDuplicated?: number;
}

export function readFiniteNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = getObjectProperty(obj, key);
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return undefined;
}

export function readNonEmptyString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = getObjectProperty(obj, key);
  if (typeof v === 'string' && v.trim() !== '') {
    return v;
  }
  return undefined;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value === '' ? '""' : value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(', ')}]`;
  }
  if (!isPlainObject(value)) {
    return String(value);
  }
  const sortedKeys = Object.keys(value).sort();
  return `{${sortedKeys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(getObjectProperty(value, key))}`)
    .join(',')}}`;
}

function buildField(key: string, value: unknown): AdapterResponseField {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return {
      key,
      label: key,
      kind: 'number',
      displayValue: value.toLocaleString(),
      isScalar: true,
      sortValue: value,
    };
  }
  if (typeof value === 'string') {
    return {
      key,
      label: key,
      kind: 'string',
      displayValue: value === '' ? '""' : value,
      isScalar: true,
      sortValue: value,
    };
  }
  if (typeof value === 'boolean') {
    return {
      key,
      label: key,
      kind: 'boolean',
      displayValue: value ? 'true' : 'false',
      isScalar: true,
      sortValue: value ? 1 : 0,
    };
  }
  if (value === null) {
    return {
      key,
      label: key,
      kind: 'null',
      displayValue: 'null',
      isScalar: false,
    };
  }
  if (Array.isArray(value)) {
    return {
      key,
      label: key,
      kind: 'array',
      displayValue: stableStringify(value),
      isScalar: false,
    };
  }
  return {
    key,
    label: key,
    kind: 'object',
    displayValue: stableStringify(value),
    isScalar: false,
  };
}

function flattenTopLevelEntry(key: string, value: unknown): AdapterResponseField[] {
  if (!isPlainObject(value)) {
    return [buildField(key, value)];
  }

  const nestedKeys = Object.keys(value).sort();
  if (nestedKeys.length === 0) {
    return [buildField(key, value)];
  }

  return nestedKeys.map((nestedKey) =>
    buildField(`${key}.${nestedKey}`, getObjectProperty(value, nestedKey)),
  );
}

/**
 * Returns true when any normalized field beyond rawKeys is present.
 */
export function adapterMetricsHasData(metrics: AdapterResponseMetrics): boolean {
  return (
    metrics.bytesProcessed !== undefined ||
    metrics.bytesBilled !== undefined ||
    metrics.slotMs !== undefined ||
    metrics.rowsAffected !== undefined ||
    metrics.adapterCode !== undefined ||
    metrics.adapterMessage !== undefined ||
    metrics.queryId !== undefined ||
    metrics.projectId !== undefined ||
    metrics.location !== undefined ||
    metrics.rowsInserted !== undefined ||
    metrics.rowsDeleted !== undefined ||
    metrics.rowsUpdated !== undefined ||
    metrics.rowsDuplicated !== undefined
  );
}

export function isAdapterResponseObject(
  adapterResponse: unknown,
): adapterResponse is Record<string, unknown> {
  return isPlainObject(adapterResponse);
}

/**
 * Some exports / loaders stringify `adapter_response` even though artifacts are
 * normally objects. Parse JSON object/array strings so we can extract fields.
 */
export function coerceAdapterResponseInput(raw: unknown): unknown {
  if (typeof raw !== 'string') {
    return raw;
  }
  const t = raw.trim();
  if (t === '' || t === 'null') {
    return null;
  }
  const first = t[0];
  if (first !== '{' && first !== '[') {
    return raw;
  }
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return raw;
  }
}

/**
 * Normalize adapter_response from a single run_results result row.
 */
export function normalizeAdapterResponse(adapterResponse: unknown): AdapterResponseMetrics {
  if (!isPlainObject(adapterResponse)) {
    return { rawKeys: [] };
  }

  const rawKeys = Object.keys(adapterResponse).filter((k) => typeof k === 'string');

  const bytesProcessed = readFiniteNumber(adapterResponse, 'bytes_processed');
  const bytesBilled = readFiniteNumber(adapterResponse, 'bytes_billed');
  const slotMs = readFiniteNumber(adapterResponse, 'slot_ms');
  const rowsAffected = readFiniteNumber(adapterResponse, 'rows_affected');

  const adapterCode = readNonEmptyString(adapterResponse, 'code');
  const adapterMessage = readNonEmptyString(adapterResponse, '_message');

  const queryId =
    readNonEmptyString(adapterResponse, 'query_id') ??
    readNonEmptyString(adapterResponse, 'job_id');
  const projectId = readNonEmptyString(adapterResponse, 'project_id');
  const location = readNonEmptyString(adapterResponse, 'location');

  return {
    ...(bytesProcessed !== undefined ? { bytesProcessed } : {}),
    ...(bytesBilled !== undefined ? { bytesBilled } : {}),
    ...(slotMs !== undefined ? { slotMs } : {}),
    ...(rowsAffected !== undefined ? { rowsAffected } : {}),
    ...(adapterCode !== undefined ? { adapterCode } : {}),
    ...(adapterMessage !== undefined ? { adapterMessage } : {}),
    ...(queryId !== undefined ? { queryId } : {}),
    ...(projectId !== undefined ? { projectId } : {}),
    ...(location !== undefined ? { location } : {}),
    rawKeys,
  };
}

/**
 * Preserve browser-safe raw adapter_response fields for arbitrary UI rendering.
 * Top-level objects are flattened one level deep; deeper arrays/objects are
 * stringified deterministically for display.
 */
export function extractAdapterResponseFields(adapterResponse: unknown): AdapterResponseField[] {
  if (!isPlainObject(adapterResponse)) {
    return [];
  }

  return Object.keys(adapterResponse)
    .sort()
    .flatMap((key) => flattenTopLevelEntry(key, getObjectProperty(adapterResponse, key)));
}

type AdapterMetricTotalConfig = Array<{
  metricKey: Exclude<keyof AdapterResponseMetrics, 'rawKeys'>;
  totalKey: keyof AdapterTotalsSnapshot;
}>;

function accumulateAdapterMetricTotals(
  metrics: AdapterResponseMetrics,
  metricConfig: AdapterMetricTotalConfig,
  totals: Map<keyof AdapterTotalsSnapshot, number>,
  seen: Map<keyof AdapterTotalsSnapshot, boolean>,
): void {
  for (const { metricKey, totalKey } of metricConfig) {
    const value = getObjectProperty(metrics as unknown as Record<string, unknown>, metricKey);
    if (typeof value === 'number') {
      incrementMapCount(totals, totalKey, value);
      seen.set(totalKey, true);
    }
  }
}

function adapterTotalsSnapshotFromMaps(
  nodesWithAdapterData: number,
  metricConfig: AdapterMetricTotalConfig,
  totals: Map<keyof AdapterTotalsSnapshot, number>,
  seen: Map<keyof AdapterTotalsSnapshot, boolean>,
): AdapterTotalsSnapshot {
  const snapshot: AdapterTotalsSnapshot = { nodesWithAdapterData };
  for (const { totalKey } of metricConfig) {
    if (!seen.get(totalKey)) continue;
    const total = totals.get(totalKey);
    if (total !== undefined) {
      setObjectProperty(snapshot as unknown as Record<string, unknown>, totalKey, total);
    }
  }
  return snapshot;
}

/**
 * Aggregate adapter metrics across node executions for snapshot-level summaries.
 */
export function buildAdapterTotals(
  metricsList: Array<AdapterResponseMetrics | undefined>,
): AdapterTotalsSnapshot | undefined {
  const metricConfig = [
    { metricKey: 'bytesProcessed', totalKey: 'totalBytesProcessed' },
    { metricKey: 'bytesBilled', totalKey: 'totalBytesBilled' },
    { metricKey: 'slotMs', totalKey: 'totalSlotMs' },
    { metricKey: 'rowsAffected', totalKey: 'totalRowsAffected' },
    { metricKey: 'rowsInserted', totalKey: 'totalRowsInserted' },
    { metricKey: 'rowsUpdated', totalKey: 'totalRowsUpdated' },
    { metricKey: 'rowsDeleted', totalKey: 'totalRowsDeleted' },
    { metricKey: 'rowsDuplicated', totalKey: 'totalRowsDuplicated' },
  ] as const satisfies AdapterMetricTotalConfig;
  let nodesWithAdapterData = 0;
  const totals = new Map<keyof AdapterTotalsSnapshot, number>();
  const seen = new Map<keyof AdapterTotalsSnapshot, boolean>();
  for (const { totalKey } of metricConfig) {
    totals.set(totalKey, 0);
    seen.set(totalKey, false);
  }

  for (const m of metricsList) {
    if (m == null || !adapterMetricsHasData(m)) continue;
    nodesWithAdapterData += 1;
    accumulateAdapterMetricTotals(m, metricConfig, totals, seen);
  }

  if (nodesWithAdapterData === 0) {
    return undefined;
  }

  return adapterTotalsSnapshotFromMaps(nodesWithAdapterData, metricConfig, totals, seen);
}
