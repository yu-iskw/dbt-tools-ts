import { getObjectProperty } from '../../util/typed-map';

import type {
  BaseAdapterSearchCriteria,
  BigQuerySearchCriteria,
  CommonExecutionSort,
  ExecutionSortKey,
  QueryExecutionsRequest,
  RunResultsSearchCriteria,
  SnowflakeSearchCriteria,
  WarehouseAdapterType,
  WarehouseExecutionProfile,
  WarehouseSearchBlock,
} from './types';
import type { NodeExecution } from '../execution/analyzer';
import type { ManifestGraph } from '../manifest/graph';
import type { ExecutionRow } from '../snapshot/types';

export const COMMON_EXECUTION_SORTS: readonly CommonExecutionSort[] = [
  'execution_time_desc',
  'execution_time_asc',
  'unique_id',
] as const;

const WAREHOUSE_BLOCK_KEYS = [
  'bigquery',
  'snowflake',
  'athena',
  'postgres',
  'redshift',
  'spark',
] as const satisfies readonly WarehouseAdapterType[];

export const WAREHOUSE_EXECUTION_PROFILES: Record<WarehouseAdapterType, WarehouseExecutionProfile> =
  {
    bigquery: {
      adapterType: 'bigquery',
      allowedSorts: [
        'slot_ms_desc',
        'bytes_processed_desc',
        'bytes_billed_desc',
        'rows_affected_desc',
      ],
      allowedMinFields: ['minSlotMs', 'minBytesProcessed', 'minBytesBilled', 'minRowsAffected'],
    },
    snowflake: {
      adapterType: 'snowflake',
      allowedSorts: [
        'bytes_processed_desc',
        'rows_affected_desc',
        'rows_inserted_desc',
        'rows_updated_desc',
        'rows_deleted_desc',
        'rows_duplicated_desc',
      ],
      allowedMinFields: [
        'minBytesProcessed',
        'minRowsAffected',
        'minRowsInserted',
        'minRowsUpdated',
        'minRowsDeleted',
        'minRowsDuplicated',
      ],
    },
    athena: {
      adapterType: 'athena',
      allowedSorts: ['bytes_processed_desc', 'rows_affected_desc'],
      allowedMinFields: ['minBytesProcessed', 'minRowsAffected'],
    },
    postgres: {
      adapterType: 'postgres',
      allowedSorts: ['bytes_processed_desc', 'rows_affected_desc'],
      allowedMinFields: ['minBytesProcessed', 'minRowsAffected'],
    },
    redshift: {
      adapterType: 'redshift',
      allowedSorts: ['bytes_processed_desc', 'rows_affected_desc'],
      allowedMinFields: ['minBytesProcessed', 'minRowsAffected'],
    },
    spark: {
      adapterType: 'spark',
      allowedSorts: ['bytes_processed_desc', 'rows_affected_desc'],
      allowedMinFields: ['minBytesProcessed', 'minRowsAffected'],
    },
  };

export const QUERY_EXECUTIONS_DEFAULT_LIMIT = 10;
export const QUERY_EXECUTIONS_MAX_LIMIT = 50;
export const QUERY_EXECUTIONS_MAX_UNIQUE_IDS = 100;

export function normalizeUniqueIdPattern(
  pattern: string,
  globMode: 'strict' | 'substring' = 'substring',
): string {
  if (globMode === 'strict' || pattern.includes('*')) return pattern;
  return `*${pattern}*`;
}

const DEFAULT_RESOURCE_TYPES = ['model', 'test', 'unit_test'] as const;

const MIN_FIELD_KEYS = [
  'minSlotMs',
  'minBytesProcessed',
  'minBytesBilled',
  'minRowsAffected',
  'minRowsInserted',
  'minRowsUpdated',
  'minRowsDeleted',
  'minRowsDuplicated',
] as const;

export class QueryExecutionsValidationError extends Error {
  readonly hint?: string;
  readonly allowed_sorts?: string[];
  readonly allowed_min_filters?: string[];

  constructor(
    message: string,
    options?: { hint?: string; allowed_sorts?: string[]; allowed_min_filters?: string[] },
  ) {
    super(message);
    this.name = 'QueryExecutionsValidationError';
    this.hint = options?.hint;
    this.allowed_sorts = options?.allowed_sorts;
    this.allowed_min_filters = options?.allowed_min_filters;
  }
}

export function normalizeWarehouseAdapterType(
  warehouseType: string | null | undefined,
): WarehouseAdapterType | 'unknown' {
  if (warehouseType == null || typeof warehouseType !== 'string') return 'unknown';
  const normalized = warehouseType.trim().toLowerCase();
  switch (normalized) {
    case 'bigquery':
    case 'snowflake':
    case 'athena':
    case 'postgres':
    case 'redshift':
    case 'spark':
      return normalized;
    default:
      return 'unknown';
  }
}

function readWarehouseBlock(request: QueryExecutionsRequest, key: WarehouseAdapterType): unknown {
  return getObjectProperty(request as Record<string, unknown>, key);
}

function warehouseExecutionProfile(warehouse: WarehouseAdapterType): WarehouseExecutionProfile {
  switch (warehouse) {
    case 'bigquery':
      return WAREHOUSE_EXECUTION_PROFILES.bigquery;
    case 'snowflake':
      return WAREHOUSE_EXECUTION_PROFILES.snowflake;
    case 'athena':
      return WAREHOUSE_EXECUTION_PROFILES.athena;
    case 'postgres':
      return WAREHOUSE_EXECUTION_PROFILES.postgres;
    case 'redshift':
      return WAREHOUSE_EXECUTION_PROFILES.redshift;
    case 'spark':
      return WAREHOUSE_EXECUTION_PROFILES.spark;
    default: {
      const _exhaustive: never = warehouse;
      return _exhaustive;
    }
  }
}

function countWarehouseBlocks(request: QueryExecutionsRequest): {
  keys: WarehouseAdapterType[];
  blocks: Map<WarehouseAdapterType, unknown>;
} {
  const blocks = new Map<WarehouseAdapterType, unknown>();
  const keys: WarehouseAdapterType[] = [];
  for (const key of WAREHOUSE_BLOCK_KEYS) {
    const value = readWarehouseBlock(request, key);
    if (value != null && typeof value === 'object' && Object.keys(value).length > 0) {
      keys.push(key);
      blocks.set(key, value);
    }
  }
  return { keys, blocks };
}

function parseStatusFilter(status: string[] | string | undefined): string[] | undefined {
  if (status == null) return undefined;
  if (typeof status === 'string') {
    const parts = status
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  }
  return status.map((s) => s.toLowerCase());
}

function toWarehouseSearchBlock(
  adapter: WarehouseAdapterType,
  criteria: unknown,
): WarehouseSearchBlock {
  switch (adapter) {
    case 'bigquery':
      return { adapter: 'bigquery', criteria: criteria as BigQuerySearchCriteria };
    case 'snowflake':
      return { adapter: 'snowflake', criteria: criteria as SnowflakeSearchCriteria };
    case 'athena':
      return { adapter: 'athena', criteria: criteria as BaseAdapterSearchCriteria };
    case 'postgres':
      return { adapter: 'postgres', criteria: criteria as BaseAdapterSearchCriteria };
    case 'redshift':
      return { adapter: 'redshift', criteria: criteria as BaseAdapterSearchCriteria };
    case 'spark':
      return { adapter: 'spark', criteria: criteria as BaseAdapterSearchCriteria };
    default: {
      const _exhaustive: never = adapter;
      return _exhaustive;
    }
  }
}

function blockSort(block: WarehouseSearchBlock | null): ExecutionSortKey | undefined {
  if (block == null) return undefined;
  return block.criteria.sort;
}

function validateMinFieldsAgainstProfile(
  profile: WarehouseExecutionProfile,
  criteria: Record<string, unknown>,
): void {
  const allowed = new Set(profile.allowedMinFields);
  for (const key of MIN_FIELD_KEYS) {
    const value = getObjectProperty(criteria, key);
    if (value === undefined) continue;
    if (!allowed.has(key)) {
      throw new QueryExecutionsValidationError(
        `${key} is not valid for warehouse ${profile.adapterType}; allowed: ${profile.allowedMinFields.join(', ')}`,
        {
          hint: `Use a ${profile.adapterType} criteria block with supported min fields.`,
          allowed_min_filters: [...profile.allowedMinFields],
        },
      );
    }
  }
}

export interface ResolvedWarehouseSearchPlan {
  warehouse: WarehouseAdapterType | 'unknown';
  runWarehouse: WarehouseAdapterType | 'unknown';
  activeWarehouseBlock: WarehouseSearchBlock | null;
  resourceTypes: string[];
  status?: string[];
  limit: number;
  offset: number;
  base: RunResultsSearchCriteria;
  effectiveSort: ExecutionSortKey;
  profile: WarehouseExecutionProfile | null;
  requestedUniqueIds?: string[];
  uniqueIdPatternForHints?: string;
}

function resolveWarehouseLabel(
  activeWarehouseBlock: WarehouseSearchBlock | null,
  runWarehouse: WarehouseAdapterType | 'unknown',
): WarehouseAdapterType | 'unknown' {
  if (activeWarehouseBlock != null) return activeWarehouseBlock.adapter;
  return runWarehouse;
}

function assertSingleWarehouseBlock(keys: WarehouseAdapterType[]): void {
  if (keys.length > 1) {
    throw new QueryExecutionsValidationError(
      `Only one warehouse criteria block allowed; got: ${keys.join(', ')}`,
      { hint: 'Set at most one of bigquery, snowflake, athena, postgres, redshift, spark.' },
    );
  }
}

function assertWarehouseBlockMatchesRun(
  activeWarehouseBlock: WarehouseSearchBlock | null,
  runWarehouse: WarehouseAdapterType | 'unknown',
): void {
  if (activeWarehouseBlock == null || runWarehouse === 'unknown') return;
  if (activeWarehouseBlock.adapter === runWarehouse) return;
  throw new QueryExecutionsValidationError(
    `Run warehouse is ${runWarehouse}; criteria block is ${activeWarehouseBlock.adapter}.`,
    {
      hint: `Omit the block or use the ${runWarehouse} block only.`,
      allowed_sorts: [
        ...COMMON_EXECUTION_SORTS,
        ...warehouseExecutionProfile(runWarehouse).allowedSorts,
      ],
    },
  );
}

function resolveEffectiveSort(
  request: QueryExecutionsRequest,
  activeWarehouseBlock: WarehouseSearchBlock | null,
  profile: WarehouseExecutionProfile | null,
): ExecutionSortKey {
  const blockSortKey = blockSort(activeWarehouseBlock);
  const effectiveSort: ExecutionSortKey = blockSortKey ?? request.sort ?? 'execution_time_desc';

  if (activeWarehouseBlock == null) {
    if (request.sort != null && !COMMON_EXECUTION_SORTS.includes(request.sort)) {
      throw new QueryExecutionsValidationError(
        `sort ${request.sort} requires a warehouse criteria block for adapter metrics`,
        {
          hint: 'Use execution_time_desc, execution_time_asc, or unique_id without a block, or add a warehouse block.',
          allowed_sorts: [...COMMON_EXECUTION_SORTS],
        },
      );
    }
    return effectiveSort;
  }

  if (profile != null) {
    validateMinFieldsAgainstProfile(
      profile,
      activeWarehouseBlock.criteria as Record<string, unknown>,
    );
    const isCommonSort = COMMON_EXECUTION_SORTS.includes(effectiveSort as CommonExecutionSort);
    if (
      !isCommonSort &&
      !profile.allowedSorts.includes(effectiveSort as (typeof profile.allowedSorts)[number])
    ) {
      throw new QueryExecutionsValidationError(
        `sort ${effectiveSort} is not valid for warehouse ${profile.adapterType}`,
        {
          hint: `Pick one of: ${profile.allowedSorts.join(', ')}`,
          allowed_sorts: [...profile.allowedSorts],
        },
      );
    }
  }

  return effectiveSort;
}

function assertQueryExecutionsPagination(request: QueryExecutionsRequest): void {
  if (request.offset != null && request.offset > 0 && request.limit == null) {
    throw new QueryExecutionsValidationError('offset requires limit');
  }
}

function assertUniqueIdsWithinLimit(uniqueIds: string[] | undefined): void {
  if (uniqueIds != null && uniqueIds.length > QUERY_EXECUTIONS_MAX_UNIQUE_IDS) {
    throw new QueryExecutionsValidationError(
      `uniqueIds exceeds maximum of ${QUERY_EXECUTIONS_MAX_UNIQUE_IDS}`,
      { hint: 'Split the request or use uniqueIdPattern for broader matching.' },
    );
  }
}

function buildExecutionSearchBase(
  request: QueryExecutionsRequest,
  activeWarehouseBlock: WarehouseSearchBlock | null,
): RunResultsSearchCriteria {
  return {
    min_execution_time: request.minExecutionTime,
    max_execution_time: request.maxExecutionTime,
    ...(request.sort != null && activeWarehouseBlock == null ? { sort: request.sort } : {}),
  };
}

function applyUniqueIdFiltersToBase(
  base: RunResultsSearchCriteria,
  request: QueryExecutionsRequest,
): string | undefined {
  if (request.uniqueIds != null && request.uniqueIds.length > 0) {
    base.unique_ids = new Set(request.uniqueIds);
  }

  if (request.uniqueIdPattern == null || request.uniqueIdPattern === '') {
    return undefined;
  }

  const globMode = request.globMode ?? 'substring';
  base.unique_id_pattern = normalizeUniqueIdPattern(request.uniqueIdPattern, globMode);
  return request.uniqueIdPattern;
}

function resolveAdapterTextFilter(
  request: QueryExecutionsRequest,
  activeAdapter: WarehouseAdapterType | null,
): string | undefined {
  const fromRequest = request.adapterText?.trim();
  if (fromRequest != null && fromRequest !== '') return fromRequest;
  if (activeAdapter === 'bigquery') return request.bigquery?.queryId?.trim() || undefined;
  return undefined;
}

export function resolveWarehouseSearchPlan(
  request: QueryExecutionsRequest,
  options: { warehouseType?: string | null; graph?: ManifestGraph },
): ResolvedWarehouseSearchPlan {
  const runWarehouse = normalizeWarehouseAdapterType(options.warehouseType);
  const { keys, blocks } = countWarehouseBlocks(request);
  assertSingleWarehouseBlock(keys);

  const activeAdapter = keys[0] ?? null;
  const activeWarehouseBlock =
    activeAdapter != null ? toWarehouseSearchBlock(activeAdapter, blocks.get(activeAdapter)) : null;
  assertWarehouseBlockMatchesRun(activeWarehouseBlock, runWarehouse);

  const warehouse = resolveWarehouseLabel(activeWarehouseBlock, runWarehouse);
  const profile = warehouse === 'unknown' ? null : warehouseExecutionProfile(warehouse);

  const resourceTypes = (request.resourceTypes ?? [...DEFAULT_RESOURCE_TYPES]).map((t) =>
    t.toLowerCase(),
  );
  const status = parseStatusFilter(request.status);
  const limit = Math.min(
    request.limit ?? QUERY_EXECUTIONS_DEFAULT_LIMIT,
    QUERY_EXECUTIONS_MAX_LIMIT,
  );
  const offset = request.offset ?? 0;
  assertQueryExecutionsPagination(request);
  assertUniqueIdsWithinLimit(request.uniqueIds);

  const base = buildExecutionSearchBase(request, activeWarehouseBlock);
  const uniqueIdPatternForHints = applyUniqueIdFiltersToBase(base, request);

  const adapterText = resolveAdapterTextFilter(request, activeAdapter);
  if (adapterText != null && adapterText !== '') {
    base.adapter_text = adapterText;
  }

  const effectiveSort = resolveEffectiveSort(request, activeWarehouseBlock, profile);

  return {
    warehouse,
    runWarehouse,
    activeWarehouseBlock,
    resourceTypes,
    status,
    limit,
    offset,
    base,
    effectiveSort,
    profile,
    ...(request.uniqueIds != null && request.uniqueIds.length > 0
      ? { requestedUniqueIds: [...request.uniqueIds] }
      : {}),
    ...(uniqueIdPatternForHints != null ? { uniqueIdPatternForHints } : {}),
  };
}

export function filterExecutionRowsByResourceTypes(
  rows: ExecutionRow[],
  resourceTypes: string[],
): ExecutionRow[] {
  const allowed = new Set(resourceTypes.map((t) => t.toLowerCase()));
  return rows.filter((row) => allowed.has(row.resourceType.toLowerCase()));
}

export function executionRowToNodeExecution(row: ExecutionRow): NodeExecution {
  return {
    unique_id: row.uniqueId,
    status: row.status,
    execution_time: row.executionTime,
    adapterMetrics: row.adapterMetrics,
    adapterResponseFields: row.adapterResponseFields,
  };
}
