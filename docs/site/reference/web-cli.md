# Web server CLI (`dbt-tools-web`)

The published **`dbt-tools-web`** binary shares **artifact root** and **remote client** flags with **`dbt-tools-mcp`**. Web-only flags: `--port`, `--target` (local alias).

Run **`dbt-tools-web --help`** for the current list. Flags override matching `DBT_TOOLS_*` env vars when both are set.

## Startup flags

| Flag / environment variable                                                       | Purpose                                                                   |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `--dbt-target <target>` / `DBT_TOOLS_DBT_TARGET`                                  | Artifact root at startup (local, `s3://`, or `gs://`); preloads artifacts |
| `--target <dir>` / `-t`                                                           | Alias for **local** `--dbt-target`; also sets `DBT_TOOLS_TARGET_DIR`      |
| `--gcs-impersonate-service-account` / `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT` | GCS read-only impersonation (`gs://` only)                                |
| `--gcs-project-id` / `DBT_TOOLS_GCS_PROJECT_ID`                                   | GCS client project (`gs://` only)                                         |
| `--s3-region` / `DBT_TOOLS_S3_REGION`                                             | S3 region (`s3://` only)                                                  |
| `--s3-endpoint` / `DBT_TOOLS_S3_ENDPOINT`                                         | S3-compatible endpoint (`s3://` only)                                     |
| `--port <n>` / `-p`                                                               | Listen port (default **3000**)                                            |
| `-V`, `--version`                                                                 | Print package version and exit                                            |
| `-h`, `--help`                                                                    | Print usage and exit                                                      |

Remote client flags require an `s3://` or `gs://` `--dbt-target` (same validation as MCP).

## Examples

```bash
# Local target (alias)
npx @dbt-tools/web --target ./target

# Canonical flag (local or remote)
npx @dbt-tools/web --dbt-target ./target --port 3000

# GCS with impersonation at startup
npx @dbt-tools/web \
  --dbt-target gs://my-bucket/dbt/prod \
  --gcs-project-id my-gcp-project \
  --gcs-impersonate-service-account reader@my-project.iam.gserviceaccount.com
```

After startup you can still switch sources via the in-app **Load artifacts** panel.

## Learn more

- [Configuration](./configuration.md) — all `DBT_TOOLS_*` variables
- [Local and remote artifacts](../concepts/local-and-remote-artifacts.md)
- [Web getting started](../guide/web/getting-started.md)
- [packages/web/README.md](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md)
