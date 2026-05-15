/**
 * Discover CLI — ranked, explainable resource discovery (superset of search).
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
  discoverResources,
  buildDiscoverWebUrl,
  getDbtToolsWebBaseUrlFromEnv,
  type DiscoverOutput,
} from '@dbt-tools/core';
import {
  resolveCliArtifactPaths,
  extractArtifactRootCliOptions,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve';

export type DiscoverCliOptions = {
  type?: string;
  package?: string;
  tag?: string;
  path?: string;
  fields?: string;
  format?: string;
  limit?: number;
  trace?: boolean;
} & ArtifactRootCliOptions;

function buildDiscoverQueryForWeb(
  output: DiscoverOutput,
  options: Pick<DiscoverCliOptions, 'path' | 'package' | 'tag' | 'type'>,
): string {
  const query = output.query.trim();
  const filters = [
    options.type?.trim() ? `type:${options.type.trim()}` : null,
    options.package?.trim() ? `package:${options.package.trim()}` : null,
    options.tag?.trim() ? `tag:${options.tag.trim()}` : null,
    options.path?.trim() ? `path:${options.path.trim()}` : null,
  ].filter((token): token is string => token !== null);

  return [query, ...filters].filter(Boolean).join(' ').trim();
}

function enrichDiscoverJson(
  output: DiscoverOutput,
  options: Pick<DiscoverCliOptions, 'path' | 'package' | 'tag' | 'trace' | 'type'>,
): DiscoverOutput {
  const base = getDbtToolsWebBaseUrlFromEnv();
  const next: DiscoverOutput = { ...output };
  if (base) {
    next.web_url = buildDiscoverWebUrl(base, buildDiscoverQueryForWeb(output, options));
    next.review_url = next.web_url;
  }
  if (options.trace) {
    next.investigation_transcript = {
      intent: 'discover',
      input: output.query,
      steps: [{ op: 'discover.rank', status: 'ok' }],
    };
  }
  return next;
}

export function formatDiscoverHuman(output: DiscoverOutput): string {
  const lines: string[] = [];
  const header = output.query ? `Discovery results for "${output.query}"` : 'Discovery results';
  lines.push(header);
  lines.push('='.repeat(header.length));
  lines.push(`${output.matches.length} match${output.matches.length !== 1 ? 'es' : ''}`);

  if (output.matches.length === 0) {
    return lines.join('\n');
  }

  for (const m of output.matches) {
    lines.push('');
    lines.push(`  ${m.unique_id}`);
    lines.push(`    score: ${m.score}  confidence: ${m.confidence}  type: ${m.resource_type}`);
    lines.push(`    reasons: ${m.reasons.join(', ')}`);
    if (m.disambiguation.length > 0) {
      lines.push(`    also consider: ${m.disambiguation.map((d) => d.unique_id).join('; ')}`);
    }
    if (m.related.length > 0) {
      lines.push(`    related: ${m.related.map((r) => `${r.relation}:${r.unique_id}`).join(', ')}`);
    }
    lines.push(`    next: ${m.next_actions.join(', ')}`);
  }

  return lines.join('\n');
}

export async function discoverAction(
  query: string | undefined,
  options: DiscoverCliOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const q = typeof query === 'string' ? query.trim() : '';
    const hasCliFilter = Boolean(options.type ?? options.package ?? options.tag ?? options.path);
    if (!q && !hasCliFilter) {
      throw new Error(
        'Discover requires a query or at least one filter (e.g. dbt-tools discover "orders" or dbt-tools discover --type model "").',
      );
    }
    if (q) {
      validateNoControlChars(q);
    }

    const paths = await resolveCliArtifactPaths(extractArtifactRootCliOptions(options), {
      manifest: true,
      runResults: false,
    });
    validateSafePath(paths.manifest);

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);

    const limit =
      typeof options.limit === 'number' && Number.isFinite(options.limit) ? options.limit : 50;

    const output = discoverResources(graph, q, {
      limit,
      type: options.type,
      package: options.package,
      tag: options.tag,
      path: options.path,
    });

    const stdoutFormat = resolveStdoutFormat(options.format);
    const enriched = enrichDiscoverJson(output, {
      type: options.type,
      package: options.package,
      tag: options.tag,
      path: options.path,
      trace: options.trace,
    });

    if (stdoutFormat === 'json') {
      let out: unknown = enriched;
      if (options.fields) {
        out = FieldFilter.filterFields(
          enriched as unknown as Record<string, unknown>,
          options.fields,
        );
      }
      console.log(formatOutput(out, options.format));
    } else {
      let text = formatDiscoverHuman(output);
      if (enriched.web_url) {
        text += `\n\nOpen in web: ${enriched.web_url}`;
      }
      console.log(text);
    }
  } catch (error) {
    handleError(error, preferStructuredErrors(options.format));
  }
}
