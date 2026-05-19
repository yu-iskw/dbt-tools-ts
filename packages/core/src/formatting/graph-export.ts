/**
 * Graph export helpers for JSON, DOT, and GEXF formats.
 * Used by the CLI graph command and other graph export consumers.
 */
import * as fs from 'fs';

import { FieldFilter } from './field-filter';

import type { GraphNodeAttributes, GraphEdgeAttributes } from '../types';
import type { DirectedGraph } from 'graphology';

export interface GraphExportOptions {
  format?: string;
  output?: string;
  fields?: string;
}

export function exportGraphToFormat(
  graph: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>,
  options: GraphExportOptions,
): string {
  const fmt = options.format?.toLowerCase();
  if (fmt === 'json') return exportGraphJson(graph, options);
  if (fmt === 'dot') return exportGraphDot(graph);
  if (fmt === 'gexf') return exportGraphGexf(graph);
  throw new Error(`Unsupported format: ${options.format}`);
}

function exportGraphJson(
  graph: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>,
  options: GraphExportOptions,
): string {
  const nodes: Array<{ id: string; attributes: unknown }> = [];
  const edges: Array<{ source: string; target: string; attributes: unknown }> = [];

  graph.forEachNode((nodeId: string, attributes: GraphNodeAttributes) => {
    let filteredAttrs: unknown = attributes;
    if (options.fields) {
      filteredAttrs = FieldFilter.filterFields(attributes, options.fields);
    }
    nodes.push({ id: nodeId, attributes: filteredAttrs });
  });

  graph.forEachEdge(
    (_edgeId: string, attributes: GraphEdgeAttributes, source: string, target: string) => {
      edges.push({ source, target, attributes });
    },
  );

  return JSON.stringify({ nodes, edges }, null, 2);
}

function exportGraphDot(graph: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>): string {
  const lines: string[] = ['digraph DbtGraph {'];
  lines.push('  compound=true;');
  lines.push('  node [shape=box, style=filled, fillcolor=white];');

  const resourceNodes: string[] = [];
  const fieldNodesByParent: Record<string, string[]> = {};

  graph.forEachNode((nodeId, attributes) => {
    if (attributes.resource_type === 'field') {
      const parentId = attributes.parent_id as string;
      if (!fieldNodesByParent[parentId]) {
        fieldNodesByParent[parentId] = [];
      }
      fieldNodesByParent[parentId].push(nodeId);
    } else {
      resourceNodes.push(nodeId);
    }
  });

  for (const nodeId of resourceNodes) {
    const attributes = graph.getNodeAttributes(nodeId);
    const name = (attributes.name as string) || nodeId;
    const fields = fieldNodesByParent[nodeId];

    if (fields && fields.length > 0) {
      lines.push(`  subgraph "cluster_${nodeId}" {`);
      lines.push(`    label = "${name}";`);
      lines.push('    style = filled;');
      lines.push('    fillcolor = lightgrey;');
      for (const fieldId of fields) {
        const fieldAttr = graph.getNodeAttributes(fieldId);
        lines.push(`    "${fieldId}" [label="${fieldAttr.name}", fillcolor=white];`);
      }
      lines.push('  }');
    } else {
      lines.push(`  "${nodeId}" [label="${name}"];`);
    }
  }

  graph.forEachEdge((_edgeId, attributes, source, target) => {
    if (attributes.dependency_type !== 'internal') {
      lines.push(`  "${source}" -> "${target}";`);
    }
  });
  lines.push('}');
  return lines.join('\n');
}

function exportGraphGexf(graph: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>): string {
  const nodes: Array<{ id: string; label: string }> = [];
  const edges: Array<{ source: string; target: string }> = [];

  graph.forEachNode((nodeId, attributes) => {
    nodes.push({
      id: nodeId,
      label: (attributes.name as string) || nodeId,
    });
  });

  graph.forEachEdge((_edgeId, _attributes, source, target) => {
    edges.push({ source, target });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">
  <graph mode="static" defaultedgetype="directed">
    <nodes>
${nodes.map((n) => `      <node id="${n.id}" label="${n.label}"/>`).join('\n')}
    </nodes>
    <edges>
${edges.map((e, i) => `      <edge id="${i}" source="${e.source}" target="${e.target}"/>`).join('\n')}
    </edges>
  </graph>
</gexf>`;
}

export function writeGraphOutput(output: string, outputPath?: string): void {
  if (outputPath) {
    fs.writeFileSync(outputPath, output, 'utf-8');
    console.log(`Graph exported to ${outputPath}`);
  } else {
    console.log(output);
  }
}
