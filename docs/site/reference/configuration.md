# Configuration

Configuration is **package-specific**. Use the variables and flags documented in each package README.

## Common patterns

| Concern           | CLI / MCP                              | Web                                              |
| ----------------- | -------------------------------------- | ------------------------------------------------ |
| Artifact location | `--dbt-target`, `DBT_TOOLS_DBT_TARGET` | `--target`, env vars in package README           |
| Remote S3/GCS     | `s3://` / `gs://` targets (see below)  | Server-side credentials; browser uses `/api/...` |

## Environment

- **Node.js** — 20+ for published packages; monorepo development uses [`.node-version`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.node-version).
- **Monorepo** — clone the repository and run `pnpm install` for contributor workflows.

## Further reading

- [`packages/cli/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) — CLI flags and `DBT_TOOLS_*` variables
- [`packages/mcp/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/README.md) — MCP launch and target options
- [`packages/web/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md) — dev server, Docker, and remote sources
