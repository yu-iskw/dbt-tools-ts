import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  mkdtempValidated,
  readValidatedUtf8,
  resolveJoinedSafe,
  rmValidated,
  writeValidatedUtf8,
} from '@dbt-tools/core';
import { createDbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createDbtToolsMcpServer,
  createDbtToolsMcpStack,
  runDbtToolsMcpCli,
  startRefreshPolling,
} from './server.js';
import { registerDbtToolsTools } from './tools/register-tools.js';
import { createDbtToolsMcpToolHandlers } from './tools/tool-handlers.js';

import type { DbtToolsMcpToolHandlers } from './tools/tool-handlers.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

class RecordingMcpServer {
  readonly tools: Array<{ name: string; config: unknown; handler: unknown }> = [];

  registerTool(name: string, config: unknown, handler: unknown): void {
    this.tools.push({ name, config, handler });
  }

  registerResource(): void {
    // no-op for wiring tests
  }

  registerPrompt(): void {
    // no-op for wiring tests
  }
}

class RefreshingWorkspace {
  refreshCount = 0;

  async refreshIfChanged(): Promise<void> {
    this.refreshCount += 1;
  }
}

async function readFixtureJson(relativePath: string): Promise<Record<string, unknown>> {
  const fixturePath = fileURLToPath(
    new URL(`../../test-fixtures/${relativePath}`, import.meta.url),
  );
  return JSON.parse(await readValidatedUtf8(fixturePath)) as Record<string, unknown>;
}

async function writeArtifacts(dir: string): Promise<void> {
  const manifestJson = await readFixtureJson(
    'dbt-artifacts-parser/resources/manifest/v12/jaffle_shop/manifest_1.10.json',
  );
  const runResultsJson = await readFixtureJson(
    'dbt-artifacts-parser/resources/run_results/v6/jaffle_shop/run_results.json',
  );
  await writeValidatedUtf8(resolveJoinedSafe(dir, DBT_MANIFEST_JSON), JSON.stringify(manifestJson));
  await writeValidatedUtf8(
    resolveJoinedSafe(dir, DBT_RUN_RESULTS_JSON),
    JSON.stringify(runResultsJson),
  );
}

describe('dbt-tools MCP server wiring', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-mcp-'));
  });

  afterEach(async () => {
    await rmValidated(tempDir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it('registers the expected tool surface', () => {
    const server = new RecordingMcpServer();
    const handlers = {
      dbt_tools_status: async () => ({ content: [] }),
      dbt_tools_set_target: async () => ({ content: [] }),
      dbt_tools_unset_target: async () => ({ content: [] }),
      dbt_tools_clear_cached_targets: async () => ({ content: [] }),
      dbt_tools_refresh: async () => ({ content: [] }),
      dbt_tools_search_resources: async () => ({ content: [] }),
      dbt_tools_get_resource: async () => ({ content: [] }),
      dbt_tools_query_dependencies: async () => ({ content: [] }),
      dbt_tools_query_executions: async () => ({ content: [] }),
      dbt_tools_get_run_summary: async () => ({ content: [] }),
    } satisfies DbtToolsMcpToolHandlers;

    registerDbtToolsTools(server as unknown as McpServer, handlers);

    for (const tool of server.tools) {
      const config = tool.config as { outputSchema?: unknown };
      expect(config.outputSchema, `${tool.name} should publish outputSchema`).toBeDefined();
    }

    expect(server.tools.map((tool) => tool.name)).toEqual([
      'dbt_tools_status',
      'dbt_tools_set_target',
      'dbt_tools_unset_target',
      'dbt_tools_clear_cached_targets',
      'dbt_tools_refresh',
      'dbt_tools_search_resources',
      'dbt_tools_get_resource',
      'dbt_tools_query_dependencies',
      'dbt_tools_query_executions',
      'dbt_tools_get_run_summary',
    ]);
  });

  it('creates a server from a real local artifact target', async () => {
    await writeArtifacts(tempDir);

    const server = await createDbtToolsMcpServer(['--dbt-target', tempDir]);

    expect(server).toBeInstanceOf(Object);
  });

  it('loads artifacts after set_target when no startup target is configured', async () => {
    await writeArtifacts(tempDir);

    const { workspace } = await createDbtToolsMcpStack([]);
    const statusBefore = await workspace.getStatus();
    expect(statusBefore.target).toBeNull();
    expect(statusBefore.loadedAtMs).toBeNull();

    const useCases = createDbtToolsUseCases(workspace);
    const handlers = createDbtToolsMcpToolHandlers(workspace, useCases);
    const setResult = await handlers.dbt_tools_set_target({ target: tempDir });
    expect(setResult.isError).not.toBe(true);

    await handlers.dbt_tools_search_resources({ query: 'orders' });

    const statusAfter = await workspace.getStatus();
    expect(statusAfter.target).toBe(tempDir);
    expect(statusAfter.loadedAtMs).not.toBeNull();
  });

  it('returns null JSON for unknown get_resource after load', async () => {
    await writeArtifacts(tempDir);

    const { workspace } = await createDbtToolsMcpStack(['--dbt-target', tempDir]);
    const useCases = createDbtToolsUseCases(workspace);
    const handlers = createDbtToolsMcpToolHandlers(workspace, useCases);
    await handlers.dbt_tools_search_resources({ query: 'orders' });

    const result = await handlers.dbt_tools_get_resource({
      uniqueId: 'model.jaffle_shop.does_not_exist',
    });
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(result.content[0]!.text)).toBeNull();
  });

  it('defers artifact load until a tool needs the workspace (lazy init)', async () => {
    await writeArtifacts(tempDir);

    const { workspace } = await createDbtToolsMcpStack(['--dbt-target', tempDir]);
    const statusBefore = await workspace.getStatus();
    expect(statusBefore.loadedAtMs).toBeNull();

    const useCases = createDbtToolsUseCases(workspace);
    const handlers = createDbtToolsMcpToolHandlers(workspace, useCases);
    await handlers.dbt_tools_search_resources({ query: 'orders' });

    const statusAfter = await workspace.getStatus();
    expect(statusAfter.loadedAtMs).not.toBeNull();
  });

  it('logs lazy-init guidance when DBT_TOOLS_DEBUG=1', async () => {
    await writeArtifacts(tempDir);
    const prev = process.env.DBT_TOOLS_DEBUG;
    process.env.DBT_TOOLS_DEBUG = '1';
    let stderr = '';
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: Uint8Array | string) => {
      stderr += String(chunk);
      return originalWrite(chunk);
    }) as typeof process.stderr.write;

    try {
      await createDbtToolsMcpStack(['--dbt-target', tempDir]);
      expect(stderr).toContain('lazy-init');
    } finally {
      process.stderr.write = originalWrite;
      if (prev === undefined) delete process.env.DBT_TOOLS_DEBUG;
      else process.env.DBT_TOOLS_DEBUG = prev;
    }
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
    expect(stderr).toBe('');
  });
});
