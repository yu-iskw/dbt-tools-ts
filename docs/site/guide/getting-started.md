# Getting Started

dbt-tools provides TypeScript packages and command-line tools for analyzing dbt artifacts.

## Prerequisites

- A dbt project
- dbt-generated artifacts such as `manifest.json` and `run_results.json`
- Node.js 20+ (see the repository [`.node-version`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.node-version) for the version used in development)

## Install and run

```bash
npx @dbt-tools/cli status --dbt-target ./target
npx @dbt-tools/mcp --dbt-target ./target
npx @dbt-tools/web --target ./target
```

Set `DBT_TOOLS_DBT_TARGET` (CLI/MCP) or point `--dbt-target` / `--target` at your dbt `target/` directory.

Remote S3/GCS and GCS impersonation: [Configuration](../reference/configuration.md#remote-client-flags).

## Next steps

- [CLI](./cli.md) — one-shot commands, JSON output, and CI workflows
- [MCP](./mcp.md) — long-lived sessions for agent clients
- [Web](./web.md) — browser UI for lineage, execution, and inventory
- [Core](./core.md) — programmatic analysis substrate
