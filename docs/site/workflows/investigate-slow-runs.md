# Investigate slow runs

## Outcome

You see which models or tests took the longest in a run and can explore execution timelines interactively.

## When to use this

| Surface | Use when                                                    |
| ------- | ----------------------------------------------------------- |
| CLI     | `query-executions` for sorted durations or CSV/JSON export  |
| MCP     | Skip unless an agent will run many execution queries        |
| Web     | Primary surface—execution views, timelines, and bottlenecks |

## Steps

1. Confirm artifacts with [Check run health](check-run-health.md).
2. Start the web UI and open the URL printed in the terminal.
3. Use execution and timeline views to find slow nodes; use CLI `query-executions` for scripted top-N lists.

## Example

```bash
npx @dbt-tools/web --dbt-target ./target
```

```bash
dbt-tools query-executions --dbt-target ./target --sort execution_time_desc --limit 20 --json
```

## Next

- [Investigation tour](../guide/web/investigation-tour.md)
- [Web getting started](../guide/web/getting-started.md)
- [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) — query-executions filters
