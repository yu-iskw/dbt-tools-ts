# Configuration

Set the artifact root with **`--dbt-target`** or **`DBT_TOOLS_DBT_TARGET`** (local path, `s3://bucket/prefix`, or `gs://bucket/prefix`). On MCP, CLI flags override matching env vars when both are set.

Remote setup details (including GCS impersonation): [Local and remote artifacts](../concepts/local-and-remote-artifacts.md).

## Environment variables

| Variable                                    | CLI | MCP | Web | Purpose                                                                     |
| ------------------------------------------- | --- | --- | --- | --------------------------------------------------------------------------- |
| `DBT_TOOLS_DBT_TARGET`                      | yes | yes | yes | Default artifact root (local, `s3://`, or `gs://`; web preloads at startup) |
| `DBT_TOOLS_GCS_PROJECT_ID`                  | yes | yes | yes | GCS client project (`gs://` targets)                                        |
| `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT` | yes | yes | yes | GCS read-only impersonation principal                                       |
| `DBT_TOOLS_S3_REGION`                       | yes | yes | yes | S3 region                                                                   |
| `DBT_TOOLS_S3_ENDPOINT`                     | yes | yes | yes | S3-compatible endpoint URL                                                  |
| `DBT_TOOLS_TARGET_DIR`                      | —   | —   | yes | Local artifact directory for web server                                     |
| `DBT_TOOLS_WEB_BASE_URL`                    | yes | —   | —   | Base URL for `web_url` in CLI JSON ([deep links](./deep-links.md))          |
| `DBT_TOOLS_DEBUG`                           | yes | yes | yes | Set `1` for debug/progress logs on stderr                                   |
| `DBT_TOOLS_MAX_CACHED_TARGETS`              | —   | yes | —   | MCP LRU capacity for parsed artifact roots (default **3**; **0** disables)  |
| `DBT_TOOLS_CACHE_TTL_MS`                    | —   | yes | —   | MCP idle TTL to evict cached roots (default **0**, disabled)                |
| `DBT_TOOLS_WATCH`                           | —   | —   | dev | Vite dev file watch (`0` disables)                                          |
| `DBT_TOOLS_RELOAD_DEBOUNCE_MS`              | —   | —   | dev | Vite dev reload debounce (ms)                                               |

Standard cloud auth (not dbt-tools-specific): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_PROFILE`, `AWS_REGION`, `GOOGLE_APPLICATION_CREDENTIALS`, and GCP application default credentials.

Deprecated aliases (`DBT_TARGET_DIR`, `DBT_DEBUG`, etc.) may still work; see package READMEs.

## Remote client variables (S3 / GCS)

Use with `s3://` or `gs://` in `DBT_TOOLS_DBT_TARGET` / `--dbt-target`:

| Variable                                    | Purpose                                      |
| ------------------------------------------- | -------------------------------------------- |
| `DBT_TOOLS_GCS_PROJECT_ID`                  | GCP project for GCS                          |
| `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT` | Impersonated service account (read-only GCS) |
| `DBT_TOOLS_S3_REGION`                       | S3 region                                    |
| `DBT_TOOLS_S3_ENDPOINT`                     | Custom S3-compatible endpoint                |

**MCP and web** startup flags: `--dbt-target`, `--gcs-project-id`, `--gcs-impersonate-service-account`, `--s3-region`, `--s3-endpoint`, `-V` / `--version` (flags override env when both are set). MCP also supports `--poll-interval-ms`, `--max-cached-targets`, and `--cache-ttl-ms` (see [MCP tools](./mcp-tools.md)). See [Web server CLI](./web-cli.md) and [`packages/web/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md).

You can also switch remote sources in the web **Load artifacts** panel after startup (see [Local and remote artifacts](../concepts/local-and-remote-artifacts.md)).

## Node.js

- **20+** for published packages; monorepo development uses [`.mise.toml`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.mise.toml) / [`.node-version`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.node-version).

## Further reading

- [CLI cheatsheet](./cli-cheatsheet.md)
- [MCP tools](./mcp-tools.md)
- [`packages/cli/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md)
- [`packages/mcp/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/README.md)
- [`packages/mcp/REFERENCE.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/REFERENCE.md) — full MCP tool inputs
- [`packages/web/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md)
