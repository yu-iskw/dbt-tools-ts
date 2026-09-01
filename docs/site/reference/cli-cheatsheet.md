# CLI cheatsheet

Curated commands for daily use. Full flags and examples: [packages/cli/README.md](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md).

Set `DBT_TOOLS_DBT_TARGET=./target` or pass `--dbt-target ./target` on every command. Remote targets: [Local and remote artifacts](../concepts/local-and-remote-artifacts.md).

## Remote targets

```bash
dbt-tools status --dbt-target ./target
dbt-tools status --dbt-target s3://my-bucket/dbt/prod
dbt-tools status --dbt-target gs://my-bucket/dbt/prod
```

## Readiness and manifest

| Command     | Purpose                                      |
| ----------- | -------------------------------------------- |
| `status`    | Artifact presence and readiness              |
| `summary`   | Manifest graph statistics (not run outcomes) |
| `freshness` | Alias for `status`                           |

```bash
dbt-tools status --dbt-target ./target --json
dbt-tools summary --dbt-target ./target --json
```

## Discovery and inventory

| Command     | Purpose                                                  |
| ----------- | -------------------------------------------------------- |
| `discover`  | Ranked search with reasons (preferred)                   |
| `search`    | Resource search (shared parsing; different output shape) |
| `inventory` | List/filter resources                                    |

```bash
dbt-tools discover --dbt-target ./target "orders" --json
dbt-tools inventory --dbt-target ./target --type model --json
```

## Graph and dependencies

| Command   | Purpose                                                   |
| --------- | --------------------------------------------------------- |
| `deps`    | Upstream/downstream dependencies                          |
| `impact`  | Intent: counts and notable dependents (lineage `web_url`) |
| `graph`   | Export graph (JSON, DOT, GEXF)                            |
| `export`  | Intent wrapper over `graph` (`--output` for a file)       |
| `explain` | Intent-shaped resource summary                            |

```bash
dbt-tools deps model.pkg.node --dbt-target ./target --direction downstream --json
dbt-tools impact model.pkg.node --dbt-target ./target --json
dbt-tools explain model.pkg.node --dbt-target ./target --json
dbt-tools export --dbt-target ./target --format json --output graph.json
```

## Execution

| Command            | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| `query-executions` | Filter/sort run executions                      |
| `failures`         | Bounded non-successful `run_results` rows       |
| `timeline`         | Per-node execution timeline                     |
| `run-summary`      | Run-level aggregates (status, bottlenecks)      |
| `run-report`       | Execution report + critical path                |
| `diagnose`         | **Experimental** facade (`diagnose run`/`node`) |

```bash
dbt-tools query-executions --dbt-target ./target --sort execution_time_desc --limit 20 --json
dbt-tools failures --dbt-target ./target --json
dbt-tools run-summary --dbt-target ./target --json
dbt-tools run-report --dbt-target ./target --json
```

Root `query-executions` sorts: `execution_time_desc`, `execution_time_asc`, `unique_id`. `--sort duration` is a **`timeline`** key.

Warehouse subcommands add adapter filters (BigQuery example):

```bash
dbt-tools query-executions bigquery --dbt-target ./target --min-slot-ms 1000 --sort slot_ms_desc --limit 20 --json
```

Also: `snowflake`, `athena`, `postgres`, `redshift`, `spark`. Full flags: [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md).

## Introspection

| Command  | Purpose                       |
| -------- | ----------------------------- |
| `schema` | Runtime command/field schemas |

```bash
dbt-tools schema --json
```

## Common flags

| Flag             | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `--json`         | Machine-readable stdout                            |
| `--fields "a,b"` | Shrink JSON payloads (not registered on `summary`) |
| `--trace`        | Investigation transcript on intent/discover output |

## Workflows

- [Check run health](../workflows/check-run-health.md)
- [Find a model](../workflows/find-a-model.md)
- [Open in web](../workflows/open-in-web.md)
