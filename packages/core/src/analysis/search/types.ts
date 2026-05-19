/**
 * Shared types for run-results and warehouse execution search.
 * Kept separate from implementation to avoid circular imports between run-results and warehouse.
 */

export type WarehouseAdapterType =
  | 'bigquery'
  | 'snowflake'
  | 'athena'
  | 'postgres'
  | 'redshift'
  | 'spark';

export type CommonExecutionSort = 'execution_time_desc' | 'execution_time_asc' | 'unique_id';

/** Execution-level filters only (no warehouse-specific adapter mins or sorts). */
export interface RunResultsSearchCriteria {
  min_execution_time?: number;
  max_execution_time?: number;
  status?: string | string[];
  unique_id_pattern?: string | RegExp;
  limit?: number;
  sort?: CommonExecutionSort;
  has_adapter_key?: string;
  adapter_text?: string;
}

export type WarehouseAdapterSort =
  | 'bytes_processed_desc'
  | 'bytes_billed_desc'
  | 'slot_ms_desc'
  | 'rows_affected_desc'
  | 'rows_inserted_desc'
  | 'rows_updated_desc'
  | 'rows_deleted_desc'
  | 'rows_duplicated_desc';

export type ExecutionSortKey = CommonExecutionSort | WarehouseAdapterSort;

export type AdapterHeavyMetric =
  | 'bytes_processed'
  | 'bytes_billed'
  | 'slot_ms'
  | 'rows_affected'
  | 'rows_inserted'
  | 'rows_updated'
  | 'rows_deleted'
  | 'rows_duplicated';

export interface BigQuerySearchCriteria {
  sort?: Extract<
    WarehouseAdapterSort,
    'slot_ms_desc' | 'bytes_processed_desc' | 'bytes_billed_desc' | 'rows_affected_desc'
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
    | 'rows_inserted_desc'
    | 'rows_updated_desc'
    | 'rows_deleted_desc'
    | 'rows_duplicated_desc'
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
  | { adapter: 'bigquery'; criteria: BigQuerySearchCriteria }
  | { adapter: 'snowflake'; criteria: SnowflakeSearchCriteria }
  | { adapter: 'athena'; criteria: AthenaSearchCriteria }
  | { adapter: 'postgres'; criteria: BaseAdapterSearchCriteria }
  | { adapter: 'redshift'; criteria: BaseAdapterSearchCriteria }
  | { adapter: 'spark'; criteria: BaseAdapterSearchCriteria };

export interface QueryExecutionsCommon {
  resourceTypes?: string[];
  status?: string | string[];
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
  criteria_used: 'top_n' | 'threshold';
}
