# Find a model by fuzzy name

## Outcome

You have a ranked list of matching dbt resources with scores and reasons, plus a `unique_id` to use in follow-up commands.

## When to use this

| Surface | Use when                                                    |
| ------- | ----------------------------------------------------------- |
| CLI     | Scripts, agents, or shell—especially with `--json`          |
| MCP     | Many lookups over the same run without re-parsing each time |
| Web     | Visual discover workspace with the same ranking contract    |

## Steps

1. Run `discover` with a partial name, typo, or token like `type:model`.
2. Read the top match `unique_id` from JSON output.
3. Use that id in `explain`, `deps`, or open the web UI for deeper views.

## Example

```bash
dbt-tools discover --dbt-target ./target "orders" --json
dbt-tools discover --dbt-target ./target "type:model" --limit 30 --json
```

## Next

- [Explain a failure](explain-failure.md)
- [Common CLI tasks](../guide/cli/common-tasks.md)
- [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) — discover tokens and filters
