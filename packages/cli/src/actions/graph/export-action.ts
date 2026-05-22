/**
 * Export intent — normalized envelope over graph export primitives.
 */
import {
  ManifestGraph,
  loadManifest,
  validateSafePath,
  writeValidatedUtf8Sync,
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

export type ExportCliOptions = ArtifactRootCliOptions & {
  format?: string;
  output?: string;
  focus?: string;
  focusDepth?: number;
  focusDirection?: string;
  fields?: string;
  json?: boolean;
  noJson?: boolean;
};

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
/** Omit embedded graph body in JSON when larger than this (512 KiB). */
const EXPORT_GRAPH_JSON_MAX_BYTES = 512 * 1024;

function normalizeExportFormat(format: string | undefined): string {
  const normalized = (format ?? 'json').toLowerCase();
  if (!['json', 'dot', 'gexf'].includes(normalized)) {
    throw new Error(`Unsupported --format for export: ${format}`);
  }
  return normalized;
}

function normalizeFocusDirection(
  direction: string | undefined,
): 'both' | 'downstream' | 'upstream' {
  const normalized = (direction ?? 'both').toLowerCase();
  if (!['upstream', 'downstream', 'both'].includes(normalized)) {
    throw new Error(`--focus-direction must be upstream, downstream, or both`);
  }
  return normalized as 'both' | 'downstream' | 'upstream';
}

function buildExportPrimitiveCommands(format: string, options: ExportCliOptions): string[] {
  return [
    `dbt-tools graph --dbt-target <target> --format ${format}${
      options.focus ? ` --focus ${JSON.stringify(options.focus)}` : ''
    }${options.output ? ` --output ${JSON.stringify(options.output)}` : ''}`,
  ];
}

function buildExportOutputMeta(
  format: string,
  body: string,
  options: ExportCliOptions,
  primitive_commands: string[],
): ExportOutput {
  const graphExportBytes = Buffer.byteLength(body, 'utf8');
  return {
    intent: 'export',
    contract_version: CONTRACT_VERSION,
    format,
    ...(options.output ? { output_path: options.output } : {}),
    graph_export_bytes: graphExportBytes,
    ...(graphExportBytes <= EXPORT_GRAPH_JSON_MAX_BYTES ? { graph_export: body } : {}),
    provenance: { steps: [{ op: 'graph.export', status: 'ok' }] },
    primitive_commands,
  };
}

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

    const format = normalizeExportFormat(options.format);
    const focusDirection = normalizeFocusDirection(options.focusDirection);
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
        focusDirection,
        options.focusDepth,
        undefined,
      );
    }

    const body = exportGraphToFormat(targetGraph, {
      format,
      output: options.output,
      fields: options.fields,
    });
    const primitive_commands = buildExportPrimitiveCommands(format, options);
    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      if (options.output) {
        writeValidatedUtf8Sync(options.output, body);
      }
      const meta = buildExportOutputMeta(format, body, options, primitive_commands);
      const out = options.fields
        ? FieldFilter.filterFields(meta as unknown as Record<string, unknown>, options.fields)
        : meta;
      console.log(formatOutput(out, true));
      return;
    }

    if (options.output) {
      writeGraphOutput(body, options.output);
    } else {
      console.log(body);
    }
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
