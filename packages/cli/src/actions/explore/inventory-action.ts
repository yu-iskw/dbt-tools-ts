/**
 * Inventory CLI action handler – list and filter dbt resources from manifest.
 */
import {
  ManifestGraph,
  loadManifest,
  validateSafePath,
  FieldFilter,
  formatOutput,
  shouldOutputJSON,
  type GraphNodeAttributes,
} from '@dbt-tools/core';

import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve';
import { applyListPaging } from '../../internal/cli-pagination';

export type InventoryOptions = ArtifactRootCliOptions & {
  type?: string;
  package?: string;
  tag?: string;
  path?: string;
  fields?: string;
  limit?: number;
  offset?: number;
  json?: boolean;
  noJson?: boolean;
};

export type InventoryEntry = {
  unique_id: string;
  resource_type: string;
  name: string;
  package_name: string;
  path?: string;
  tags?: string[];
  description?: string;
};

export type InventoryResult = {
  /** Count of resources matching filters (before paging). */
  total: number;
  entries: InventoryEntry[];
  limit?: number;
  offset?: number;
  has_more?: boolean;
};

function matchesFilters(attrs: GraphNodeAttributes, options: InventoryOptions): boolean {
  // Exclude internal field graph nodes
  if (attrs.resource_type === 'field') return false;

  if (options.type) {
    const types = options.type
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (!types.includes(attrs.resource_type.toLowerCase())) return false;
  }

  if (options.package) {
    if ((attrs.package_name || '') !== options.package) return false;
  }

  if (options.tag) {
    const requiredTags = options.tag
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const nodeTags = ((attrs.tags as string[] | undefined) || []).map((t) => t.toLowerCase());
    if (!requiredTags.some((t) => nodeTags.includes(t))) return false;
  }

  if (options.path) {
    const nodePath = (attrs.path as string | undefined) || '';
    if (!nodePath.includes(options.path)) return false;
  }

  return true;
}

/**
 * Format inventory as a human-readable table.
 */
export function formatInventory(result: InventoryResult): string {
  const lines: string[] = [];
  lines.push('dbt Inventory');
  lines.push('=============');
  lines.push(`Total resources: ${result.total}`);
  if (result.limit !== undefined) {
    lines.push(
      `Page: limit=${result.limit} offset=${result.offset ?? 0} has_more=${String(result.has_more ?? false)}`,
    );
  }

  if (result.entries.length === 0) {
    lines.push('(no matching resources)');
    return lines.join('\n');
  }

  // Group by resource type
  const byType: Record<string, InventoryEntry[]> = {};
  for (const entry of result.entries) {
    const rt = entry.resource_type;
    if (!byType[rt]) byType[rt] = [];
    byType[rt].push(entry);
  }

  for (const [type, entries] of Object.entries(byType)) {
    lines.push(`\n${type} (${entries.length}):`);
    for (const e of entries) {
      const tags = e.tags?.length ? `  [${e.tags.join(', ')}]` : '';
      const pkg = e.package_name ? ` (${e.package_name})` : '';
      lines.push(`  - ${e.name}${pkg}${tags}`);
      lines.push(`      ${e.unique_id}`);
    }
  }

  return lines.join('\n');
}

/**
 * Inventory action handler
 */
export async function inventoryAction(
  options: InventoryOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const paths = await resolveCliArtifactPaths(
      {
        dbtTarget: options.dbtTarget,
      },
      { manifest: true, runResults: false },
    );
    validateSafePath(paths.manifest);

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);
    const g = graph.getGraph();

    const entries: InventoryEntry[] = [];
    g.forEachNode((_nodeId, attrs) => {
      if (!matchesFilters(attrs, options)) return;
      entries.push({
        unique_id: attrs.unique_id,
        resource_type: attrs.resource_type,
        name: attrs.name,
        package_name: attrs.package_name,
        path: attrs.path as string | undefined,
        tags: attrs.tags as string[] | undefined,
        description: attrs.description as string | undefined,
      });
    });

    // Stable sort: resource_type asc, then name asc
    entries.sort((a, b) => {
      const rtCmp = a.resource_type.localeCompare(b.resource_type);
      if (rtCmp !== 0) return rtCmp;
      return a.name.localeCompare(b.name);
    });

    const { page, matchedTotal, offset, limit, hasMore } = applyListPaging(
      entries,
      options.limit,
      options.offset,
    );

    const result: InventoryResult = {
      total: matchedTotal,
      entries: page,
      ...(limit !== undefined ? { limit, offset, has_more: hasMore } : {}),
    };

    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      let output: unknown = result;
      if (options.fields) {
        output = FieldFilter.filterFields(result, options.fields);
      }
      console.log(formatOutput(output, true));
    } else {
      console.log(formatInventory(result));
    }
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
