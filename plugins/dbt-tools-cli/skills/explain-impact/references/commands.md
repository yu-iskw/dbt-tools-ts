# explain and impact — command reference

## Availability check (always run first)

```bash
# Confirm explain is available and see its options
dbt-tools schema explain

# Confirm impact is available and see its options
dbt-tools schema impact

# Alternative: inline help
dbt-tools explain --help
dbt-tools impact --help
```

If a command is absent from `dbt-tools schema` output, it is not available in this CLI
version. Use the fallback recipes at the bottom of this file.

## Quick recipes

```bash
# Explain a resource
dbt-tools explain model.my_project.orders --dbt-target ./target

# Assess downstream impact
dbt-tools impact model.my_project.orders --dbt-target ./target

# With investigation transcript (debug / agent trace)
dbt-tools explain model.my_project.orders --dbt-target ./target --trace
dbt-tools impact model.my_project.orders --dbt-target ./target --trace
```

## Typical JSON output (explain)

Fields vary by CLI version; verify with `dbt-tools schema explain`:

```json
{
  "unique_id": "model.my_project.orders",
  "name": "orders",
  "resource_type": "model",
  "description": "Core orders model aggregating raw order data.",
  "next_actions": ["deps", "impact"],
  "primitive_commands": ["dbt-tools deps model.my_project.orders ..."]
}
```

## Typical JSON output (impact)

Fields vary by CLI version; verify with `dbt-tools schema impact`:

```json
{
  "intent": "impact",
  "contract_version": 1,
  "target": {
    "input": "model.my_project.orders",
    "resolved_unique_id": "model.my_project.orders"
  },
  "impact": {
    "upstream_count": 2,
    "downstream_count": 10,
    "critical_dependents": ["model.my_project.revenue_summary", "model.my_project.customers"]
  },
  "why_it_matters": ["high downstream fanout"],
  "next_actions": ["explain", "diagnose"],
  "primitive_commands": [
    "dbt-tools deps \"model.my_project.orders\" --direction downstream --layout flat"
  ]
}
```

Parse impact results from `impact.upstream_count`, `impact.downstream_count`, and
`impact.critical_dependents`. The resolved resource is at `target.resolved_unique_id`.

## Fallback recipes (when explain/impact are unavailable)

```bash
# Fallback for explain: ranked discovery with context
dbt-tools discover --dbt-target ./target "model.my_project.orders"

# Fallback for impact: full downstream dependency graph
dbt-tools deps model.my_project.orders --dbt-target ./target \
  --direction downstream

# Bounded fallback for impact (2 hops, names only)
dbt-tools deps model.my_project.orders --dbt-target ./target \
  --direction downstream --depth 2 --fields "unique_id,name"
```

## Decision guidance

| Goal                                       | Command                                                             |
| ------------------------------------------ | ------------------------------------------------------------------- |
| Understand what a resource does            | `explain` → fallback: `discover`                                    |
| Find affected downstream resources         | `impact` → fallback: `deps --direction downstream`                  |
| Limit impact surface to immediate children | `impact` (check if depth is supported) → fallback: `deps --depth 1` |
| Check if a command exists before running   | `dbt-tools schema <command>`                                        |

## Failure responses

| Symptom                                 | Likely cause                          | Response                                                        |
| --------------------------------------- | ------------------------------------- | --------------------------------------------------------------- |
| Command absent from `dbt-tools schema`  | Not available in this CLI version     | Use fallback recipes above.                                     |
| `VALIDATION_ERROR`: invalid resource ID | Bad format or characters in unique_id | Re-run `discover` to get a clean ID.                            |
| `ARTIFACT_BUNDLE_INCOMPLETE` on stderr  | `manifest.json` missing               | Run `dbt-tools status`; tell user to generate artifacts.        |
| Unknown option flag                     | CLI version changed                   | Check `dbt-tools schema explain` or `--help` for current flags. |
