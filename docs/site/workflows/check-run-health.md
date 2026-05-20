# Check run health after CI

## Outcome

You know whether `manifest.json` and `run_results.json` are present, fresh enough for analysis, and what commands you can run next.

## When to use this

| Surface | Use when                                                                 |
| ------- | ------------------------------------------------------------------------ |
| CLI     | CI gates, shell scripts, or a quick post-run check                       |
| MCP     | Skip for one-shot checks—use CLI or wire MCP for repeated agent queries  |
| Web     | After CLI confirms artifacts, open the UI for health and inventory views |

## Prerequisites

- Artifacts under `target/` ([overview](../guide/overview.md))

## Steps

1. Point at your dbt `target/` directory with `--dbt-target` or `DBT_TOOLS_DBT_TARGET`.
2. Run `status` to see readiness (`full`, `manifest-only`, or `unavailable`).
3. Run `summary` with `--json` in CI for machine-readable manifest statistics.

## Example

```bash
dbt-tools status --dbt-target ./target
dbt-tools summary --dbt-target ./target --json
```

## Next

- [Common CLI tasks](../guide/cli/common-tasks.md)
- [Investigation tour](../guide/web/investigation-tour.md)
- [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) — all flags
