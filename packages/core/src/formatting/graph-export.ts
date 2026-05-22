/**
 * Graph export helpers for JSON, DOT, and GEXF formats.
 * Used by the CLI graph command and other graph export consumers.
 */
import { writeValidatedUtf8Sync } from '../io/safe-fs';
import { pushToMapList } from '../util/typed-map';

import { FieldFilter } from './field-filter';

import type { GraphNodeAttributes, GraphEdgeAttributes } from '../types';
import type { DirectedGraph } from 'graphology';

/** Escape a string for use inside DOT double-quoted identifiers/labels. */
export function escapeDotString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/** Escape a string for use inside XML/GEXF double-quoted attributes. */
export function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
  const fieldNodesByParent = new Map<string, string[]>();

  graph.forEachNode((nodeId, attributes) => {
    if (attributes.resource_type === 'field') {
      const parentId = attributes.parent_id as string;
      pushToMapList(fieldNodesByParent, parentId, nodeId);
    } else {
      resourceNodes.push(nodeId);
    }
  });

  for (const nodeId of resourceNodes) {
    const attributes = graph.getNodeAttributes(nodeId);
    const name = (attributes.name as string) || nodeId;
    const fields = fieldNodesByParent.get(nodeId);

    if (fields && fields.length > 0) {
      lines.push(`  subgraph "cluster_${escapeDotString(nodeId)}" {`);
      lines.push(`    label = "${escapeDotString(name)}";`);
      lines.push('    style = filled;');
      lines.push('    fillcolor = lightgrey;');
      for (const fieldId of fields) {
        const fieldAttr = graph.getNodeAttributes(fieldId);
        const fieldLabel =
          typeof fieldAttr.name === 'string' ? fieldAttr.name : String(fieldAttr.name ?? fieldId);
        lines.push(
          `    "${escapeDotString(fieldId)}" [label="${escapeDotString(fieldLabel)}", fillcolor=white];`,
        );
      }
      lines.push('  }');
    } else {
      lines.push(
        `  "${escapeDotString(nodeId)}" [label="${escapeDotString(name)}"];`,
      );
    }
  }

  graph.forEachEdge((_edgeId, attributes, source, target) => {
    if (attributes.dependency_type !== 'internal') {
      lines.push(
        `  "${escapeDotString(source)}" -> "${escapeDotString(target)}";`,
      );
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
${nodes.map((n) => `      <node id="${escapeXmlAttribute(n.id)}" label="${escapeXmlAttribute(n.label)}"/>`).join('\n')}
    </nodes>
    <edges>
${edges.map((e, i) => `      <edge id="${i}" source="${escapeXmlAttribute(e.source)}" target="${escapeXmlAttribute(e.target)}"/>`).join('\n')}
    </edges>
  </graph>
</gexf>`;
}

/**
 * Write graph export to a file when `outputPath` is set.
 * Callers should print `output` to stdout when no path is provided (library-safe: no stdout).
 */
export function writeGraphOutput(output: string, outputPath?: string): void {
  if (outputPath) {
    writeValidatedUtf8Sync(outputPath, output);
  }
}
