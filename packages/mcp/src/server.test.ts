import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ArtifactWorkspace } from '@dbt-tools/core/artifact-workspace';
import { DBT_MANIFEST_JSON, DBT_RUN_RESULTS_JSON } from '@dbt-tools/core';
import type { DbtToolsMcpToolHandlers } from './tools/toolHandlers.js';
import { registerDbtToolsTools } from './tools/registerTools.js';
import { createDbtToolsMcpServer, runDbtToolsMcpCli, startRefreshPolling } from './server.js';

class RecordingMcpServer {
  readonly tools: Array<{ name: string; config: unknown; handler: unknown }> = [];

  registerTool(name: string, config: unknown, handler: unknown): void {
    this.tools.push({ name, config, handler });
  }
}

class RefreshingWorkspace {
  refreshCount = 0;

  async refreshIfChanged(): Promise<void> {
    this.refreshCount += 1;
  }
}

async function readFixtureJson(relativePath: string): Promise<Record<string, unknown>> {
  const fixtureUrl = new URL(`../../test-fixtures/${relativePath}`, import.meta.url);
  return JSON.parse(await fs.readFile(fixtureUrl, 'utf8')) as Record<string, unknown>;
}

async function writeArtifacts(dir: string): Promise<void> {
  const manifestJson = await readFixtureJson(
    'dbt-artifacts-parser/resources/manifest/v12/jaffle_shop/manifest_1.10.json',
  );
  const runResultsJson = await readFixtureJson(
    'dbt-artifacts-parser/resources/run_results/v6/jaffle_shop/run_results.json',
  );
  await fs.writeFile(path.join(dir, DBT_MANIFEST_JSON), JSON.stringify(manifestJson), 'utf8');
  await fs.writeFile(path.join(dir, DBT_RUN_RESULTS_JSON), JSON.stringify(runResultsJson), 'utf8');
}

describe('dbt-tools MCP server wiring', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-mcp-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it('registers the expected tool surface', () => {
    const server = new RecordingMcpServer();
    const handlers = {
      dbt_tools_status: async () => ({ content: [] }),
      dbt_tools_refresh: async () => ({ content: [] }),
      dbt_tools_list_runs: async () => ({ content: [] }),
      dbt_tools_select_run: async () => ({ content: [] }),
      dbt_tools_set_target: async () => ({ content: [] }),
      dbt_tools_search_resources: async () => ({ content: [] }),
      dbt_tools_get_resource: async () => ({ content: [] }),
      dbt_tools_lineage: async () => ({ content: [] }),
      dbt_tools_impact: async () => ({ content: [] }),
      dbt_tools_failures: async () => ({ content: [] }),
      dbt_tools_run_report: async () => ({ content: [] }),
    } satisfies DbtToolsMcpToolHandlers;

    registerDbtToolsTools(server as unknown as McpServer, handlers);

    expect(server.tools.map((tool) => tool.name)).toEqual([
      'dbt_tools_status',
      'dbt_tools_refresh',
      'dbt_tools_list_runs',
      'dbt_tools_select_run',
      'dbt_tools_set_target',
      'dbt_tools_search_resources',
      'dbt_tools_get_resource',
      'dbt_tools_lineage',
      'dbt_tools_impact',
      'dbt_tools_failures',
      'dbt_tools_run_report',
    ]);
  });

  it('does not eagerly initialize artifacts while constructing the MCP server', async () => {
    await writeArtifacts(tempDir);
    const spy = vi.spyOn(ArtifactWorkspace.prototype, 'initialize').mockResolvedValue(undefined);
    try {
      await createDbtToolsMcpServer(['--dbt-target', tempDir]);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('initializes a server from a real local artifact target', async () => {
    await writeArtifacts(tempDir);

    const server = await createDbtToolsMcpServer(['--dbt-target', tempDir]);

    expect(server).toBeInstanceOf(Object);
  });

  it('polls refreshes at the configured interval', async () => {
    vi.useFakeTimers();
    const workspace = new RefreshingWorkspace();

    const timer = startRefreshPolling(workspace, 1000);
    await vi.advanceTimersByTimeAsync(2500);
    if (timer != null) clearInterval(timer);

    expect(workspace.refreshCount).toBe(2);
  });

  it('prints help to stdout with a successful exit code', async () => {
    let stdout = '';
    let stderr = '';

    const exitCode = await runDbtToolsMcpCli(['--help'], {
      stdout: { write: (chunk) => ((stdout += String(chunk)), true) },
      stderr: { write: (chunk) => ((stderr += String(chunk)), true) },
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Usage: dbt-tools-mcp');
    expect(stdout).toContain('--gcs-project-id');
    expect(stderr).toBe('');
  });
});
