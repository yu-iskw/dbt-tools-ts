import {
  SEARCH_RESOURCES_DEFAULT_LIMIT,
  SEARCH_RESOURCES_MAX_LIMIT,
} from '../contracts/search-resources-input.js';

import { legacySearchScore } from './legacy-search-score.js';
import { applyDiscoveryNodeFilters, parseDiscoveryQueryTokens } from './query-parse.js';

import type { ManifestGraph } from '../analysis/manifest/graph';
import type { ResourceNode } from '../analysis/snapshot';
import type { SearchResourcesInputContract } from '../contracts/search-resources-input.js';
import type {
  SearchResourceResult,
  SearchResourcesOutputContract,
} from '../contracts/search-resources.js';
import type { GraphNodeAttributes } from '../types';
export type SearchResourcesInput = SearchResourcesInputContract;
export type SearchResourcesOutput = SearchResourcesOutputContract;
export type { SearchResourceResult } from '../contracts/search-resources.js';
export { SEARCH_RESOURCES_DEFAULT_LIMIT, SEARCH_RESOURCES_MAX_LIMIT };

function clampLimit(value: number | undefined, defaultValue: number, maxValue: number): number {
  if (value == null || !Number.isFinite(value)) return defaultValue;
  return Math.min(Math.max(1, Math.floor(value)), maxValue);
}

function normalizeOffset(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function resolveOptionalSearchLimit(limit: number | undefined): number | undefined {
  if (limit == null) return undefined;
  return clampLimit(limit, SEARCH_RESOURCES_DEFAULT_LIMIT, SEARCH_RESOURCES_MAX_LIMIT);
}

function toSearchResult(uniqueId: string, attrs: GraphNodeAttributes): SearchResourceResult {
  return {
    unique_id: uniqueId,
    resource_type: attrs.resource_type,
    name: attrs.name,
    package_name: attrs.package_name,
    path: attrs.path as string | undefined,
    tags: attrs.tags as string[] | undefined,
    description: attrs.description as string | undefined,
  };
}

export type ResourceDetails = ResourceNode;

export function copyResourceForOutput(
  resource: ResourceNode,
  includeCode: boolean,
): ResourceDetails {
  if (includeCode) return resource;
  const result: ResourceDetails = { ...resource };
  delete result.compiledCode;
  delete result.rawCode;
  return result;
}

export function searchResourcesInGraph(
  graph: ManifestGraph,
  input: SearchResourcesInput,
): SearchResourcesOutput {
  const parsed = input.query ? parseDiscoveryQueryTokens(input.query) : { terms: [] };
  const effectiveType = input.type ?? parsed.type;
  const effectivePackage = input.package ?? parsed.package;
  const effectiveTag = input.tag ?? parsed.tag;
  const effectivePath = input.path ?? parsed.path;
  const scored: Array<{ score: number; result: SearchResourceResult }> = [];

  graph.getGraph().forEachNode((uniqueId, attrs) => {
    if (
      !applyDiscoveryNodeFilters(
        attrs,
        effectiveType,
        effectivePackage,
        effectiveTag,
        effectivePath,
      )
    ) {
      return;
    }
    const score = legacySearchScore(attrs, parsed.terms);
    if (score === 0) return;
    scored.push({ score, result: toSearchResult(uniqueId, attrs) });
  });

  scored.sort((a, b) =>
    b.score === a.score ? a.result.unique_id.localeCompare(b.result.unique_id) : b.score - a.score,
  );
  const limit = resolveOptionalSearchLimit(input.limit);
  const offset = normalizeOffset(input.offset);
  if (offset > 0 && limit == null) {
    throw new Error('offset requires limit');
  }
  const all = scored.map((row) => row.result);
  const results = limit == null ? all : all.slice(offset, offset + limit);
  return {
    query: input.query || undefined,
    total: all.length,
    results,
    offset,
    ...(limit != null
      ? {
          limit,
          has_more: offset + results.length < all.length,
        }
      : {}),
  };
}
