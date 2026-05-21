#!/usr/bin/env node
import { dbtToolsDebugLog } from '@dbt-tools/core';
import { ArtifactWorkspace, createDbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { isCliEntrypoint } from './entrypoint.js';
import {
  McpHelpRequested,
  McpVersionRequested,
  helpText,
  parseMcpServerOptions,
} from './options.js';
import { readMcpPackageVersion } from './package-version.js';
import { registerDbtToolsTools } from './tools/register-tools.js';
import { createDbtToolsMcpToolHandlers } from './tools/tool-handlers.js';

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

function remoteClientOverridesFromOptions(options: ReturnType<typeof parseMcpServerOptions>) {
  const { gcsProjectId, s3Region, s3Endpoint } = options;
  if (gcsProjectId == null && s3Region == null && s3Endpoint == null) {
    return undefined;
  }
  return {
    ...(gcsProjectId != null ? { projectId: gcsProjectId } : {}),
    ...(s3Region != null ? { region: s3Region } : {}),
    ...(s3Endpoint != null ? { endpoint: s3Endpoint } : {}),
  };
}

export interface DbtToolsMcpStack {
  server: McpServer;
  workspace: ArtifactWorkspace;
}

export async function createDbtToolsMcpStack(
  argv: string[] = process.argv.slice(2),
): Promise<DbtToolsMcpStack> {
  const options = parseMcpServerOptions(argv);
  const remoteClientOverrides = remoteClientOverridesFromOptions(options);
  const workspace = new ArtifactWorkspace({
    ...(options.dbtTarget != null ? { dbtTarget: options.dbtTarget } : {}),
    ...(options.gcsImpersonateServiceAccount != null
      ? { gcsRequestOptions: { impersonatedServiceAccount: options.gcsImpersonateServiceAccount } }
      : {}),
    ...(remoteClientOverrides != null ? { remoteClientOverrides } : {}),
  });
  dbtToolsDebugLog('lazy-init: artifacts load on first tool call');
  startRefreshPolling(workspace, options.pollIntervalMs);
  const useCases = createDbtToolsUseCases(workspace);
  const handlers = createDbtToolsMcpToolHandlers(workspace, useCases, options);
  const server = new McpServer({
    name: 'dbt-tools',
    version: readMcpPackageVersion(),
  });
  registerDbtToolsTools(server, handlers);
  return { server, workspace };
}

export async function createDbtToolsMcpServer(
  argv: string[] = process.argv.slice(2),
): Promise<McpServer> {
  const { server } = await createDbtToolsMcpStack(argv);
  return server;
}

export async function runDbtToolsMcpCli(
  argv: string[] = process.argv.slice(2),
  io: DbtToolsMcpCliIo = { stdout: process.stdout, stderr: process.stderr },
): Promise<number> {
  try {
    const server = await createDbtToolsMcpServer(argv);
    await server.connect(new StdioServerTransport());
    dbtToolsDebugLog('MCP stdio transport connected');
    return 0;
  } catch (error) {
    if (error instanceof McpHelpRequested) {
      io.stdout.write(`${helpText()}\n`);
      return 0;
    }
    if (error instanceof McpVersionRequested) {
      io.stdout.write(`${readMcpPackageVersion()}\n`);
      return 0;
    }
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (isCliEntrypoint(import.meta.url)) {
  runDbtToolsMcpCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
