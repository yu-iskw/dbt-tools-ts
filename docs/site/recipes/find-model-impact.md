# Find model impact

## When to use this

Use this recipe when you need upstream dependencies, downstream blast radius, or an answer to “what breaks if I change this model?”

## Inputs required

- `manifest.json`
- `run_results.json` (optional for graph structure; helpful for last-run context)

## Recommended interface

| Interface | Use when                                                 |
| --------- | -------------------------------------------------------- |
| CLI       | Resolve names, `explain`, `deps`, JSON for automation    |
| Web       | Interactive lineage graph after you know the `unique_id` |
| MCP       | Repeated dependency queries in an agent session          |

## Step 1: Resolve the model name

```bash
export DEMO=./docs/site/public/demo   # or ./target
npx @dbt-tools/cli discover --dbt-target "$DEMO" "orders" --limit 5 --json
```

Note the top match `unique_id` (for example `model.jaffle_shop.orders`).

## Step 2: Summarize the resource

```bash
npx @dbt-tools/cli explain model.jaffle_shop.orders --dbt-target "$DEMO" --json
```

## Step 3: List downstream dependencies

```bash
npx @dbt-tools/cli deps model.jaffle_shop.orders \
  --dbt-target "$DEMO" --direction downstream --json
```

Use `--direction upstream` for parents.

## Step 4: Open lineage in Web

```bash
npx @dbt-tools/web --dbt-target "$DEMO"
```

Navigate to the same `unique_id` for graph and dependency panels.

## Use case: change planning

1. Run `deps --direction downstream` before editing a model.
2. Note downstream models and tests in the JSON output.
3. Coordinate dbt runs or CI with the affected subgraph.

## Common failure modes

| Symptom                  | Likely cause                           | Fix                                                                       |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------- |
| No matches from discover | Typo or wrong package                  | Try `type:model` tokens; see [Find a model](../workflows/find-a-model.md) |
| Empty downstream set     | Leaf model or snapshot-only dependency | Confirm `unique_id` in manifest                                           |

## Related docs

- [Find a model](../workflows/find-a-model.md)
- [Explain a failure](../workflows/explain-failure.md)
- [Discovery parity](../concepts/discovery-parity.md)
- [Deep links](../reference/deep-links.md)
