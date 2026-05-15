/**
 * Diagnose intent — structured facade over run-report / timeline / deps primitives.
 */
import {
  ManifestGraph,
  loadManifest,
  validateSafePath,
  validateNoControlChars,
  preferStructuredErrors,
  resolveIntentTarget,
} from '@dbt-tools/core';
import {
  resolveCliArtifactPaths,
  extractArtifactRootCliOptions,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve';
import { emitActionOutput } from '../../internal/cli-output';

export type DiagnoseCliOptions = {
  fields?: string;
  format?: string;
} & ArtifactRootCliOptions;

export type DiagnoseOutput = {
  intent: 'diagnose';
  contract_version: number;
  mode: 'run' | 'node';
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
    await resolveCliArtifactPaths(extractArtifactRootCliOptions(options), {
      manifest: true,
      runResults: true,
    }).then((paths) => {
      validateSafePath(paths.manifest);
      if (paths.runResults) validateSafePath(paths.runResults);
    });

    const targetDir =
      options.dbtTarget != null && options.dbtTarget.trim() !== ''
        ? options.dbtTarget.trim()
        : '${DBT_TOOLS_DBT_TARGET}';
    const primitive_commands = [
      `dbt-tools run-report --dbt-target ${JSON.stringify(targetDir)}`,
      `dbt-tools timeline --dbt-target ${JSON.stringify(targetDir)}`,
    ];

    const output: DiagnoseOutput = {
      intent: 'diagnose',
      contract_version: CONTRACT_VERSION,
      mode: 'run',
      provenance: {
        steps: [{ op: 'diagnose.run.facade', status: 'ok' }],
      },
      next_actions: ['explain', 'impact'],
      primitive_commands,
    };

    emitActionOutput(output, options, () =>
      [
        'Diagnose (run): use execution primitives for failures and timing.',
        'Suggested commands:',
        ...primitive_commands.map((c) => `  ${c}`),
      ].join('\n'),
    );
  } catch (error) {
    handleError(error, preferStructuredErrors(options.format));
  }
}

export async function diagnoseNodeAction(
  resourceInput: string,
  options: DiagnoseCliOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    validateNoControlChars(resourceInput);
    const paths = await resolveCliArtifactPaths(extractArtifactRootCliOptions(options), {
      manifest: true,
      runResults: true,
    });
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
      `dbt-tools run-report --dbt-target ${JSON.stringify(targetDir)}`,
      `dbt-tools deps ${uid} --direction downstream --layout flat`,
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
      next_actions: ['impact', 'explain'],
      primitive_commands,
    };

    emitActionOutput(output, options, (o) =>
      [
        `Diagnose (node): ${o.target?.resolved_unique_id}`,
        'Suggested commands:',
        ...primitive_commands.map((c) => `  ${c}`),
      ].join('\n'),
    );
  } catch (error) {
    handleError(error, preferStructuredErrors(options.format));
  }
}
