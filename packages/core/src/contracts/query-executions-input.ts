import * as z from 'zod/v4';

import {
  QUERY_EXECUTIONS_DEFAULT_LIMIT,
  QUERY_EXECUTIONS_MAX_LIMIT,
} from '../analysis/search/warehouse.js';
import { getObjectProperty, setObjectProperty } from '../util/typed-map.js';

import type {
  AthenaSearchCriteria,
  BaseAdapterSearchCriteria,
  BigQuerySearchCriteria,
  QueryExecutionsRequest,
  SnowflakeSearchCriteria,
} from '../analysis/search/types.js';

const bigQueryBlockSchema = z
  .object({
    sort: z
      .enum(['slot_ms_desc', 'bytes_processed_desc', 'bytes_billed_desc', 'rows_affected_desc'])
      .optional(),
    minSlotMs: z.number().optional(),
    minBytesProcessed: z.number().optional(),
    minBytesBilled: z.number().optional(),
    minRowsAffected: z.number().optional(),
  })
  .strict()
  .optional();

const snowflakeBlockSchema = z
  .object({
    sort: z
      .enum([
        'bytes_processed_desc',
        'rows_affected_desc',
        'rows_inserted_desc',
        'rows_updated_desc',
        'rows_deleted_desc',
        'rows_duplicated_desc',
      ])
      .optional(),
    minBytesProcessed: z.number().optional(),
    minRowsAffected: z.number().optional(),
    minRowsInserted: z.number().optional(),
    minRowsUpdated: z.number().optional(),
    minRowsDeleted: z.number().optional(),
    minRowsDuplicated: z.number().optional(),
  })
  .strict()
  .optional();

const baseWarehouseBlockSchema = z
  .object({
    sort: z.enum(['bytes_processed_desc', 'rows_affected_desc']).optional(),
    minBytesProcessed: z.number().optional(),
    minRowsAffected: z.number().optional(),
  })
  .strict()
  .optional();

export const queryExecutionsInputSchema = z
  .object({
    resourceTypes: z.array(z.string()).optional(),
    status: z.union([z.string(), z.array(z.string())]).optional(),
    limit: z.number().int().min(1).max(QUERY_EXECUTIONS_MAX_LIMIT).optional(),
    offset: z.number().int().min(0).optional(),
    uniqueIdPattern: z.string().optional(),
    minExecutionTime: z.number().optional(),
    maxExecutionTime: z.number().optional(),
    sort: z.enum(['execution_time_desc', 'execution_time_asc', 'unique_id']).optional(),
    bigquery: bigQueryBlockSchema,
    snowflake: snowflakeBlockSchema,
    athena: baseWarehouseBlockSchema,
    postgres: baseWarehouseBlockSchema,
    redshift: baseWarehouseBlockSchema,
    spark: baseWarehouseBlockSchema,
  })
  .superRefine((value, ctx) => {
    const blocks = [
      value.bigquery,
      value.snowflake,
      value.athena,
      value.postgres,
      value.redshift,
      value.spark,
    ].filter((block) => block != null);
    if (blocks.length > 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Only one warehouse criteria block is allowed.',
      });
    }
  });

function pickWarehouseBlock(
  block: Record<string, unknown> | undefined,
  fields: Record<string, string>,
): Record<string, unknown> | undefined {
  if (block == null) return undefined;
  const out: Record<string, unknown> = {};
  for (const [targetKey, sourceKey] of Object.entries(fields)) {
    const value = getObjectProperty(block, sourceKey);
    if (value !== undefined) setObjectProperty(out, targetKey, value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function toQueryExecutionsRequest(
  parsed: z.infer<typeof queryExecutionsInputSchema>,
): QueryExecutionsRequest {
  return {
    resourceTypes: parsed.resourceTypes,
    status: parsed.status,
    limit: parsed.limit ?? QUERY_EXECUTIONS_DEFAULT_LIMIT,
    offset: parsed.offset ?? 0,
    uniqueIdPattern: parsed.uniqueIdPattern,
    minExecutionTime: parsed.minExecutionTime,
    maxExecutionTime: parsed.maxExecutionTime,
    ...(parsed.sort != null ? { sort: parsed.sort } : {}),
    bigquery: pickWarehouseBlock(parsed.bigquery, {
      sort: 'sort',
      minSlotMs: 'minSlotMs',
      minBytesProcessed: 'minBytesProcessed',
      minBytesBilled: 'minBytesBilled',
      minRowsAffected: 'minRowsAffected',
    }) as BigQuerySearchCriteria | undefined,
    snowflake: pickWarehouseBlock(parsed.snowflake, {
      sort: 'sort',
      minBytesProcessed: 'minBytesProcessed',
      minRowsAffected: 'minRowsAffected',
      minRowsInserted: 'minRowsInserted',
      minRowsUpdated: 'minRowsUpdated',
      minRowsDeleted: 'minRowsDeleted',
      minRowsDuplicated: 'minRowsDuplicated',
    }) as SnowflakeSearchCriteria | undefined,
    athena: pickWarehouseBlock(parsed.athena, {
      sort: 'sort',
      minBytesProcessed: 'minBytesProcessed',
      minRowsAffected: 'minRowsAffected',
    }) as AthenaSearchCriteria | undefined,
    postgres: pickWarehouseBlock(parsed.postgres, {
      sort: 'sort',
      minBytesProcessed: 'minBytesProcessed',
      minRowsAffected: 'minRowsAffected',
    }) as BaseAdapterSearchCriteria | undefined,
    redshift: pickWarehouseBlock(parsed.redshift, {
      sort: 'sort',
      minBytesProcessed: 'minBytesProcessed',
      minRowsAffected: 'minRowsAffected',
    }) as BaseAdapterSearchCriteria | undefined,
    spark: pickWarehouseBlock(parsed.spark, {
      sort: 'sort',
      minBytesProcessed: 'minBytesProcessed',
      minRowsAffected: 'minRowsAffected',
    }) as BaseAdapterSearchCriteria | undefined,
  };
}
