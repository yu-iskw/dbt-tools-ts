/**
 * Explain intent — summary metadata for a manifest resource.
 */
import {
  ManifestGraph,
  loadManifest,
  validateSafePath,
  validateNoControlChars,
  preferStructuredErrors,
  resolveIntentTarget,
  buildExplainWebUrl,
  getDbtToolsWebBaseUrlFromEnv,
  type GraphNodeAttributes,
  type InvestigationTranscript,
} from '@dbt-tools/core';
import {
  resolveCliArtifactPaths,
  extractArtifactRootCliOptions,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve';
import { emitActionOutput } from '../../internal/cli-output';

export type ExplainCliOptions = {
  fields?: string;
  format?: string;
  trace?: boolean;
} & ArtifactRootCliOptions;

export type ExplainProvenanceStep = {
  op: string;
  status: 'ok' | 'error';
  detail?: string;
};

export type ExplainOutput = {
  intent: 'explain';
  contract_version: number;
  target: {
    input: string;
    resolved_unique_id: string;
  };
  summary: {
    resource_type: string;
    description: string | null;
    tags: string[];
    owners: string[];
    materialization: string | null;
    package_name: string;
    name: string;
    path?: string;
  };
  why_it_matched: string[];
  provenance: { steps: ExplainProvenanceStep[] };
  next_actions: string[];
  primitive_commands: string[];
  web_url?: string;
  review_url?: string;
  investigation_transcript?: InvestigationTranscript;
};

const CONTRACT_VERSION = 1;

function buildPrimitiveCommands(uniqueId: string): string[] {
  const q = JSON.stringify(uniqueId);
  return [
    `dbt-tools discover ${JSON.stringify(uniqueId.split('.').pop() ?? uniqueId)}`,
    `dbt-tools deps ${q} --direction downstream`,
    `dbt-tools search ${q}`,
  ];
}

function explainSummaryFromAttrs(attrs: GraphNodeAttributes): ExplainOutput['summary'] {
  const materialized =
    typeof (attrs as { materialized?: string }).materialized === 'string'
      ? (attrs as { materialized?: string }).materialized!
      : null;
  return {
    resource_type: attrs.resource_type,
    description: typeof attrs.description === 'string' ? attrs.description : null,
    tags: Array.isArray(attrs.tags)
      ? (attrs.tags as string[]).filter((t) => typeof t === 'string')
      : [],
    owners: [],
    materialization: materialized,
    package_name: attrs.package_name,
    name: attrs.name,
    path: typeof attrs.path === 'string' ? attrs.path : undefined,
  };
}

function attachExplainWebAndTrace(
  output: ExplainOutput,
  resolvedUniqueId: string,
  resourceInput: string,
  steps: ExplainProvenanceStep[],
  trace: boolean | undefined,
): void {
  const base = getDbtToolsWebBaseUrlFromEnv();
  if (base) {
    output.web_url = buildExplainWebUrl(base, resolvedUniqueId);
    output.review_url = output.web_url;
  }
  if (trace) {
    output.investigation_transcript = {
      intent: 'explain',
      input: resourceInput.trim(),
      steps: steps.map((s) => ({
        op: s.op,
        status: s.status,
        ...(s.detail !== undefined ? { detail: s.detail } : {}),
      })),
    };
  }
}

function formatExplainHumanText(output: ExplainOutput): string {
  const lines = [
    `Resource: ${output.target.resolved_unique_id}`,
    `Type: ${output.summary.resource_type}  Package: ${output.summary.package_name}`,
    output.summary.materialization ? `Materialization: ${output.summary.materialization}` : null,
    output.summary.description ? `Description: ${output.summary.description}` : null,
    output.summary.tags.length ? `Tags: ${output.summary.tags.join(', ')}` : null,
    `Why matched: ${output.why_it_matched.join(', ')}`,
    `Next: ${output.next_actions.join(', ')}`,
    output.web_url ? `Open in web: ${output.web_url}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

export async function explainAction(
  resourceInput: string,
  options: ExplainCliOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    validateNoControlChars(resourceInput);
    const paths = await resolveCliArtifactPaths(extractArtifactRootCliOptions(options), {
      manifest: true,
      runResults: false,
    });
    validateSafePath(paths.manifest);

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);
    const steps: ExplainProvenanceStep[] = [];

    const resolved = resolveIntentTarget(graph, resourceInput);
    steps.push({ op: 'discover.resolve', status: 'ok' });

    const g = graph.getGraph();
    const attrs = g.getNodeAttributes(resolved.unique_id) as GraphNodeAttributes;
    const summary = explainSummaryFromAttrs(attrs);
    steps.push({ op: 'summary.fetch', status: 'ok' });

    const output: ExplainOutput = {
      intent: 'explain',
      contract_version: CONTRACT_VERSION,
      target: {
        input: resourceInput.trim(),
        resolved_unique_id: resolved.unique_id,
      },
      summary,
      why_it_matched: [...resolved.why_it_matched],
      provenance: { steps },
      next_actions: ['impact', 'diagnose'],
      primitive_commands: buildPrimitiveCommands(resolved.unique_id),
    };

    attachExplainWebAndTrace(output, resolved.unique_id, resourceInput, steps, options.trace);

    emitActionOutput(output, options, formatExplainHumanText);
  } catch (error) {
    handleError(error, preferStructuredErrors(options.format));
  }
}
