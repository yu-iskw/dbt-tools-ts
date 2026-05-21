// Analysis exports
export * from './analysis/adapter/metrics';
export * from './analysis/adapter/descriptors';
export * from './analysis/manifest/graph';
export * from './analysis/manifest/sql-analyzer';
export * from './analysis/execution/analyzer';
export * from './analysis/dependencies/service';
export * from './analysis/search/run-results';
export * from './analysis/search/warehouse';
export * from './analysis/search/types';
export * from './analysis/dependencies/query';
export * from './analysis/snapshot/run-summary';
export * from './analysis/snapshot';

// Config exports (Node; not re-exported from browser entry)
export {
  getDbtToolsTargetDirFromEnv,
  getDbtToolsDbtTargetFromEnv,
  getDbtToolsReloadDebounceMs,
  getDbtToolsRemoteClientEnvFromEnv,
  getDbtToolsWebBaseUrlFromEnv,
  isDbtToolsDebugEnabled,
  isDbtToolsWatchEnabled,
} from './config/dbt-tools-env';
export {
  applyEntrypointRemoteOptionsToEnv,
  assertRemoteFlagsMatchTarget,
  entrypointRemoteHelpLines,
  normalizeEntrypointRemoteOptions,
  parseEntrypointRemoteArgv,
  resolveEntrypointDbtTarget,
  resolveEntrypointRemoteOptions,
} from './config/entrypoint-options';
export type {
  EntrypointRemoteClientFlagOptions,
  EntrypointRemoteOptions,
} from './config/entrypoint-options';
export {
  dbtToolsDebugLog,
  dbtToolsDebugLogPhase,
  dbtToolsDebugNow,
} from './debug/dbt-tools-debug-log';
export type {
  DbtToolsRemoteClientEnv,
  DbtToolsRemoteSourceConfig,
  DbtToolsRemoteSourceProvider,
} from './config/dbt-tools-env';

// I/O exports
export * from './io/artifact-filenames';
export * from './io/artifact-loader';
export * from './io/artifact-discovery';
export * from './io/artifact-location';
export * from './io/dbt-artifact-bundle';
export * from './io/safe-fs';

// Utilities (Map lookups, timing-safe compare)
export * from './util/typed-map';
export * from './util/timing-safe';

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
export * from './errors/artifact-target-not-configured-error';
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
