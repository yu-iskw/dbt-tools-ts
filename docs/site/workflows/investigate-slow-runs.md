# Investigate slow runs

## Outcome

You see which models or tests took the longest in a run and can explore execution timelines interactively.

## When to use this

| Surface | Use when                                                       |
| ------- | -------------------------------------------------------------- |
| CLI     | `query-executions` for sorted durations or CSV/JSON export     |
| MCP     | Skip unless a coding agent will run many execution queries     |
| Web     | Primary surface—**Timeline** (sequencing) and **Runs** (table) |

## Steps

1. Confirm artifacts with [Check run health](check-run-health.md).
2. Start the web UI and open the URL printed in the terminal (default `http://127.0.0.1:3000`).
3. Open **`?view=timeline`** for Gantt-style order and critical path; open **`?view=runs`** for a filterable execution list.
4. Use CLI `query-executions` for a scripted top-N list.

## Example

```bash
npx @dbt-tools/web --dbt-target ./target
```

```text
http://127.0.0.1:3000/?view=timeline
http://127.0.0.1:3000/?view=runs
```

```bash
dbt-tools query-executions --dbt-target ./target --sort execution_time_desc --limit 20 --json
```

## Next

- [Investigation tour](../guide/web/investigation-tour.md)
- [Web getting started](../guide/web/getting-started.md)
- [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) — query-executions filters
