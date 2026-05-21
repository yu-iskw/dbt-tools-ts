# Configuration

Configuration is **package-specific**. Use the variables and flags documented in each package README.

## Common patterns

| Concern           | CLI / MCP                                             | Web                                              |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------ |
| Artifact location | `--dbt-target`, `DBT_TOOLS_DBT_TARGET`                | `--target`, env vars in package README           |
| Remote S3/GCS     | See [Remote client flags](#remote-client-flags) below | Server-side credentials; browser uses `/api/...` |

## Remote client flags

S3 and GCS remote artifact roots, plus GCS service-account impersonation.

Use these settings when the artifact root is an **`s3://`** or **`gs://`** prefix, or when you need **GCS service-account impersonation** (workload identity, user ADC, etc.).

### When to use

- Artifact root is **`s3://bucket/prefix`** or **`gs://bucket/prefix`**.
- GCS access requires impersonating a target service account (not only ambient ADC).
- You need optional S3 region/endpoint or GCS project id overrides beyond default credential chains.

### Flag and environment variables

| CLI flag                                    | Environment variable                        | Valid with   |
| ------------------------------------------- | ------------------------------------------- | ------------ |
| `--gcs-impersonate-service-account <email>` | `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT` | `gs://` only |
| `--gcs-project-id <id>`                     | `DBT_TOOLS_GCS_PROJECT_ID`                  | `gs://` only |
| `--s3-region <region>`                      | `DBT_TOOLS_S3_REGION`                       | `s3://` only |
| `--s3-endpoint <url>`                       | `DBT_TOOLS_S3_ENDPOINT`                     | `s3://` only |

**`DBT_TOOLS_REMOTE_SOURCE`** JSON may also include **`impersonatedServiceAccount`** for GCS when pre-seeding the web server or merging remote config. Granular env vars and CLI flags above are preferred for MCP and CLI automation.

**CLI:** remote client flags are **global** — place them **before** the subcommand (for example `status`, `discover`, `deps`).

**GCS impersonation allowlists** (optional operator policy):

- **`DBT_TOOLS_GCS_IMPERSONATION_ALLOWLIST`** — comma-separated exact principal emails.
- **`DBT_TOOLS_GCS_IMPERSONATION_ALLOWED_SUFFIXES`** — comma-separated suffix match (principal must end with one entry).

Further reading: [ADR-0004](https://github.com/yu-iskw/dbt-tools-ts/blob/main/docs/adr/0004-remote-object-storage-artifact-sources-and-auto-reload.md), [agent remote-client reference](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/dbt-tools-cli/skills/dbt-artifacts-status/references/remote-client.md).

### Examples

```bash
# CLI — flags before subcommand
dbt-tools \
  --gcs-impersonate-service-account svc@proj.iam.gserviceaccount.com \
  status --dbt-target gs://my-bucket/dbt/prod/run --json

# MCP
dbt-tools-mcp \
  --dbt-target gs://my-bucket/dbt/prod/run \
  --gcs-impersonate-service-account svc@proj.iam.gserviceaccount.com

# Web — remote JSON + startup flag
export DBT_TOOLS_REMOTE_SOURCE='{"provider":"gcs","bucket":"my-bucket","prefix":"dbt/prod/run"}'
dbt-tools-web --gcs-impersonate-service-account svc@proj.iam.gserviceaccount.com --port 3000
```

Confirm flag spelling for your install with `dbt-tools --help`, `dbt-tools-mcp --help`, and `dbt-tools-web --help`.

## Environment

- **Node.js** — 20+ for published packages; monorepo development uses [`.node-version`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.node-version).
- **Monorepo** — clone the repository and run `pnpm install` for contributor workflows.

## Further reading

- [`packages/cli/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) — CLI flags and `DBT_TOOLS_*` variables
- [`packages/mcp/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/README.md) — MCP launch and target options
- [`packages/web/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md) — dev server, Docker, and remote sources
