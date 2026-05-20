# Troubleshooting

## Artifacts not found

- Confirm `manifest.json` and `run_results.json` exist at the **root** of your `--dbt-target` / `--target` path.
- Run `dbt compile` or `dbt run` if artifacts are missing or stale.

## Wrong Node version

Published packages require **Node.js 20+**. Match [`.node-version`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.node-version) when developing from the monorepo.

## MCP client cannot start the server

- Use the full binary name `dbt-tools-mcp` in MCP config.
- Pass `--dbt-target` or set `DBT_TOOLS_DBT_TARGET`.
- Check stdio transport: the server is designed for MCP over stdin/stdout, not HTTP.

## Web UI shows empty views

- Verify the target directory contains a complete manifest/run pair for the run you expect.
- For remote sources, confirm credentials and bucket paths on the **Node server** (see package README).

## GitHub Pages site issues

If CSS or assets fail to load on the published docs site, confirm VitePress `base` is `/dbt-tools-ts/` for project Pages. After a custom domain migration, update `base` in `docs/site/.vitepress/config.ts`.

## Get help

- [GitHub issues](https://github.com/yu-iskw/dbt-tools-ts/issues)
- Package READMEs under `packages/*/README.md`
