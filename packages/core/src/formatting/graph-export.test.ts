// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from 'dbt-artifacts-parser/manifest';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { loadTestManifest } from 'dbt-artifacts-parser/test-utils';
import { describe, it, expect, vi } from 'vitest';

import { ManifestGraph } from '../analysis/manifest/graph';

import {
  escapeDotString,
  escapeXmlAttribute,
  exportGraphToFormat,
  writeGraphOutput,
} from './graph-export';

describe('graph-export', () => {
  function createTestGraph() {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graphBuilder = new ManifestGraph(manifest);
    return graphBuilder.getGraph();
  }

  describe('exportGraphToFormat', () => {
    it('exports JSON format with nodes and edges', () => {
      const graph = createTestGraph();
      const output = exportGraphToFormat(graph, { format: 'json' });
      const parsed = JSON.parse(output) as {
        nodes: unknown[];
        edges: unknown[];
      };
      expect(parsed).toHaveProperty('nodes');
      expect(parsed).toHaveProperty('edges');
      expect(Array.isArray(parsed.nodes)).toBe(true);
      expect(Array.isArray(parsed.edges)).toBe(true);
      expect(parsed.nodes.length).toBeGreaterThan(0);
    });

    it('exports DOT format with digraph DbtGraph', () => {
      const graph = createTestGraph();
      const output = exportGraphToFormat(graph, { format: 'dot' });
      expect(output).toContain('digraph DbtGraph {');
      expect(output).toContain('compound=true;');
      expect(output).toContain('node [shape=box');
    });

    it('escapes quotes in DOT labels', () => {
      const graph = createTestGraph();
      const nodeId = 'model.test."weird"';
      if (!graph.hasNode(nodeId)) {
        graph.addNode(nodeId, {
          resource_type: 'model',
          name: 'Say "hi"',
          package_name: 'test',
        });
      }
      const output = exportGraphToFormat(graph, { format: 'dot' });
      expect(output).toContain('Say \\"hi\\"');
      expect(output).toContain('model.test.\\"weird\\"');
    });

    it('escapes XML entities in GEXF attributes', () => {
      expect(escapeXmlAttribute('a&b"c')).toBe('a&amp;b&quot;c');
      expect(escapeDotString('line\nbreak')).toBe('line\\nbreak');
    });

    it('exports GEXF format with XML root', () => {
      const graph = createTestGraph();
      const output = exportGraphToFormat(graph, { format: 'gexf' });
      expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(output).toContain('<gexf');
      expect(output).toContain('xmlns="http://www.gexf.net/1.2draft"');
      expect(output).toContain('<graph ');
    });

    it('throws for unsupported format', () => {
      const graph = createTestGraph();
      expect(() => exportGraphToFormat(graph, { format: 'invalid' })).toThrow(
        /Unsupported format: invalid/,
      );
    });

    it('filters node attributes when fields option is provided', () => {
      const graph = createTestGraph();
      const output = exportGraphToFormat(graph, {
        format: 'json',
        fields: 'unique_id,name',
      });
      const parsed = JSON.parse(output) as {
        nodes: Array<{ attributes: Record<string, unknown> }>;
      };
      expect(parsed.nodes.length).toBeGreaterThan(0);
      const firstNode = parsed.nodes[0];
      if (firstNode.attributes && typeof firstNode.attributes === 'object') {
        const keys = Object.keys(firstNode.attributes);
        expect(keys.every((k) => ['unique_id', 'name'].includes(k))).toBe(true);
      }
    });
  });

  describe('writeGraphOutput', () => {
    it('does not write to stdout when no outputPath is provided', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      writeGraphOutput('test graph output');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });
  });
});
