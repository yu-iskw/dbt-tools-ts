import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/server';

import { readDbtToolsResource, type DbtToolsResourceContext } from './resource-handlers.js';

export function registerDbtToolsResources(server: McpServer, ctx: DbtToolsResourceContext): void {
  server.registerResource(
    'dbt-status',
    'dbt-tools://status',
    {
      title: 'dbt-tools workspace status',
      description: 'Active target, selected run, version token, freshness, and cache state.',
      mimeType: 'application/json',
    },
    async (uri) => readDbtToolsResource(ctx, uri.href),
  );

  server.registerResource(
    'dbt-run-summary-current',
    'dbt-tools://runs/current/summary',
    {
      title: 'Current run summary',
      description: 'Run-level summary for the active artifact snapshot.',
      mimeType: 'application/json',
    },
    async (uri) => readDbtToolsResource(ctx, uri.href),
  );

  server.registerResource(
    'dbt-resource-details',
    new ResourceTemplate('dbt-tools://resources/{uniqueId}', { list: undefined }),
    {
      title: 'dbt resource metadata',
      description: 'Metadata for one dbt resource (SQL omitted).',
      mimeType: 'application/json',
    },
    async (uri) => readDbtToolsResource(ctx, uri.href),
  );

  server.registerResource(
    'dbt-resource-sql-raw',
    new ResourceTemplate('dbt-tools://resources/{uniqueId}/sql/raw', { list: undefined }),
    {
      title: 'dbt resource raw SQL',
      description: 'Raw model SQL when available (bounded; may be truncated).',
      mimeType: 'text/sql',
    },
    async (uri) => readDbtToolsResource(ctx, uri.href),
  );

  server.registerResource(
    'dbt-resource-sql-compiled',
    new ResourceTemplate('dbt-tools://resources/{uniqueId}/sql/compiled', { list: undefined }),
    {
      title: 'dbt resource compiled SQL',
      description: 'Compiled SQL when available (bounded; may be truncated).',
      mimeType: 'text/sql',
    },
    async (uri) => readDbtToolsResource(ctx, uri.href),
  );

  server.registerResource(
    'dbt-resource-dependencies',
    new ResourceTemplate('dbt-tools://resources/{uniqueId}/dependencies/{direction}', {
      list: undefined,
    }),
    {
      title: 'dbt resource dependencies',
      description: 'Upstream or downstream dependency context for one resource.',
      mimeType: 'application/json',
    },
    async (uri) => readDbtToolsResource(ctx, uri.href),
  );
}
