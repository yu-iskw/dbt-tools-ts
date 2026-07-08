import {
  SEARCH_RESOURCES_DEFAULT_LIMIT,
  emptyUseCaseInputSchema,
  queryExecutionsInputSchema,
  searchResourcesInputSchema,
  toQueryExecutionsRequest,
} from '@dbt-tools/core/contracts';
import * as z from 'zod/v4';

import { mcpOptionalBooleanSchema } from '../mcp-coercions.js';

import type { SearchResourcesInput } from '@dbt-tools/core/artifact-workspace';

export {
  emptyUseCaseInputSchema as emptyToolInputSchema,
  queryExecutionsInputSchema,
  searchResourcesInputSchema,
  toQueryExecutionsRequest,
};

export const setTargetInputSchema = z.object({
  target: z.string().min(1),
});

export const getResourceInputSchema = z.object({
  uniqueId: z.string().min(1),
  includeCode: mcpOptionalBooleanSchema,
});

export const queryDependenciesInputSchema = z.object({
  uniqueId: z.string().min(1),
  direction: z.enum(['upstream', 'downstream']).default('upstream'),
  depth: z.number().int().min(1).optional(),
  buildOrder: mcpOptionalBooleanSchema,
});

export function toSearchResourcesInput(
  parsed: z.infer<typeof searchResourcesInputSchema>,
): SearchResourcesInput {
  return {
    query: parsed.query,
    type: parsed.type,
    package: parsed.package,
    tag: parsed.tag,
    path: parsed.path,
    limit: parsed.limit ?? SEARCH_RESOURCES_DEFAULT_LIMIT,
    offset: parsed.offset ?? 0,
  };
}
