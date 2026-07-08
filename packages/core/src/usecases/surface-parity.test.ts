import { describe, expect, it } from 'vitest';

import { MCP_ANALYSIS_TOOL_NAMES, USE_CASE_REGISTRY } from './registry.js';

const WORKSPACE_CONTROL_TOOLS = new Set([
  'dbt_tools_status',
  'dbt_tools_set_target',
  'dbt_tools_unset_target',
  'dbt_tools_clear_cached_targets',
  'dbt_tools_refresh',
]);

describe('surface parity', () => {
  it('maps every registry analysis use case to an MCP tool name', () => {
    for (const useCase of USE_CASE_REGISTRY) {
      expect(MCP_ANALYSIS_TOOL_NAMES[useCase.name]).toMatch(/^dbt_tools_/);
    }
    expect(Object.keys(MCP_ANALYSIS_TOOL_NAMES)).toHaveLength(USE_CASE_REGISTRY.length);
  });

  it('MCP analysis tool names do not overlap workspace-control tools', () => {
    for (const toolName of Object.values(MCP_ANALYSIS_TOOL_NAMES)) {
      expect(WORKSPACE_CONTROL_TOOLS.has(toolName)).toBe(false);
    }
  });

  it('registry includes CLI-backed operations', () => {
    const names = new Set(USE_CASE_REGISTRY.map((entry) => entry.name));
    expect(names.has('resource.search')).toBe(true);
    expect(names.has('resource.dependencies')).toBe(true);
    expect(names.has('runs.query')).toBe(true);
    expect(names.has('runs.summary')).toBe(true);
  });
});
