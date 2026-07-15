/**
 * Search CLI action handler – fast manifest search across dbt entities.
 */
import {
  ManifestGraph,
  loadManifest,
  searchResourcesInGraph,
  shouldOutputJSON,
  validateNoControlChars,
  validateSafePath,
} from '@dbt-tools/core';
import { normalizeSearchResourcesInput } from '@dbt-tools/core/contracts';

import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve';
import { assertOffsetRequiresLimit, parseListOffset } from '../../internal/cli-pagination';
import {
  emitCliUseCaseOutput,
  type CliUseCaseRunOptions,
} from '../../internal/cli-use-case-runner';

export type SearchOptions = ArtifactRootCliOptions &
  CliUseCaseRunOptions & {
    type?: string;
    package?: string;
    tag?: string;
    path?: string;
    fields?: string;
    limit?: number;
    offset?: number;
  };

export type SearchResult = {
  unique_id: string;
  resource_type: string;
  name: string;
  package_name: string;
  path?: string;
  tags?: string[];
  description?: string;
};

export type SearchOutput = {
  query?: string;
  /** Total matches before paging. */
  total: number;
  results: SearchResult[];
  limit?: number;
  offset?: number;
  has_more?: boolean;
};

/**
 * Format search results as human-readable output.
 */
export function formatSearch(output: SearchOutput): string {
  const lines: string[] = [];
  const header = output.query ? `Search results for "${output.query}"` : 'Search results';
  lines.push(header);
  lines.push('='.repeat(header.length));
  lines.push(`${output.total} result${output.total !== 1 ? 's' : ''} found`);
  if (output.limit !== undefined) {
    lines.push(
      `Page: limit=${output.limit} offset=${output.offset ?? 0} has_more=${String(output.has_more ?? false)}`,
    );
  }

  if (output.results.length === 0) {
    return lines.join('\n');
  }

  lines.push('');
  for (const r of output.results) {
    const tags = r.tags?.length ? `  tags: ${r.tags.join(', ')}` : '';
    lines.push(`  ${r.unique_id}`);
    lines.push(`    type: ${r.resource_type}  package: ${r.package_name}${tags}`);
    if (r.path) lines.push(`    path: ${r.path}`);
  }

  return lines.join('\n');
}

/**
 * Search action handler — manifest-only (same resolution as discover/deps).
 */
export async function searchAction(
  query: string | undefined,
  options: SearchOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    if (query) {
      validateNoControlChars(query);
    }

    const offset = parseListOffset(options.offset);
    assertOffsetRequiresLimit(options.limit, offset);

    const paths = await resolveCliArtifactPaths(
      { dbtTarget: options.dbtTarget },
      { manifest: true, runResults: false },
    );
    validateSafePath(paths.manifest);

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);
    const output = searchResourcesInGraph(
      graph,
      normalizeSearchResourcesInput({
        query,
        type: options.type,
        package: options.package,
        tag: options.tag,
        path: options.path,
        limit: options.limit,
        offset,
      }),
    );

    emitCliUseCaseOutput(output, options, formatSearch);
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
