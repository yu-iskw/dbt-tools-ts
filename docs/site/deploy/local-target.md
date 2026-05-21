# Use a local target directory

The simplest deployment is a local `target/` directory from a dbt project. dbt writes `manifest.json` and `run_results.json` there by default after any `dbt run`, `dbt test`, or `dbt build` invocation.

## Minimal example

```bash
cd my-dbt-project
dbt run
npx @dbt-tools/cli status --dbt-target ./target --json
```

## Configuration

| Method               | Example                         |
| -------------------- | ------------------------------- |
| Flag                 | `--dbt-target ./target`         |
| Environment variable | `DBT_TOOLS_DBT_TARGET=./target` |

The path can be relative (resolved from the current working directory) or absolute.

## Non-default target directories

dbt allows overriding the target directory via `--target-path` or the `target-path` key in `dbt_project.yml`. If your project uses a non-default path, specify it with `--dbt-target`:

```bash
dbt run --target-path ./my-custom-target
npx @dbt-tools/cli status --dbt-target ./my-custom-target --json
```

## Using the Web UI locally

```bash
npx @dbt-tools/web --dbt-target ./target
```

This starts the Web UI on `http://localhost:3000` by default. The port and host are configurable. See [Web server CLI](../reference/web-cli.md) for flags.

## Using MCP locally

```bash
npx @dbt-tools/mcp --dbt-target ./target
```

The MCP server reads the artifacts at startup and holds them in memory for the session. If you run dbt again and want the MCP server to see the new results, restart the server.

## Troubleshooting

| Symptom                 | Likely cause                           | Fix                                                                |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `status: unavailable`   | Path does not contain `manifest.json`  | Confirm you ran dbt and that `./target/manifest.json` exists       |
| `status: manifest-only` | `run_results.json` not present         | Run `dbt run`, `dbt test`, or `dbt build` — not just `dbt compile` |
| Stale results           | Previous run's artifacts still on disk | Re-run dbt; artifacts are overwritten on each run                  |

## Related

- [S3](./s3.md) — read from remote object storage
- [GCS](./gcs.md) — read from Google Cloud Storage
- [Configuration reference](../reference/configuration.md)
