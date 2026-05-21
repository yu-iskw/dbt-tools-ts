---
name: deps
description: Trace upstream and downstream dependencies for a dbt resource using dbt-tools deps.
  Use when the user asks what a resource depends on, what uses it, or needs a build-order list.
compatibility: dbt-tools on PATH; manifest.json required under --dbt-target; unique_id must
  be known (use the discover skill first if it is not).
---

# dbt dependency tracing

**Skill handle (FQH):** `dbt-tools-cli:deps` (plugin `dbt-tools-cli`, skill directory `deps`). Use for documentation only; YAML `name` remains `deps` per [Agent Skills](https://agentskills.io/specification).

## When to use

Use this skill when the user asks:

- "What does `orders` depend on?"
- "What models use `stg_payments`?"
- "Show me the lineage for this model."
- "What would I need to run before `customers`?" (build order)
- "How deep is the dependency graph for `fact_revenue`?"

## Inputs

Identify the following before running:

- **`unique_id`** — the resource's unique identifier (e.g. `model.my_project.orders`).
  If the user gives only a name, use the [`discover`](../discover/SKILL.md) skill
  first to resolve it.
- **Direction** — `downstream` (what uses this resource; default) or `upstream` (what this
  resource depends on).
- **`--dbt-target`** — artifact directory or remote prefix; required unless
  `DBT_TOOLS_DBT_TARGET` is set.

For `gs://` / `s3://` targets and GCS impersonation, use the same `--dbt-target` and remote flags documented in [dbt-artifacts-status/references/remote-client.md](../dbt-artifacts-status/references/remote-client.md).

## Recommended pattern

```bash
# Downstream dependencies (default) — what uses this resource
dbt-tools deps model.my_project.orders --dbt-target ./target --json

# Upstream dependencies — what this resource depends on
dbt-tools deps model.my_project.orders --dbt-target ./target --direction upstream --json
```

## Output styles

| Style       | Flag                                 | When to use                                                  |
| ----------- | ------------------------------------ | ------------------------------------------------------------ |
| Tree        | (default)                            | Show hierarchical lineage; easy to read                      |
| Flat list   | `--format flat`                      | Simple list of all deps; easy to count or pipe               |
| Build order | `--direction upstream --build-order` | Topological order for upstream deps; shows what to run first |

```bash
# Flat list of all downstream deps
dbt-tools deps model.my_project.orders --dbt-target ./target --format flat --json

# Upstream deps in topological build order
dbt-tools deps model.my_project.orders --dbt-target ./target \
  --direction upstream --build-order --json
```

## Depth control

Use `--depth` to limit traversal hops:

```bash
# Immediate neighbors only (depth 1)
dbt-tools deps model.my_project.orders --dbt-target ./target --depth 1 --json

# Up to 3 hops
dbt-tools deps model.my_project.orders --dbt-target ./target --depth 3 --json
```

Omit `--depth` to return the full transitive graph.

## Bounding large graphs

For resources with wide dependency graphs, reduce output with field filtering or depth limits:

```bash
# Only return unique_id and name per node
dbt-tools deps model.my_project.orders --dbt-target ./target \
  --fields "unique_id,name" --json

# Combine depth and field filtering
dbt-tools deps model.my_project.orders --dbt-target ./target \
  --depth 2 --fields "unique_id,name" --json
```

## Failure handling

- **Invalid `unique_id`** (`VALIDATION_ERROR`): the ID contains disallowed characters or is
  not a valid format. Re-resolve with `discover` or `search`.
- **`unique_id` not found in manifest** (`VALIDATION_ERROR` or similar): the resource does not
  exist in the manifest at `--dbt-target`. Check the target or re-discover.
- **Missing manifest** (`ARTIFACT_BUNDLE_INCOMPLETE`): run `dbt-tools status --json` to confirm
  readiness.
- **Very large output**: apply `--depth` and `--fields` to bound the response.

## Completion criteria

- Dependency list (tree, flat, or build-order) delivered to the user.
- Direction and depth clearly communicated.
- For build-order queries: topological sequence returned with `--build-order`.

## Related documentation

- Command recipes and JSON shapes: [references/commands.md](references/commands.md)
- Full CLI reference: [packages/cli/README.md](../../../../packages/cli/README.md)
  (`deps` section)
- Resolving `unique_id`: [`discover`](../discover/SKILL.md) skill
- Explaining the resource once found: [`explain-impact`](../explain-impact/SKILL.md) skill
