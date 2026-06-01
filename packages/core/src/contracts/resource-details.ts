import * as z from 'zod/v4';

import { jsonValueSchema, statusToneSchema } from './shared.js';

export const resourceDetailsSchema = z
  .object({
    uniqueId: z.string(),
    name: z.string(),
    resourceType: z.string(),
    packageName: z.string(),
    tags: z.array(z.string()).optional(),
    path: z.string().nullable(),
    originalFilePath: z.string().nullable(),
    patchPath: z.string().nullable().optional(),
    database: z.string().nullable().optional(),
    schema: z.string().nullable().optional(),
    description: z.string().nullable(),
    compiledCode: z.string().nullable().optional(),
    rawCode: z.string().nullable().optional(),
    definition: jsonValueSchema.nullable().optional(),
    status: z.string().nullable(),
    statusTone: statusToneSchema,
    executionTime: z.number().nullable(),
    threadId: z.string().nullable(),
    semantics: jsonValueSchema.optional(),
    testAttachedTarget: z.string().nullable().optional(),
    runResultMessage: z.string().nullable().optional(),
    adapterMetrics: jsonValueSchema.optional(),
    adapterResponseFields: z.array(jsonValueSchema).optional(),
    catalogStats: jsonValueSchema.nullable().optional(),
    sourceFreshness: jsonValueSchema.nullable().optional(),
  })
  .passthrough();

export type ResourceDetailsContract = z.infer<typeof resourceDetailsSchema>;

/** MCP tool output: object envelope required by @modelcontextprotocol/sdk outputSchema normalization. */
export const getResourceToolOutputSchema = z
  .object({
    resource: resourceDetailsSchema.nullable(),
  })
  .passthrough();

export type GetResourceToolOutput = z.infer<typeof getResourceToolOutputSchema>;
