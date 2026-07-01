/**
 * Diagnose intent — structured facade over runSummary, query-executions, timeline, and deps.
 */
import {
  ManifestGraph,
  loadManifest,
  validateSafePath,
  validateNoControlChars,
  FieldFilter,
  formatOutput,
  shouldOutputJSON,
  resolveIntentTarget,
} from '@dbt-tools/core';

import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve.js';

export type DiagnoseCliOptions = ArtifactRootCliOptions & {
  fields?: string;
  json?: boolean;
  noJson?: boolean;
};

export type DiagnoseOutput = {
  intent: 'diagnose';
  contract_version: number;
  mode: 'node' | 'run';
  target?: { input: string; resolved_unique_id: string };
  provenance: { steps: Array<{ op: string; status: 'ok' }> };
  next_actions: string[];
  primitive_commands: string[];
};

const CONTRACT_VERSION = 1;

export async function diagnoseRunAction(
  options: DiagnoseCliOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const paths = await resolveCliArtifactPaths(
      { dbtTarget: options.dbtTarget },
      { manifest: true, runResults: true },
    );
    validateSafePath(paths.manifest);
    if (paths.runResults) validateSafePath(paths.runResults);
    void paths;

    const targetDir =
      options.dbtTarget != null && options.dbtTarget.trim() !== ''
        ? options.dbtTarget.trim()
        : '${DBT_TOOLS_DBT_TARGET}';
    const primitive_commands = [
      `dbt-tools run-summary --dbt-target ${JSON.stringify(targetDir)} --json`,
      `dbt-tools query-executions --dbt-target ${JSON.stringify(targetDir)} --status error,fail,skipped --limit 50 --json`,
      `dbt-tools timeline --dbt-target ${JSON.stringify(targetDir)} --format json`,
    ];

    const output: DiagnoseOutput = {
      intent: 'diagnose',
      contract_version: CONTRACT_VERSION,
      mode: 'run',
      provenance: {
        steps: [{ op: 'diagnose.run.facade', status: 'ok' }],
      },
      next_actions: ['explain', 'deps'],
      primitive_commands,
    };

    const useJson = shouldOutputJSON(options.json, options.noJson);
    if (useJson) {
      let out: unknown = output;
      if (options.fields) {
        out = FieldFilter.filterFields(
          output as unknown as Record<string, unknown>,
          options.fields,
        );
      }
      console.log(formatOutput(out, true));
    } else {
      console.log(
        [
          'Diagnose (run): use execution primitives for failures and timing.',
          'Suggested commands:',
          ...primitive_commands.map((c) => `  ${c}`),
        ].join('\n'),
      );
    }
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}

export async function diagnoseNodeAction(
  resourceInput: string,
  options: DiagnoseCliOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    validateNoControlChars(resourceInput);
    const paths = await resolveCliArtifactPaths(
      { dbtTarget: options.dbtTarget },
      { manifest: true, runResults: true },
    );
    validateSafePath(paths.manifest);
    if (paths.runResults) validateSafePath(paths.runResults);

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);
    const resolved = resolveIntentTarget(graph, resourceInput);

    const targetDir =
      options.dbtTarget != null && options.dbtTarget.trim() !== ''
        ? options.dbtTarget.trim()
        : '${DBT_TOOLS_DBT_TARGET}';
    const uid = JSON.stringify(resolved.unique_id);
    const primitive_commands = [
      `dbt-tools run-summary --dbt-target ${JSON.stringify(targetDir)} --json`,
      `dbt-tools query-executions --dbt-target ${JSON.stringify(targetDir)} --status error,fail,skipped --limit 50 --json`,
      `dbt-tools deps ${uid} --direction downstream --format flat`,
      `dbt-tools explain ${uid}`,
    ];

    const output: DiagnoseOutput = {
      intent: 'diagnose',
      contract_version: CONTRACT_VERSION,
      mode: 'node',
      target: {
        input: resourceInput.trim(),
        resolved_unique_id: resolved.unique_id,
      },
      provenance: {
        steps: [
          { op: 'discover.resolve', status: 'ok' },
          { op: 'diagnose.node.facade', status: 'ok' },
        ],
      },
      next_actions: ['deps', 'explain'],
      primitive_commands,
    };

    const useJson = shouldOutputJSON(options.json, options.noJson);
    if (useJson) {
      let out: unknown = output;
      if (options.fields) {
        out = FieldFilter.filterFields(
          output as unknown as Record<string, unknown>,
          options.fields,
        );
      }
      console.log(formatOutput(out, true));
    } else {
      console.log(
        [
          `Diagnose (node): ${output.target?.resolved_unique_id}`,
          'Suggested commands:',
          ...primitive_commands.map((c) => `  ${c}`),
        ].join('\n'),
      );
    }
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
