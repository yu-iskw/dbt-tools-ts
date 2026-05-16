// Analysis exports
export * from './analysis/adapter-response-metrics';
export * from './analysis/adapter-metric-descriptors';
export * from './analysis/manifest-graph';
export * from './analysis/execution-analyzer';
export * from './analysis/dependency-service';
export * from './analysis/sql-analyzer';
export * from './analysis/run-results-search';
export * from './analysis/analysis-snapshot';

// Config exports (Node; not re-exported from browser entry)
export {
  assertGcsImpersonationPrincipalAllowed,
  getDbtToolsTargetDirFromEnv,
  getDbtToolsDbtTargetFromEnv,
  getDbtToolsGcsImpersonationAllowlistFromEnv,
  getDbtToolsGcsImpersonationAllowedSuffixesFromEnv,
  getDbtToolsReloadDebounceMs,
  getDbtToolsRemoteSourceConfigFromEnv,
  getDbtToolsWebBaseUrlFromEnv,
  parseDbtToolsRemoteSourceConfigJson,
  isDbtToolsDebugEnabled,
  isDbtToolsWatchEnabled,
} from './config/dbt-tools-env';
export type {
  DbtToolsRemoteSourceConfig,
  DbtToolsRemoteSourceProvider,
} from './config/dbt-tools-env';

// I/O exports
export * from './io/artifact-filenames';
export * from './io/artifact-loader';
export * from './io/artifact-discovery';
export * from './io/artifact-location';
export * from './io/dbt-artifact-bundle';

// Long-lived artifact workspace (Node-safe)
export * from './artifact-workspace/index';

// Validation exports
export * from './validation/input-validator';

// Formatting exports
export * from './formatting/output-formatter';
export * from './formatting/field-filter';
export * from './formatting/graph-export';

// Error handling exports
export * from './errors/artifact-bundle-resolution-error';
export * from './errors/error-handler';

// Introspection exports
export * from './introspection/schema-generator';

// Discovery (artifact-grounded ranking; browser-safe)
export * from './discovery';

// Intent helpers (target resolution; Node-safe)
export * from './intent';

// Shared types and utilities
export * from './types';
export * from './version';
