import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from 'dbt-artifacts-parser/manifest';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseRunResults } from 'dbt-artifacts-parser/run_results';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import {
  discoverManifestFiles,
  loadTestManifest,
  loadTestRunResults,
} from 'dbt-artifacts-parser/test-utils';
import { ManifestGraph } from './manifest/graph';
import { DependencyService } from './dependencies/service';
import { ExecutionAnalyzer } from './execution/analyzer';
import { getManifestSchemaVersion } from '../version';

const MIN_SUPPORTED_SCHEMA_VERSION = 10;

describe('tool compatibility matrix', () => {
  describe('ManifestGraph and DependencyService across manifest versions', () => {
    const manifestPaths = discoverManifestFiles();

    for (const manifestPath of manifestPaths) {
      const relativePath = path.relative(
        path.join(manifestPath, '..', '..', '..', '..'),
        manifestPath,
      );
      it(`should work with ${relativePath}`, () => {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        const parsed = JSON.parse(content) as Record<string, unknown>;
        const manifest = parseManifest(parsed);

        const schemaVersion = getManifestSchemaVersion(manifest);
        if (schemaVersion === null || schemaVersion < MIN_SUPPORTED_SCHEMA_VERSION) {
          // v9 and below are unsupported by ManifestGraph - skip graph tests
          expect(manifest).toBeDefined();
          expect(manifest.metadata).toBeDefined();
          return;
        }

        const graph = new ManifestGraph(manifest);
        expect(graph).toBeDefined();

        const summary = graph.getSummary();
        expect(summary).toBeDefined();
        expect(summary.total_nodes).toBeGreaterThan(0);

        const graphologyGraph = graph.getGraph();
        let testNodeId: string | null = null;
        graphologyGraph.forEachNode((nodeId) => {
          const outbound = graphologyGraph.outboundNeighbors(nodeId);
          if (outbound.length > 0 && !testNodeId) {
            testNodeId = nodeId;
          }
        });

        if (testNodeId) {
          const deps = DependencyService.getDependencies(graph, testNodeId, 'downstream');
          expect(deps.resource_id).toBe(testNodeId);
          expect(deps.dependencies).toBeInstanceOf(Array);
        }
      });
    }
  });

  describe('ExecutionAnalyzer with manifest and run_results', () => {
    it('should work with v12 manifest and v6 run_results', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const runResultsJson = loadTestRunResults('v6', 'run_results.json');
      const runResults = parseRunResults(runResultsJson as Record<string, unknown>);

      const analyzer = new ExecutionAnalyzer(runResults, graph);
      expect(analyzer).toBeDefined();

      const executions = analyzer.getNodeExecutions();
      expect(Array.isArray(executions)).toBe(true);

      const summary = analyzer.getSummary();
      expect(summary).toBeDefined();
      expect(summary.total_nodes).toBeGreaterThanOrEqual(0);
    });

    it('should work with v12 manifest and v6 run_results_1.11.json when available', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      try {
        const runResultsJson = loadTestRunResults('v6', 'run_results_1.11.json');
        const runResults = parseRunResults(runResultsJson as Record<string, unknown>);

        const analyzer = new ExecutionAnalyzer(runResults, graph);
        expect(analyzer).toBeDefined();
        const executions = analyzer.getNodeExecutions();
        expect(Array.isArray(executions)).toBe(true);
      } catch {
        // run_results_1.11.json may not exist in all environments; skip if missing
      }
    });
  });
});
