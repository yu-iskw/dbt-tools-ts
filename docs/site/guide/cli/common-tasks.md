# Common CLI tasks

The CLI is for **one-shot**, scriptable analysis: JSON output, stable exit codes, and `--fields` to shrink payloads for CI and agents.

## Commands to learn first

| Command            | Purpose                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `status`           | Artifact presence and readiness (`full`, `manifest-only`, `unavailable`) |
| `summary`          | Manifest graph statistics (not run outcomes)                             |
| `run-summary`      | Run-level aggregates, status mix, bottlenecks                            |
| `discover`         | Ranked search with scores and reasons                                    |
| `explain`          | Structured summary for one `unique_id`                                   |
| `deps`             | Upstream or downstream dependencies                                      |
| `query-executions` | Filter and sort run executions                                           |
| `failures`         | Bounded non-successful execution rows                                    |

## Patterns

**JSON for automation** (default in non-TTY):

```bash
dbt-tools summary --dbt-target ./target --json
dbt-tools run-summary --dbt-target ./target --json
dbt-tools discover --dbt-target ./target "orders" --json
```

**Shrink output with `--fields`** (commands that register the option, such as `deps`):

```bash
dbt-tools deps model.my_project.customers --dbt-target ./target --fields "unique_id,name" --json
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
