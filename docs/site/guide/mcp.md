# @dbt-tools/mcp

Long-lived **MCP server** (stdio) that keeps a dbt artifact run parsed in memory so agent clients can issue many small queries without reloading large manifests on every call.

## When to use MCP

Use `dbt-tools-mcp` when an MCP client (Cursor, Claude Desktop, etc.) needs **many queries** over the same artifact run—especially for large artifacts or remote S3/GCS targets where parse cost dominates.

## Quick start

```bash
npm install -g @dbt-tools/mcp
dbt-tools-mcp --dbt-target ./target
```

Configure your MCP client to launch `dbt-tools-mcp` with the same `--dbt-target` (or `DBT_TOOLS_DBT_TARGET`).

For remote client options and GCS impersonation, see [Configuration: Remote client flags](../reference/configuration.md#remote-client-flags).

```bash
dbt-tools-mcp \
  --dbt-target gs://my-bucket/dbt/prod/run \
  --gcs-impersonate-service-account svc@proj.iam.gserviceaccount.com
```

## Learn more

- Package README: [`packages/mcp/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/README.md)
- Remote artifacts: [ADR-0004](https://github.com/yu-iskw/dbt-tools-ts/blob/main/docs/adr/0004-remote-object-storage-artifact-sources-and-auto-reload.md)
