/**
 * Resource types in dbt manifests
 */
export type DbtResourceType =
  | 'analysis'
  | 'exposure'
  | 'field'
  | 'function'
  | 'macro'
  | 'metric'
  | 'model'
  | 'seed'
  | 'semantic_model'
  | 'snapshot'
  | 'source'
  | 'test'
  | 'unit_test';

/**
 * Node attributes stored in the graph
 */
export interface GraphNodeAttributes {
  unique_id: string;
  resource_type: DbtResourceType;
  name: string;
  package_name: string;
  path?: string;
  original_file_path?: string;
  tags?: string[];
  description?: string;
  parent_id?: string;
  [key: string]: unknown;
}

/**
 * Edge attributes stored in the graph
 */
export interface GraphEdgeAttributes {
  dependency_type: 'field' | 'internal' | 'macro' | 'node' | 'source';
  [key: string]: unknown;
}

/**
 * Summary statistics about the graph
 */
export interface GraphSummary {
  total_nodes: number;
  nodes_by_type: Record<string, number>;
  total_edges: number;
  has_cycles: boolean;
}

/**
 * Version information extracted from a manifest
 */
export interface VersionInfo {
  schema_version: number | null;
  dbt_version: string | null;
  is_supported: boolean;
}
