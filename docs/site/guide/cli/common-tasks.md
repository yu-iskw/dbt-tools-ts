# Common CLI tasks

The CLI is for **one-shot**, scriptable analysis: JSON output, stable exit codes, and `--fields` to shrink payloads for CI and agents.

## Commands to learn first

| Command            | Purpose                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `status`           | Artifact presence and readiness (`full`, `manifest-only`, `unavailable`) |
| `summary`          | Manifest statistics                                                      |
| `discover`         | Ranked search with scores and reasons                                    |
| `explain`          | Structured summary for one `unique_id`                                   |
| `deps`             | Upstream or downstream dependencies                                      |
| `query-executions` | Filter and sort run executions                                           |

## Patterns

**JSON for automation** (default in non-TTY):

```bash
dbt-tools summary --dbt-target ./target --json
dbt-tools discover --dbt-target ./target "orders" --json
```

**Shrink output with `--fields`:**

```bash
dbt-tools summary --dbt-target ./target --fields "total_nodes,total_edges" --json
```

**Environment variable** instead of repeating the flag:

```bash
export DBT_TOOLS_DBT_TARGET=./target
dbt-tools status
```

## Workflows

- [Check run health](../../workflows/check-run-health.md)
- [Find a model](../../workflows/find-a-model.md)
- [Explain a failure](../../workflows/explain-failure.md)

## Learn more

- [Getting started](./getting-started.md)
- [Configuration](../../reference/configuration.md)
- [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) — full command reference
