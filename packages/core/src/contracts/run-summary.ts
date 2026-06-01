import * as z from 'zod/v4';

import { jsonValueSchema, statusToneSchema, warehouseTypeSchema } from './shared.js';

const bottleneckNodeSchema = z
  .object({
    unique_id: z.string(),
    name: z.string().optional(),
    execution_time: z.number(),
    rank: z.number().int(),
    pct_of_total: z.number(),
    status: z.string(),
  })
  .passthrough();

const bottleneckResultSchema = z
  .object({
    nodes: z.array(bottleneckNodeSchema),
    total_execution_time: z.number(),
    criteria_used: z.enum(['threshold', 'top_n']),
  })
  .passthrough();

const statusBreakdownItemSchema = z
  .object({
    status: z.string(),
    count: z.number().int(),
    duration: z.number(),
    share: z.number(),
    tone: statusToneSchema,
  })
  .passthrough();

const executionSummarySchema = z
  .object({
    total_execution_time: z.number(),
    total_nodes: z.number().int(),
    nodes_by_status: z.record(z.string(), z.number().int()),
    critical_path: jsonValueSchema.optional(),
    node_executions: z.array(jsonValueSchema),
  })
  .passthrough();

const adapterTotalsSnapshotSchema = z
  .object({
    nodesWithAdapterData: z.number().int(),
    totalBytesProcessed: z.number().optional(),
    totalBytesBilled: z.number().optional(),
    totalSlotMs: z.number().optional(),
    totalRowsAffected: z.number().optional(),
    totalRowsInserted: z.number().optional(),
    totalRowsUpdated: z.number().optional(),
    totalRowsDeleted: z.number().optional(),
    totalRowsDuplicated: z.number().optional(),
  })
  .passthrough();

export const runSummaryOutputSchema = z.object({
  summary: executionSummarySchema,
  statusBreakdown: z.array(statusBreakdownItemSchema),
  bottlenecks: bottleneckResultSchema.optional(),
  adapterTotals: adapterTotalsSnapshotSchema.nullable(),
  warehouse_type: warehouseTypeSchema,
});

export type RunSummaryOutput = z.infer<typeof runSummaryOutputSchema>;
/** @deprecated Use {@link RunSummaryOutput} */
export type RunSummaryOutputContract = RunSummaryOutput;
