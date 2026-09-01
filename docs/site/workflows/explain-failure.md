# Explain a failure

## Outcome

You understand what a resource does, why a run may have failed, and which downstream nodes are in the blast radius.

## When to use this

| Surface | Use when                                                                 |
| ------- | ------------------------------------------------------------------------ |
| CLI     | One-shot investigation from shell or CI; pipe `--json` to other tools    |
| MCP     | An agent needs several follow-up queries on the same node                |
| Web     | You want lineage and execution context visually after resolving the node |

## Steps

1. Resolve the resource with [Find a model](find-a-model.md) if you only have a partial name. For a failed run, start from `failures` or `query-executions --status error,fail`.
2. Run `explain` with the full `unique_id`.
3. Run `impact` for counts and notable dependents, then `deps --direction downstream` for the full blast-radius list.
4. Optionally ask your agent to use `dbt-tools-cli:describe-resource` and `dbt-tools-cli:trace-dependencies` (downstream).

## Example

```bash
dbt-tools failures --dbt-target ./target --json
dbt-tools discover --dbt-target ./target "fct_orders" --json
dbt-tools explain model.my_project.fct_orders --dbt-target ./target --json
dbt-tools impact model.my_project.fct_orders --dbt-target ./target --json
dbt-tools deps model.my_project.fct_orders --dbt-target ./target --direction downstream --json
```

Replace `model.my_project.fct_orders` with the `unique_id` from `failures` or `discover` output.

## Next

- [Investigate slow runs](investigate-slow-runs.md)
- [Investigation tour](../guide/web/investigation-tour.md)
- [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) — explain, impact, and deps options
