/**
 * Impact intent — upstream/downstream counts and notable dependents.
 */
import {
  ManifestGraph,
  loadManifest,
  validateSafePath,
  validateNoControlChars,
  preferStructuredErrors,
  DependencyService,
  resolveIntentTarget,
  buildImpactWebUrl,
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

export type ImpactCliOptions = {
  fields?: string;
  format?: string;
  trace?: boolean;
} & ArtifactRootCliOptions;

export type ImpactOutput = {
  intent: 'impact';
  contract_version: number;
  target: {
    input: string;
    resolved_unique_id: string;
  };
  impact: {
    upstream_count: number;
    downstream_count: number;
    critical_dependents: string[];
  };
  why_it_matters: string[];
  provenance: { steps: Array<{ op: string; status: 'ok' | 'error' }> };
  next_actions: string[];
  primitive_commands: string[];
  web_url?: string;
  review_url?: string;
  investigation_transcript?: InvestigationTranscript;
};

const CONTRACT_VERSION = 1;

function downstreamModelFanout(
  graph: ManifestGraph,
  downstreamIds: string[],
): Array<{ unique_id: string; fanout: number }> {
  const g = graph.getGraph();
  const rows: Array<{ unique_id: string; fanout: number }> = [];
  for (const id of downstreamIds) {
    if (!g.hasNode(id)) continue;
    const attrs = g.getNodeAttributes(id) as GraphNodeAttributes;
    if (attrs.resource_type !== 'model') continue;
    rows.push({
      unique_id: id,
      fanout: g.outboundNeighbors(id).length,
    });
  }
  rows.sort((a, b) => b.fanout - a.fanout);
  return rows;
}

export async function impactAction(
  resourceInput: string,
  options: ImpactCliOptions,
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
    const steps: ImpactOutput['provenance']['steps'] = [];

    const resolved = resolveIntentTarget(graph, resourceInput);
    steps.push({ op: 'discover.resolve', status: 'ok' });

    const up = DependencyService.getDependencies(
      graph,
      resolved.unique_id,
      'upstream',
      undefined,
      undefined,
      'flat',
    );
    const down = DependencyService.getDependencies(
      graph,
      resolved.unique_id,
      'downstream',
      undefined,
      undefined,
      'flat',
    );
    steps.push({ op: 'deps.fetch', status: 'ok' });

    const downstreamIds = down.dependencies.map((d) => d.unique_id);
    const ranked = downstreamModelFanout(graph, downstreamIds);
    const critical = ranked.slice(0, 8).map((r) => r.unique_id);

    const why_it_matters: string[] = [];
    if (down.count >= 12) {
      why_it_matters.push('high downstream fanout');
    }
    if (critical.length > 0) {
      why_it_matters.push(
        `notable downstream models by immediate fanout: ${critical.slice(0, 3).join(', ')}`,
      );
    }
    if (why_it_matters.length === 0) {
      why_it_matters.push('localized dependency neighborhood');
    }

    const uidJson = JSON.stringify(resolved.unique_id);
    const primitive_commands = [
      `dbt-tools deps ${uidJson} --direction downstream --layout flat`,
      `dbt-tools deps ${uidJson} --direction upstream --layout flat`,
      `dbt-tools graph --focus ${uidJson} --focus-direction downstream`,
    ];

    const output: ImpactOutput = {
      intent: 'impact',
      contract_version: CONTRACT_VERSION,
      target: {
        input: resourceInput.trim(),
        resolved_unique_id: resolved.unique_id,
      },
      impact: {
        upstream_count: up.count,
        downstream_count: down.count,
        critical_dependents: critical,
      },
      why_it_matters,
      provenance: { steps },
      next_actions: ['explain', 'diagnose'],
      primitive_commands,
    };

    const base = getDbtToolsWebBaseUrlFromEnv();
    if (base) {
      output.web_url = buildImpactWebUrl(base, resolved.unique_id);
      output.review_url = output.web_url;
    }
    if (options.trace) {
      output.investigation_transcript = {
        intent: 'impact',
        input: resourceInput.trim(),
        steps: steps.map((s) => ({ op: s.op, status: s.status })),
      };
    }

    emitActionOutput(output, options, (o) =>
      [
        `Resource: ${o.target.resolved_unique_id}`,
        `Upstream: ${o.impact.upstream_count}  Downstream: ${o.impact.downstream_count}`,
        `Critical dependents (models by fanout): ${o.impact.critical_dependents.join(', ') || '(none)'}`,
        `Why it matters: ${o.why_it_matters.join('; ')}`,
        `Next: ${o.next_actions.join(', ')}`,
        o.web_url ? `Open in web: ${o.web_url}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  } catch (error) {
    handleError(error, preferStructuredErrors(options.format));
  }
}
