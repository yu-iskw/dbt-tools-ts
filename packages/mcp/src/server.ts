#!/usr/bin/env node
import { ArtifactWorkspace, createDbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpHelpRequested, helpText, parseMcpServerOptions } from './options.js';
import { readMcpPackageVersion } from './package-version.js';
import { createDbtToolsMcpToolHandlers } from './tools/toolHandlers.js';
import { registerDbtToolsTools } from './tools/registerTools.js';

type RefreshTimer = ReturnType<typeof setInterval>;

interface RefreshableWorkspace {
  refreshIfChanged(): Promise<unknown>;
}

export interface DbtToolsMcpCliIo {
  stdout: { write(chunk: string): boolean };
  stderr: { write(chunk: string): boolean };
}

export function startRefreshPolling(
  workspace: RefreshableWorkspace,
  pollIntervalMs: number | undefined,
): RefreshTimer | undefined {
  if (pollIntervalMs == null || pollIntervalMs <= 0) return undefined;

  const timer = setInterval(() => {
    void workspace.refreshIfChanged().catch(() => undefined);
  }, pollIntervalMs);
  timer.unref?.();
  return timer;
}

export async function createDbtToolsMcpServer(argv: string[] = process.argv.slice(2)) {
  const options = parseMcpServerOptions(argv);
  const workspace = new ArtifactWorkspace({ dbtTarget: options.dbtTarget });
  await workspace.initialize();
  startRefreshPolling(workspace, options.pollIntervalMs);
  const useCases = createDbtToolsUseCases(workspace);
  const handlers = createDbtToolsMcpToolHandlers(workspace, useCases);
  const server = new McpServer({
    name: 'dbt-tools',
    version: readMcpPackageVersion(),
  });
  registerDbtToolsTools(server, handlers);
  return server;
}

export async function runDbtToolsMcpCli(
  argv: string[] = process.argv.slice(2),
  io: DbtToolsMcpCliIo = { stdout: process.stdout, stderr: process.stderr },
): Promise<number> {
  try {
    const server = await createDbtToolsMcpServer(argv);
    await server.connect(new StdioServerTransport());
    return 0;
  } catch (error) {
    if (error instanceof McpHelpRequested) {
      io.stdout.write(`${helpText()}\n`);
      return 0;
    }
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDbtToolsMcpCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
