/**
 * Shared types for run-results and warehouse execution search.
 * Kept separate from implementation to avoid circular imports between run-results and warehouse.
 */

export type WarehouseAdapterType =
  | 'athena'
  | 'bigquery'
  | 'postgres'
  | 'redshift'
  | 'snowflake'
  | 'spark';

export type CommonExecutionSort = 'execution_time_asc' | 'execution_time_desc' | 'unique_id';

/** Execution-level filters only (no warehouse-specific adapter mins or sorts). */
export interface RunResultsSearchCriteria {
  min_execution_time?: number;
  max_execution_time?: number;
  status?: string[] | string;
  unique_id_pattern?: RegExp | string;
  limit?: number;
  sort?: CommonExecutionSort;
  has_adapter_key?: string;
  adapter_text?: string;
}

export type WarehouseAdapterSort =
  | 'bytes_billed_desc'
  | 'bytes_processed_desc'
  | 'rows_affected_desc'
  | 'rows_deleted_desc'
  | 'rows_duplicated_desc'
  | 'rows_inserted_desc'
  | 'rows_updated_desc'
  | 'slot_ms_desc';

export type ExecutionSortKey = CommonExecutionSort | WarehouseAdapterSort;

export type AdapterHeavyMetric =
  | 'bytes_billed'
  | 'bytes_processed'
  | 'rows_affected'
  | 'rows_deleted'
  | 'rows_duplicated'
  | 'rows_inserted'
  | 'rows_updated'
  | 'slot_ms';

export interface BigQuerySearchCriteria {
  sort?: Extract<
    WarehouseAdapterSort,
    'bytes_billed_desc' | 'bytes_processed_desc' | 'rows_affected_desc' | 'slot_ms_desc'
  >;
  minSlotMs?: number;
  minBytesProcessed?: number;
  minBytesBilled?: number;
  minRowsAffected?: number;
}

export interface SnowflakeSearchCriteria {
  sort?: Extract<
    WarehouseAdapterSort,
    | 'bytes_processed_desc'
    | 'rows_affected_desc'
    | 'rows_deleted_desc'
    | 'rows_duplicated_desc'
    | 'rows_inserted_desc'
    | 'rows_updated_desc'
  >;
  minBytesProcessed?: number;
  minRowsAffected?: number;
  minRowsInserted?: number;
  minRowsUpdated?: number;
  minRowsDeleted?: number;
  minRowsDuplicated?: number;
}

export type AthenaSearchCriteria = BaseAdapterSearchCriteria;

export interface BaseAdapterSearchCriteria {
  sort?: Extract<WarehouseAdapterSort, 'bytes_processed_desc' | 'rows_affected_desc'>;
  minBytesProcessed?: number;
  minRowsAffected?: number;
}

export type WarehouseSearchBlock =
  | { adapter: 'athena'; criteria: AthenaSearchCriteria }
  | { adapter: 'bigquery'; criteria: BigQuerySearchCriteria }
  | { adapter: 'postgres'; criteria: BaseAdapterSearchCriteria }
  | { adapter: 'redshift'; criteria: BaseAdapterSearchCriteria }
  | { adapter: 'snowflake'; criteria: SnowflakeSearchCriteria }
  | { adapter: 'spark'; criteria: BaseAdapterSearchCriteria };

export interface QueryExecutionsCommon {
  resourceTypes?: string[];
  status?: string[] | string;
  limit?: number;
  offset?: number;
  uniqueIdPattern?: string;
  minExecutionTime?: number;
  maxExecutionTime?: number;
  sort?: CommonExecutionSort;
}

export interface QueryExecutionsRequest extends QueryExecutionsCommon {
  bigquery?: BigQuerySearchCriteria;
  snowflake?: SnowflakeSearchCriteria;
  athena?: AthenaSearchCriteria;
  postgres?: BaseAdapterSearchCriteria;
  redshift?: BaseAdapterSearchCriteria;
  spark?: BaseAdapterSearchCriteria;
}

export interface WarehouseExecutionProfile {
  adapterType: WarehouseAdapterType;
  allowedSorts: readonly WarehouseAdapterSort[];
  /** camelCase keys on warehouse criteria blocks (e.g. minSlotMs). */
  allowedMinFields: readonly string[];
}

/**
 * Single bottleneck node in the result
 */
export interface BottleneckNode {
  unique_id: string;
  name?: string;
  execution_time: number;
  rank: number;
  pct_of_total: number;
  status: string;
}

/**
 * Result of bottleneck detection
 */
export interface BottleneckResult {
  nodes: BottleneckNode[];
  total_execution_time: number;
  criteria_used: 'threshold' | 'top_n';
}
