/**
 * Search CLI action handler – fast manifest search across dbt entities.
 */
import { FieldFilter, shouldOutputJSON, validateNoControlChars } from '@dbt-tools/core';

import { type ArtifactRootCliOptions } from '../../internal/cli-artifact-resolve';
import { assertOffsetRequiresLimit, parseListOffset } from '../../internal/cli-pagination';
import {
  createCliUseCaseRunner,
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
 * Search action handler
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

    const runner = await createCliUseCaseRunner({ dbtTarget: options.dbtTarget });
    const output = await runner.runUseCase<SearchOutput>('resource.search', {
      query,
      type: options.type,
      package: options.package,
      tag: options.tag,
      path: options.path,
      limit: options.limit,
      offset,
    });

    if (options.json && options.fields) {
      emitCliUseCaseOutput(FieldFilter.filterFields(output, options.fields), options);
      return;
    }

    emitCliUseCaseOutput(output, options, formatSearch);
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
