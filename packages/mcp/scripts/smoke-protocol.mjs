#!/usr/bin/env node
/**
 * Stdio protocol smoke test for dbt-tools-mcp (RFC §18.3).
 */
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');
const serverEntry = path.join(packageRoot, 'dist/server.js');
const fixtureManifest = path.join(
  repoRoot,
  'packages/test-fixtures/dbt-artifacts-parser/resources/manifest/v12/jaffle_shop/manifest_1.10.json',
);
const fixtureRunResults = path.join(
  repoRoot,
  'packages/test-fixtures/dbt-artifacts-parser/resources/run_results/v6/jaffle_shop/run_results.json',
);

async function prepareArtifactDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-mcp-smoke-'));
  await fs.copyFile(fixtureManifest, path.join(dir, 'manifest.json'));
  await fs.copyFile(fixtureRunResults, path.join(dir, 'run_results.json'));
  return dir;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseToolContentText(result) {
  const block = result.content?.[0];
  assert(block?.type === 'text' && typeof block.text === 'string', 'expected text tool content');
  return block.text;
}

async function smokeNoTargetErrors(client) {
  const result = await client.callTool({
    name: 'dbt_tools_search_resources',
    arguments: { query: 'orders' },
  });
  assert(result.isError === true, 'search without target should return isError');
  const parsed = JSON.parse(parseToolContentText(result));
  assert(typeof parsed.error === 'string', 'tool error should include error field');
}

async function smokeGetResource(client) {
  const uniqueId = 'model.jaffle_shop.stg_orders';
  const found = await client.callTool({
    name: 'dbt_tools_get_resource',
    arguments: { uniqueId, includeCode: false },
  });
  assert(found.isError !== true, 'get_resource for known id should succeed');
  assert(found.structuredContent?.resource?.uniqueId === uniqueId, 'structuredContent envelope');
  const content = JSON.parse(parseToolContentText(found));
  assert(content.uniqueId === uniqueId, 'legacy content text is bare resource');

  const missing = await client.callTool({
    name: 'dbt_tools_get_resource',
    arguments: { uniqueId: 'model.jaffle_shop.__missing__' },
  });
  assert(missing.isError !== true, 'missing resource is success with null');
  assert(missing.structuredContent?.resource === null, 'structuredContent null envelope');
  assert(parseToolContentText(missing) === 'null', 'content text is JSON null');
}

async function main() {
  const targetDir = await prepareArtifactDir();

  const coldTransport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    cwd: packageRoot,
    stderr: 'pipe',
  });
  const coldClient = new Client({ name: 'smoke-mcp-protocol-cold', version: '1.0.0' });
  await coldClient.connect(coldTransport);
  assert(coldClient.getProtocolEra() === 'legacy', 'default client should negotiate legacy era');
  try {
    await smokeNoTargetErrors(coldClient);
  } finally {
    await coldClient.close();
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry, '--dbt-target', targetDir],
    cwd: packageRoot,
    stderr: 'pipe',
  });

  const client = new Client(
    { name: 'smoke-mcp-protocol', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  await client.connect(transport);
  assert(client.getProtocolEra() === 'modern', 'auto client should negotiate the 2026-07-28 era');

  try {
    const tools = await client.listTools();
    assert(tools.tools.length >= 10, 'expected at least ten tools');

    const resources = await client.listResources();
    const resourceUris = resources.resources.map((r) => r.uri);
    assert(resourceUris.includes('dbt-tools://status'), 'missing status resource');
    assert(
      resourceUris.includes('dbt-tools://runs/current/summary'),
      'missing run summary resource',
    );

    const templates = await client.listResourceTemplates();
    assert(templates.resourceTemplates.length >= 4, 'expected resource templates');

    const prompts = await client.listPrompts();
    assert(prompts.prompts.length >= 5, 'expected curated prompts');

    await client.callTool({ name: 'dbt_tools_set_target', arguments: { target: targetDir } });
    await client.callTool({ name: 'dbt_tools_status', arguments: {} });

    const statusResource = await client.readResource({ uri: 'dbt-tools://status' });
    assert(statusResource.contents.length > 0, 'status resource empty');

    const summaryResource = await client.readResource({
      uri: 'dbt-tools://runs/current/summary',
    });
    assert(summaryResource.contents.length > 0, 'run summary resource empty');

    const uniqueId = 'model.jaffle_shop.stg_orders';
    await client.readResource({ uri: `dbt-tools://resources/${encodeURIComponent(uniqueId)}` });

    await smokeGetResource(client);

    const prompt = await client.getPrompt({
      name: 'triage_dbt_run',
      arguments: { focus: 'failures', limit: '5' },
    });
    assert(prompt.messages.length > 0, 'triage prompt empty');

    console.log('smoke-protocol: ok (legacy + modern)');
  } finally {
    await client.close();
    await fs.rm(targetDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
