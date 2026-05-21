# Local and remote artifacts

dbt-tools is **local-first**: the default path is a dbt `target/` directory on disk. Remote object storage is supported when you explicitly configure it—credentials stay on the Node side, not in the browser.

## Modes

| Mode                     | Typical use                                                                     |
| ------------------------ | ------------------------------------------------------------------------------- |
| **Local `target/`**      | Developer loop, CI artifact download, `dbt-tools-web --target`                  |
| **Remote S3/GCS**        | Investigating scheduled runs in a bucket (`s3://…`, `gs://…` as `--dbt-target`) |
| **Web upload / preload** | Ad hoc files or trusted local preload in the UI (server-mediated)               |

## Target URIs (CLI and MCP)

```bash
# Local
dbt-tools status --dbt-target ./target

# S3 — scheme required (unschemed paths are treated as local)
dbt-tools status --dbt-target s3://my-bucket/dbt/prod

# GCS
dbt-tools status --dbt-target gs://my-bucket/dbt/prod
```

Required objects at the prefix root: `manifest.json` and `run_results.json` (same contract as local `target/`).

## Credentials (Node only)

Configure the **CLI**, **MCP**, or **web server** process—not the browser.

| Provider | Typical setup                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **S3**   | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, `AWS_PROFILE`, or instance role; optional `DBT_TOOLS_S3_REGION`, `DBT_TOOLS_S3_ENDPOINT` |
| **GCS**  | `GOOGLE_APPLICATION_CREDENTIALS` or application default credentials; optional `DBT_TOOLS_GCS_PROJECT_ID`                                |

## GCS impersonation (read-only)

For `gs://` targets, use a dedicated service account via impersonation (read-only access):

| Setting                                      | CLI / MCP                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT`  | Service account email to impersonate (`gs://` only)                         |
| `DBT_TOOLS_GCS_PROJECT_ID`                   | GCP project ID for the GCS client                                           |
| MCP flag `--gcs-impersonate-service-account` | Same as env; set at **MCP server startup** (not via `dbt_tools_set_target`) |

**MCP client example:**

```json
{
  "mcpServers": {
    "dbt-tools": {
      "command": "npx",
      "args": ["-y", "@dbt-tools/mcp", "--dbt-target", "gs://my-bucket/dbt/prod"],
      "env": {
        "DBT_TOOLS_GCS_PROJECT_ID": "my-gcp-project",
        "DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT": "reader@my-project.iam.gserviceaccount.com"
      }
    }
  }
}
```

**CLI:** the same `DBT_TOOLS_*` variables apply for `gs://` targets—see [Configuration](../reference/configuration.md).

## CLI and MCP

- Pass `--dbt-target` or `DBT_TOOLS_DBT_TARGET` to a directory or remote URI.
- `status` checks filesystem or downloaded copies before parse-heavy commands.
- Large remote manifests benefit from **MCP** resident cache when agents issue many queries.

## Web (different model)

The web app does not use `gs://` on the CLI one-shot model for server polling:

- **`DBT_TOOLS_TARGET_DIR`** — local folder for `dbt-tools-web` at startup.
- **Load artifacts** (in-app) — S3/GCS via `s3://` or `gs://` location; optional GCS options in the UI. Granular `DBT_TOOLS_GCS_*` / `DBT_TOOLS_S3_*` on the Node process apply when discovering remote sources.

Local paths are served by the Node process; remote sources use server-side credentials and `/api/...` routes. See [Web getting started](../guide/web/getting-started.md).

## Learn more

- [Configuration](../reference/configuration.md)
- [MCP tools](../reference/mcp-tools.md)
- [Troubleshooting](../reference/troubleshooting.md) — remote and empty target issues
