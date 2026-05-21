# Deploy dbt-tools

dbt-tools reads dbt artifacts from a **target root**. The same target root configuration works across CLI, Web, and MCP.

## Supported target roots

| Type | Format | Example |
|---|---|---|
| Local directory | Filesystem path | `./target` |
| Amazon S3 | `s3://bucket/prefix` | `s3://my-bucket/dbt/prod/latest` |
| Google Cloud Storage | `gs://bucket/prefix` | `gs://my-bucket/dbt/prod/latest` |

## How to specify the target root

Use the `--dbt-target` flag or the `DBT_TOOLS_DBT_TARGET` environment variable:

```bash
# Flag
npx @dbt-tools/cli status --dbt-target ./target --json

# Environment variable
export DBT_TOOLS_DBT_TARGET=./target
npx @dbt-tools/cli status --json
```

All three surfaces (CLI, Web, MCP) accept the same `--dbt-target` flag and environment variable.

## Required artifacts

Every target root must contain:

| File | Required |
|---|---|
| `manifest.json` | Yes |
| `run_results.json` | Yes (for run-related commands) |
| `catalog.json` | No (enables column-level metadata) |
| `sources.json` | No (enables source freshness data) |

## Deployment guides

- [Local target directory](./local-target.md) — use `./target` from a dbt project
- [S3](./s3.md) — configure credentials and read artifacts from an S3 bucket
- [GCS](./gcs.md) — configure credentials and read artifacts from a GCS bucket
- [GitHub Actions](./github-actions.md) — run dbt-tools in CI
- [Credentials](./credentials.md) — credential precedence and least-privilege setup

## Related

- [Configuration reference](../reference/configuration.md) — full list of environment variables
- [Local and remote artifacts](../concepts/local-and-remote-artifacts.md) — how remote roots work
- [Trust & Safety](../trust/) — data boundaries and production hardening
