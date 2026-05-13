/**
 * Export intent — normalized envelope over graph export primitives.
 */
import * as fs from 'node:fs';
import {
  ManifestGraph,
  loadManifest,
  validateSafePath,
  FieldFilter,
  formatOutput,
  shouldOutputJSON,
  validateResourceId,
  validateDepth,
  exportGraphToFormat,
  writeGraphOutput,
} from '@dbt-tools/core';
import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve';

export type ExportCliOptions = {
  format?: string;
  output?: string;
  focus?: string;
  focusDepth?: number;
  focusDirection?: string;
  fields?: string;
  json?: boolean;
  noJson?: boolean;
} & ArtifactRootCliOptions;

export type ExportOutput = {
  intent: 'export';
  contract_version: number;
  format: string;
  output_path?: string;
  graph_export_bytes: number;
  provenance: { steps: Array<{ op: string; status: 'ok' }> };
  primitive_commands: string[];
  /** Full graph export string (dot/gexf/json text). Omitted when extremely large if needed later. */
  graph_export?: string;
};

const CONTRACT_VERSION = 1;

export async function exportAction(
  options: ExportCliOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const paths = await resolveCliArtifactPaths(
      { dbtTarget: options.dbtTarget },
      { manifest: true, runResults: false },
    );
    validateSafePath(paths.manifest);
    if (options.output) {
      validateSafePath(options.output);
    }

    const format = (options.format ?? 'json').toLowerCase();
    if (!['json', 'dot', 'gexf'].includes(format)) {
      throw new Error(`Unsupported --format for export: ${options.format}`);
    }

    const focusDirection = (options.focusDirection ?? 'both').toLowerCase();
    if (!['upstream', 'downstream', 'both'].includes(focusDirection)) {
      throw new Error(`--focus-direction must be upstream, downstream, or both`);
    }

    if (options.focusDepth !== undefined) {
      validateDepth(options.focusDepth);
    }

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);

    let targetGraph = graph.getGraph();

    if (options.focus) {
      validateResourceId(options.focus);
      targetGraph = graph.buildSubgraph(
        options.focus,
        focusDirection as 'upstream' | 'downstream' | 'both',
        options.focusDepth,
        undefined,
      );
    }

    const body = exportGraphToFormat(targetGraph, {
      format,
      output: options.output,
      fields: options.fields,
    });

    const primitive_commands = [
      `dbt-tools graph --dbt-target <target> --format ${format}${
        options.focus ? ` --focus ${JSON.stringify(options.focus)}` : ''
      }${options.output ? ` --output ${JSON.stringify(options.output)}` : ''}`,
    ];

    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      if (options.output) {
        fs.writeFileSync(options.output, body, 'utf-8');
      }
      const meta: ExportOutput = {
        intent: 'export',
        contract_version: CONTRACT_VERSION,
        format,
        ...(options.output ? { output_path: options.output } : {}),
        graph_export_bytes: Buffer.byteLength(body, 'utf8'),
        graph_export: body,
        provenance: { steps: [{ op: 'graph.export', status: 'ok' }] },
        primitive_commands,
      };
      let out: unknown = meta;
      if (options.fields) {
        out = FieldFilter.filterFields(meta as unknown as Record<string, unknown>, options.fields);
      }
      console.log(formatOutput(out, true));
      return;
    }

    writeGraphOutput(body, options.output);
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
