import * as z from 'zod/v4';

import { jsonValueSchema, warehouseTypeSchema } from './shared.js';

const executionSortKeySchema = z.string();

export const queryExecutionsResultRowSchema = z.object({
  unique_id: z.string(),
  name: z.string().optional(),
  resource_type: z.string().optional(),
  status: z.string(),
  execution_time: z.number(),
  adapter_metrics: jsonValueSchema.optional(),
});

export const queryExecutionsOutputSchema = z.object({
  warehouse: warehouseTypeSchema,
  run_warehouse: warehouseTypeSchema,
  warehouse_criteria: z.unknown().nullable(),
  resource_types: z.array(z.string()),
  sort: executionSortKeySchema,
  limit: z.number().int(),
  offset: z.number().int(),
  total_matched: z.number().int(),
  returned: z.number().int(),
  has_more: z.boolean(),
  allowed_sorts: z.array(z.string()).optional(),
  allowed_min_filters: z.array(z.string()).optional(),
  rows: z.array(queryExecutionsResultRowSchema),
});

export type QueryExecutionsOutputContract = z.infer<typeof queryExecutionsOutputSchema>;
