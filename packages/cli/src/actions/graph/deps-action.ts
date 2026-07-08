/**
 * Deps command action handler.
 */
import {
  ManifestGraph,
  loadManifest,
  loadCatalog,
  validateSafePath,
  validateResourceId,
  validateDepth,
  DependencyService,
  SQLAnalyzer,
  sqlDialectFromDbtAdapterType,
  formatOutput,
  formatDeps,
  shouldOutputJSON,
} from '@dbt-tools/core';

import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve';
import { createCliUseCaseRunner } from '../../internal/cli-use-case-runner';

import type { DependencyQueryOutputContract } from '@dbt-tools/core/contracts';
import type { ParsedManifest } from 'dbt-artifacts-parser/manifest';

type DepsOptions = ArtifactRootCliOptions & {
  direction?: string;
  fields?: string;
  field?: string;
  depth?: number;
  format?: string;
  buildOrder?: boolean;
  json?: boolean;
  noJson?: boolean;
};

/** Add field-level lineage to graph and return targetId */
function addFieldLevelLineage(
  manifest: ParsedManifest,
  graph: ManifestGraph,
  paths: { catalog?: string },
  resourceId: string,
  fieldName: string,
): string {
  if (!paths.catalog) {
    console.warn(
      'Warning: --field requires catalog.json, but it was not found. Falling back to resource-level lineage.',
    );
    return resourceId;
  }

  try {
    validateSafePath(paths.catalog);
    const catalog = loadCatalog(paths.catalog);
    graph.addFieldNodes(catalog);

    const analyzer = new SQLAnalyzer();
    const adapterType = (manifest.metadata as { adapter_type?: string } | undefined)?.adapter_type;
    const sqlDialect = sqlDialectFromDbtAdapterType(adapterType);

    const nodes = manifest.nodes;
    if (nodes) {
      for (const [uniqueId, node] of Object.entries(nodes)) {
        const compiledCode = node.compiled_code;
        if (typeof compiledCode === 'string') {
          const fieldDeps = analyzer.analyze(compiledCode, sqlDialect);
          graph.addFieldEdges(uniqueId, fieldDeps);
        }
      }
    }

    return `${resourceId}#${fieldName}`;
  } catch {
    console.warn(
      'Warning: --field requires catalog.json, but it was not found. Falling back to resource-level lineage.',
    );
    return resourceId;
  }
}

/**
 * Deps action handler
 */
export async function depsAction(
  resourceId: string,
  options: DepsOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    validateResourceId(resourceId);

    const direction = options.direction?.toLowerCase();
    if (direction !== 'upstream' && direction !== 'downstream') {
      throw new Error(
        `Invalid direction: ${options.direction}. Must be 'upstream' or 'downstream'`,
      );
    }

    validateDepth(options.depth);

    const format = (options.format ?? 'tree').toLowerCase();
    if (format !== 'flat' && format !== 'tree') {
      throw new Error(`Invalid format: ${options.format}. Must be 'flat' or 'tree'`);
    }

    if (options.buildOrder && direction !== 'upstream') {
      throw new Error(`--build-order is only valid with --direction upstream`);
    }

    if (format === 'flat' && !options.field && !options.fields) {
      const runner = await createCliUseCaseRunner({ dbtTarget: options.dbtTarget });
      const result = await runner.runUseCase<DependencyQueryOutputContract>(
        'resource.dependencies',
        {
          uniqueId: resourceId,
          direction,
          depth: options.depth,
          buildOrder: options.buildOrder,
        },
      );
      const useJson = shouldOutputJSON(options.json, options.noJson);
      if (useJson) {
        console.log(formatOutput(result, true));
      } else {
        console.log(formatDeps(result, format));
      }
      return;
    }

    const paths = await resolveCliArtifactPaths(
      {
        dbtTarget: options.dbtTarget,
      },
      { manifest: true, runResults: false },
    );

    validateSafePath(paths.manifest);

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);

    let targetId = resourceId;
    if (options.field) {
      targetId = addFieldLevelLineage(manifest, graph, paths, resourceId, options.field);
    }

    const result = DependencyService.getDependencies(
      graph,
      targetId,
      direction as 'downstream' | 'upstream',
      options.fields,
      options.depth,
      format as 'flat' | 'tree',
      options.buildOrder,
    );

    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      console.log(formatOutput(result, true));
    } else {
      console.log(formatDeps(result, format));
    }
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
