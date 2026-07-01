import {
  buildAnalysisSnapshotFromParsedArtifacts,
  formatOutput,
  FieldFilter,
  getRunSummaryFromSnapshot,
  readValidatedUtf8,
  shouldOutputJSON,
  validateSafePath,
} from '@dbt-tools/core';
import { parseManifest } from 'dbt-artifacts-parser/manifest';
import { parseRunResults } from 'dbt-artifacts-parser/run_results';

import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve.js';

export type RunSummaryOptions = ArtifactRootCliOptions & {
  fields?: string;
  json?: boolean;
  noJson?: boolean;
};

async function readArtifactJson(path: string): Promise<Record<string, unknown>> {
  const text = await readValidatedUtf8(path);
  return JSON.parse(text) as Record<string, unknown>;
}

function formatRunSummaryHuman(output: ReturnType<typeof getRunSummaryFromSnapshot>): string {
  const lines: string[] = [];
  lines.push('dbt-tools run-summary');
  lines.push('====================');
  lines.push(`Total execution time: ${output.summary.total_execution_time}s`);
  lines.push(`Total nodes: ${output.summary.total_nodes}`);
  lines.push(`Warehouse: ${output.warehouse_type}`);
  if (output.bottlenecks?.nodes?.length) {
    lines.push('');
    lines.push('Top bottlenecks (execution time):');
    for (const node of output.bottlenecks.nodes.slice(0, 5)) {
      lines.push(`  ${node.unique_id}  ${node.execution_time}s  (${node.pct_of_total}%)`);
    }
  }
  return lines.join('\n');
}

export async function runSummaryAction(
  options: RunSummaryOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const paths = await resolveCliArtifactPaths(
      { dbtTarget: options.dbtTarget },
      { manifest: true, runResults: true },
    );
    validateSafePath(paths.runResults);
    validateSafePath(paths.manifest);

    const [manifestJson, runResultsJson] = await Promise.all([
      readArtifactJson(paths.manifest),
      readArtifactJson(paths.runResults),
    ]);
    const { analysis } = buildAnalysisSnapshotFromParsedArtifacts(
      manifestJson,
      runResultsJson,
      parseManifest(manifestJson),
      parseRunResults(runResultsJson),
    );
    const output = getRunSummaryFromSnapshot(analysis);

    const useJson = shouldOutputJSON(options.json, options.noJson);
    if (useJson) {
      let payload: unknown = output;
      if (options.fields) {
        payload = FieldFilter.filterFields(output, options.fields);
      }
      console.log(formatOutput(payload, true));
    } else {
      console.log(formatRunSummaryHuman(output));
    }
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
