import { ArtifactTargetNotConfiguredError } from '@dbt-tools/core';

export const MCP_TARGET_NOT_CONFIGURED_HINT =
  'Call dbt_tools_set_target with a local path or s3:// / gs:// URI, or set DBT_TOOLS_DBT_TARGET at MCP startup.';

export const MCP_TARGET_NOT_CONFIGURED_MESSAGE = `${ArtifactTargetNotConfiguredError.message} ${MCP_TARGET_NOT_CONFIGURED_HINT}`;
