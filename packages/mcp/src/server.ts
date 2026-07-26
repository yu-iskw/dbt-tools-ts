#!/usr/bin/env node
import {
  dbtToolsDebugLog,
  getDbtToolsCacheTtlMsFromEnv,
  getDbtToolsMaxCachedTargetsFromEnv,
} from '@dbt-tools/core';
import { ArtifactWorkspace, createDbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { isCliEntrypoint } from './entrypoint.js';
import {
  McpHelpRequested,
  McpVersionRequested,
  helpText,
  parseMcpServerOptions,
} from './options.js';
import { readMcpPackageVersion } from './package-version.js';
import { registerDbtToolsPrompts } from './prompts/register-prompts.js';
import { registerDbtToolsResources } from './resources/register-resources.js';
import { registerDbtToolsTools } from './tools/register-tools.js';
import { createDbtToolsMcpToolHandlers } from './tools/tool-handlers.js';

import type { DbtToolsMcpToolHandlers } from './tools/tool-handlers.js';
import type { ArtifactWorkspaceLoadOptions, DbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';

type RefreshTimer = ReturnType<typeof setInterval>;

interface RefreshableWorkspace {
  refreshIfChanged(options?: ArtifactWorkspaceLoadOptions): Promise<unknown>;
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
    void workspace.refreshIfChanged({ coldLoadIfUnloaded: false }).catch(() => undefined);
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

interface DbtToolsMcpRuntime {
  workspace: ArtifactWorkspace;
  useCases: DbtToolsUseCases;
  handlers: DbtToolsMcpToolHandlers;
}

function createDbtToolsMcpRuntime(argv: string[]): DbtToolsMcpRuntime {
  const options = parseMcpServerOptions(argv);
  const remoteClientOverrides = remoteClientOverridesFromOptions(options);
  const workspace = new ArtifactWorkspace({
    ...(options.dbtTarget != null ? { dbtTarget: options.dbtTarget } : {}),
    maxCachedTargets: options.maxCachedTargets ?? getDbtToolsMaxCachedTargetsFromEnv(),
    cacheTtlMs: options.cacheTtlMs ?? getDbtToolsCacheTtlMsFromEnv(),
    ...(options.gcsImpersonateServiceAccount != null
      ? { gcsRequestOptions: { impersonatedServiceAccount: options.gcsImpersonateServiceAccount } }
      : {}),
    ...(remoteClientOverrides != null ? { remoteClientOverrides } : {}),
  });
  dbtToolsDebugLog('lazy-init: artifacts load on first tool call');
  startRefreshPolling(workspace, options.pollIntervalMs);
  const useCases = createDbtToolsUseCases(workspace);
  const handlers = createDbtToolsMcpToolHandlers(workspace, useCases, options);
  return { workspace, useCases, handlers };
}

function createDbtToolsMcpServerFromRuntime(runtime: DbtToolsMcpRuntime): McpServer {
  const server = new McpServer({
    name: 'dbt-tools',
    version: readMcpPackageVersion(),
  });
  registerDbtToolsTools(server, runtime.handlers);
  registerDbtToolsResources(server, { workspace: runtime.workspace, useCases: runtime.useCases });
  registerDbtToolsPrompts(server);
  return server;
}

export interface DbtToolsMcpStack {
  server: McpServer;
  workspace: ArtifactWorkspace;
}

export async function createDbtToolsMcpStack(
  argv: string[] = process.argv.slice(2),
): Promise<DbtToolsMcpStack> {
  const runtime = createDbtToolsMcpRuntime(argv);
  return {
    server: createDbtToolsMcpServerFromRuntime(runtime),
    workspace: runtime.workspace,
  };
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
    const runtime = createDbtToolsMcpRuntime(argv);
    serveStdio(() => createDbtToolsMcpServerFromRuntime(runtime), {
      onerror: (error) => {
        io.stderr.write(`${error.message}\n`);
      },
    });
    dbtToolsDebugLog('MCP stdio server supports legacy and 2026-07-28 protocol eras');
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
