import {
  SEARCH_RESOURCES_DEFAULT_LIMIT,
  SEARCH_RESOURCES_MAX_LIMIT,
} from '@dbt-tools/core/artifact-workspace';
import { queryExecutionsInputSchema, toQueryExecutionsRequest } from '@dbt-tools/core/contracts';
import * as z from 'zod/v4';

import type { QueryDependenciesInput } from '@dbt-tools/core';
import type { GetResourceInput, SearchResourcesInput } from '@dbt-tools/core/artifact-workspace';

export { queryExecutionsInputSchema, toQueryExecutionsRequest };

export const emptyToolInputSchema = z.object({});

export const setTargetInputSchema = z.object({
  target: z.string().min(1),
});

const pageFields = {
  limit: z.number().int().min(1).max(SEARCH_RESOURCES_MAX_LIMIT).optional(),
  offset: z.number().int().min(0).optional(),
};

export const searchResourcesInputSchema = z.object({
  query: z.string().optional(),
  type: z.string().optional(),
  package: z.string().optional(),
  tag: z.string().optional(),
  path: z.string().optional(),
  ...pageFields,
});

export const getResourceInputSchema = z.object({
  uniqueId: z.string().min(1),
  includeCode: z.boolean().optional(),
});

export const queryDependenciesInputSchema = z.object({
  uniqueId: z.string().min(1),
  direction: z.enum(['upstream', 'downstream']).default('upstream'),
  depth: z.number().int().min(1).optional(),
  buildOrder: z.boolean().optional(),
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

export function toGetResourceInput(
  parsed: z.infer<typeof getResourceInputSchema>,
): GetResourceInput {
  return {
    uniqueId: parsed.uniqueId,
    includeCode: parsed.includeCode === true,
  };
}

export function toQueryDependenciesInput(
  parsed: z.infer<typeof queryDependenciesInputSchema>,
): QueryDependenciesInput {
  return {
    uniqueId: parsed.uniqueId,
    direction: parsed.direction,
    depth: parsed.depth,
    buildOrder: parsed.buildOrder === true,
  };
}
