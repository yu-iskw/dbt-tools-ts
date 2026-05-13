/**
 * Resource types in dbt manifests
 */
export type DbtResourceType =
  | 'model'
  | 'source'
  | 'seed'
  | 'snapshot'
  | 'test'
  | 'analysis'
  | 'macro'
  | 'exposure'
  | 'metric'
  | 'semantic_model'
  | 'unit_test'
  | 'field'
  | 'function';

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
  dependency_type: 'node' | 'macro' | 'source' | 'field' | 'internal';
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
