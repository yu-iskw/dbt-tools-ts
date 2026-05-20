# summarize-run — CLI implementation

| Primitive     | Current CLI                    | Notes                      |
| ------------- | ------------------------------ | -------------------------- |
| summarize-run | `dbt-tools run-summary --json` | No per-node execution list |

## Recipes

```bash
dbt-tools run-summary --dbt-target ./target --json
```

Pair with [`query-executions`](../../query-executions/references/implementation.md) for drill-down.

See [packages/cli/README.md](../../../../../packages/cli/README.md) (`run-summary`).
