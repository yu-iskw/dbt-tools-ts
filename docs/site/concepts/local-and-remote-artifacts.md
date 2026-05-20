# Local-first artifacts

dbt-tools is **local-first**: the default path is a dbt `target/` directory on disk. Remote object storage is supported when you explicitly configure it—credentials stay on the Node side, not in the browser.

## Modes

| Mode                     | Typical use                                                                     |
| ------------------------ | ------------------------------------------------------------------------------- |
| **Local `target/`**      | Developer loop, CI artifact download, `dbt-tools-web --target`                  |
| **Remote S3/GCS**        | Investigating scheduled runs in a bucket (`s3://…`, `gs://…` as `--dbt-target`) |
| **Web upload / preload** | Ad hoc files or trusted local preload in the UI (server-mediated)               |

## CLI and MCP

- Pass `--dbt-target` or `DBT_TOOLS_DBT_TARGET` to a directory or remote URI.
- `status` checks filesystem or downloaded copies before parse-heavy commands.
- Large remote manifests benefit from **MCP** resident cache when agents issue many queries.

## Web

- Local paths are served by the Node dev server.
- Remote sources use server-side credentials; the browser calls `/api/...` routes—see [packages/web README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md).

## Learn more

- [ADR-0004 — remote object storage](https://github.com/yu-iskw/dbt-tools-ts/blob/main/docs/adr/0004-remote-object-storage-artifact-sources-and-auto-reload.md)
- [Configuration](../reference/configuration.md)
- [Troubleshooting](../reference/troubleshooting.md) — remote and empty target issues
