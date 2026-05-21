# Troubleshooting

Symptom-first fixes for common setup issues. Package-specific detail remains in [`packages/*/README.md`](https://github.com/yu-iskw/dbt-tools-ts/tree/main/packages).

## Symptom → fix

| Symptom                                             | Likely cause                           | What to do                                                                                                                                                                          |
| --------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json not found` / readiness `unavailable` | Wrong or empty `--dbt-target`          | Point at dbt `target/` root; run `dbt compile` or `dbt run`                                                                                                                         |
| Commands work locally but fail in CI                | Artifacts not uploaded to CI workspace | Publish `target/` (or remote URI) before `dbt-tools` step                                                                                                                           |
| `dbt-tools-mcp` fails to start                      | Wrong binary or missing target         | Use `dbt-tools-mcp`; set `--dbt-target` or `DBT_TOOLS_DBT_TARGET`; stdio only (not HTTP)                                                                                            |
| MCP works once then stale data                      | New dbt run wrote fresh artifacts      | Restart MCP or point at updated target path                                                                                                                                         |
| Web UI empty / no graph                             | `manifest-only` or missing run results | Run [Check run health](../workflows/check-run-health.md); need `run_results.json` for execution views                                                                               |
| Remote S3/GCS errors                                | Credentials or path on server          | Configure env on **Node** (CLI/MCP/web server), not in browser; see [Local and remote artifacts](../concepts/local-and-remote-artifacts.md) and [Configuration](./configuration.md) |
| No `web_url` in CLI JSON                            | `DBT_TOOLS_WEB_BASE_URL` unset         | Export base URL of running web app; see [Deep links](./deep-links.md)                                                                                                               |
| `pnpm site:dev` esbuild errors                      | Legacy browser target in monorepo      | Keep `esnext` in `docs/site/.vitepress/config.ts` (see [AGENTS.md](https://github.com/yu-iskw/dbt-tools-ts/blob/main/AGENTS.md))                                                    |
| Published docs missing CSS                          | Wrong VitePress `base`                 | Confirm `base: '/dbt-tools-ts/'` in `docs/site/.vitepress/config.ts`                                                                                                                |

## Artifacts not found

- Confirm `manifest.json` and `run_results.json` exist at the **root** of your `--dbt-target` path (web: `--target` is a local alias).
- Run `dbt compile` or `dbt run` if artifacts are missing or stale.
- See [dbt artifacts & target/](../concepts/dbt-artifacts.md) for **manifest-only** (`dbt compile`) vs **full** (`dbt run` / `dbt build` / `dbt test`) and what each file is used for.

## Wrong Node version

Published packages require **Node.js 20+**. Match [`.node-version`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.node-version) when developing from the monorepo.

## MCP client cannot start the server

- Use the full binary name `dbt-tools-mcp` in MCP config.
- Pass `--dbt-target` or set `DBT_TOOLS_DBT_TARGET`.
- Check stdio transport: the server is designed for MCP over stdin/stdout, not HTTP.

## Web UI shows empty views

- Verify the target directory contains a complete manifest/run pair for the run you expect.
- Execution views need `run_results.json`—a **manifest-only** target after `dbt compile` is not enough. See [dbt artifacts & target/](../concepts/dbt-artifacts.md#when-artifacts-appear).
- For remote sources, pass `--dbt-target s3://…` or `gs://…` with optional `--gcs-impersonate-service-account` (or env) on **`dbt-tools-web`** startup; see [Web server CLI](./web-cli.md).

## GitHub Pages site issues

If CSS or assets fail to load on the published docs site, confirm VitePress `base` is `/dbt-tools-ts/` for project Pages. After a custom domain migration, update `base` in `docs/site/.vitepress/config.ts`.

## Get help

- [GitHub issues](https://github.com/yu-iskw/dbt-tools-ts/issues)
- [Configuration](./configuration.md)
- Package READMEs under `packages/*/README.md`
