# Remote client flags (S3 / GCS)

Use this reference when **`--dbt-target`** (or **`DBT_TOOLS_DBT_TARGET`**) is an **`s3://`** or **`gs://`** prefix, or when the organization requires **GCS service-account impersonation** (workload identity, user ADC, etc.).

Full operator detail: [packages/cli/README.md](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md).

## When to use

- Artifact root is **`s3://bucket/prefix`** or **`gs://bucket/prefix`**.
- GCS access requires impersonating a target service account (not only ambient ADC).
- You need optional S3 region/endpoint or GCS project id overrides beyond default credential chains.

## Flag and environment variables

| CLI flag                                    | Environment variable                        | Valid with           |
| ------------------------------------------- | ------------------------------------------- | -------------------- |
| `--gcs-impersonate-service-account <email>` | `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT` | `gs://` targets only |
| `--gcs-project-id <id>`                     | `DBT_TOOLS_GCS_PROJECT_ID`                  | `gs://` only         |
| `--s3-region <region>`                      | `DBT_TOOLS_S3_REGION`                       | `s3://` only         |
| `--s3-endpoint <url>`                       | `DBT_TOOLS_S3_ENDPOINT`                     | `s3://` only         |

**`DBT_TOOLS_REMOTE_SOURCE`** JSON may also include **`impersonatedServiceAccount`** for GCS when pre-seeding the web server or merging remote config. Granular env vars and CLI flags above are preferred for MCP and CLI automation.

## CLI (`dbt-tools`)

Remote client flags are **global**: place them **before** the subcommand (for example `status`, `discover`, `deps`).

```bash
# Impersonation + remote target (flags before subcommand)
dbt-tools \
  --gcs-impersonate-service-account svc@proj.iam.gserviceaccount.com \
  status --dbt-target gs://my-bucket/dbt/prod/run --json

# Env-only (same target for all follow-up commands)
export DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT=svc@proj.iam.gserviceaccount.com
export DBT_TOOLS_DBT_TARGET=gs://my-bucket/dbt/prod/run
dbt-tools discover "orders" --json
```

Use the **same** `--dbt-target` / `DBT_TOOLS_DBT_TARGET` and remote settings for the readiness gate and every downstream command.

## MCP (`dbt-tools-mcp`)

Long-running MCP server; same flag names and env equivalents:

```bash
dbt-tools-mcp \
  --dbt-target gs://my-bucket/dbt/prod/run \
  --gcs-impersonate-service-account svc@proj.iam.gserviceaccount.com
```

See [packages/mcp/README.md](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/README.md).

## Web (`dbt-tools-web`)

Operator startup with **`DBT_TOOLS_REMOTE_SOURCE`** plus optional impersonation flag. The in-app **Load artifacts** panel can still set impersonation per discover/configure; startup flags apply to the Node server process.

```bash
export DBT_TOOLS_REMOTE_SOURCE='{"provider":"gcs","bucket":"my-bucket","prefix":"dbt/prod/run"}'
dbt-tools-web \
  --gcs-impersonate-service-account svc@proj.iam.gserviceaccount.com \
  --port 3000
```

See [packages/web/README.md](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md).

## GCS impersonation allowlists

Operators may restrict which principals can be impersonated:

- **`DBT_TOOLS_GCS_IMPERSONATION_ALLOWLIST`** — comma-separated exact principal emails.
- **`DBT_TOOLS_GCS_IMPERSONATION_ALLOWED_SUFFIXES`** — comma-separated suffix match (principal must end with one entry).

If impersonation is denied, the CLI returns an error; point the user at these env vars.

## Agent workflow

1. Run **`dbt-tools-cli:dbt-artifacts-status`** with the same **`--dbt-target`** / **`DBT_TOOLS_DBT_TARGET`** you will use for downstream commands.
2. For **`gs://`** + impersonation: set **`--gcs-impersonate-service-account`** (or **`DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT`**) before any **`dbt-tools`** subcommand.
3. Credentials and impersonation stay in the **Node process** (CLI, MCP, or web server)—not in the browser.

Readiness branching after a successful remote fetch: [readiness.md](readiness.md).
