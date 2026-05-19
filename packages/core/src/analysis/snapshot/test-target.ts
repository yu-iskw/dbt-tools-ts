import { inferResourceTypeFromId } from './shared';

import type { GraphLike } from './internal';

function readColumnPart(manifestEntry: Record<string, unknown>): string | null {
  const raw = manifestEntry.column_name;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  return raw.trim();
}

function modelNameFromAttachedNode(
  manifestEntry: Record<string, unknown>,
  graph: GraphLike,
): string | null {
  const attached = manifestEntry.attached_node;
  if (typeof attached !== 'string') return null;
  const g = graph.getGraph();
  if (!g.hasNode(attached)) return null;
  const attrs = g.getNodeAttributes(attached);
  if (attrs == null || typeof attrs.name !== 'string' || attrs.name === '') {
    return null;
  }
  return attrs.name;
}

function modelNameFromDependsOn(
  manifestEntry: Record<string, unknown>,
  graph: GraphLike,
): string | null {
  const dependsOn = manifestEntry.depends_on as { nodes?: unknown } | undefined;
  if (!Array.isArray(dependsOn?.nodes)) return null;
  const g = graph.getGraph();

  for (const id of dependsOn.nodes) {
    if (typeof id !== 'string') continue;
    if (!g.hasNode(id)) continue;
    const attrs = g.getNodeAttributes(id);
    const rt = String(attrs?.resource_type ?? inferResourceTypeFromId(id));
    if (rt === 'test' || rt === 'unit_test') continue;
    if (attrs != null && typeof attrs.name === 'string' && attrs.name !== '') {
      return attrs.name;
    }
  }
  return null;
}

/**
 * Short label for what a data test exercises (table/model and column when known),
 * from manifest `attached_node`, `depends_on`, and `column_name`.
 */
export function buildTestAttachedTargetDisplay(
  manifestEntry: Record<string, unknown> | undefined,
  graph: GraphLike,
): string | null {
  if (manifestEntry == null) return null;

  const columnPart = readColumnPart(manifestEntry);
  const modelName =
    modelNameFromAttachedNode(manifestEntry, graph) ?? modelNameFromDependsOn(manifestEntry, graph);

  if (modelName != null && columnPart != null) {
    return `${modelName}.${columnPart}`;
  }
  if (modelName != null) return modelName;
  if (columnPart != null) return columnPart;
  return null;
}
