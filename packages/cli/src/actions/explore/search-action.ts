/**
 * Search CLI action handler – fast manifest search across dbt entities.
 */
import {
  ManifestGraph,
  loadManifest,
  validateSafePath,
  validateNoControlChars,
  FieldFilter,
  formatOutput,
  resolveStdoutFormat,
  preferStructuredErrors,
  searchResourcesInGraph,
} from '@dbt-tools/core';
import {
  resolveCliArtifactPaths,
  extractArtifactRootCliOptions,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve';

export type SearchOptions = {
  type?: string;
  package?: string;
  tag?: string;
  path?: string;
  fields?: string;
  limit?: number;
  offset?: number;
  format?: string;
} & ArtifactRootCliOptions;

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

    const paths = await resolveCliArtifactPaths(extractArtifactRootCliOptions(options), {
      manifest: true,
      runResults: false,
    });
    validateSafePath(paths.manifest);

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);
    const output = searchResourcesInGraph(graph, {
      query,
      type: options.type,
      package: options.package,
      tag: options.tag,
      path: options.path,
      limit: options.limit,
      offset: options.offset,
    });

    const stdoutFormat = resolveStdoutFormat(options.format);
    if (stdoutFormat === 'json') {
      let out: unknown = output;
      if (options.fields) {
        out = FieldFilter.filterFields(output, options.fields);
      }
      console.log(formatOutput(out, options.format));
    } else {
      console.log(formatSearch(output));
    }
  } catch (error) {
    handleError(error, preferStructuredErrors(options.format));
  }
}
