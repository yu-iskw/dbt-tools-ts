# CLI cheatsheet

Curated commands for daily use. Full flags and examples: [packages/cli/README.md](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md).

Set `DBT_TOOLS_DBT_TARGET=./target` or pass `--dbt-target ./target` on every command.

## Readiness and manifest

| Command     | Purpose                         |
| ----------- | ------------------------------- |
| `status`    | Artifact presence and readiness |
| `summary`   | Manifest statistics             |
| `freshness` | Alias for `status`              |

```bash
dbt-tools status --dbt-target ./target --json
dbt-tools summary --dbt-target ./target --fields "total_nodes" --json
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

| Command   | Purpose                          |
| --------- | -------------------------------- |
| `deps`    | Upstream/downstream dependencies |
| `graph`   | Export graph (JSON, DOT, GEXF)   |
| `explain` | Intent-shaped resource summary   |

```bash
dbt-tools deps model.pkg.node --dbt-target ./target --direction downstream --json
dbt-tools explain model.pkg.node --dbt-target ./target --json
```

## Execution

| Command            | Purpose                     |
| ------------------ | --------------------------- |
| `query-executions` | Filter/sort run executions  |
| `timeline`         | Per-node execution timeline |
| `run-summary`      | Run-level aggregates        |

```bash
dbt-tools query-executions --dbt-target ./target --sort duration --limit 20 --json
```

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
| `--fields "a,b"` | Shrink JSON payloads                               |
| `--trace`        | Investigation transcript on intent/discover output |

## Workflows

- [Check run health](../workflows/check-run-health.md)
- [Find a model](../workflows/find-a-model.md)
- [Open in web](../workflows/open-in-web.md)
