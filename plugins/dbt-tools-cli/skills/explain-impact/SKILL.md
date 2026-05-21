---
name: explain-impact
description: Explain a selected dbt resource and reason about its change impact using
  dbt-tools explain and dbt-tools impact. Use when the user wants to understand what a
  resource does or how a change to it ripples downstream. Check availability with
  dbt-tools schema before assuming commands exist.
compatibility: dbt-tools on PATH; manifest.json required under --dbt-target; explain
  and impact availability varies by CLI version — verify with dbt-tools schema or --help.
---

# dbt resource explanation and impact analysis

**Skill handle (FQH):** `dbt-tools-cli:explain-impact` (plugin `dbt-tools-cli`, skill directory `explain-impact`). Use for documentation only; YAML `name` remains `explain-impact` per [Agent Skills](https://agentskills.io/specification).

## When to use

Use this skill when the user asks:

- "What does `orders` do?"
- "Explain the `stg_payments` model."
- "What would happen if I change `customers`?"
- "Which downstream models are affected by a change to `raw_orders`?"
- "Show me the impact surface for this model."

## Availability check (do this first)

`explain` and `impact` are newer commands whose options may vary by CLI version. Before
running them, confirm they are available:

```bash
dbt-tools schema explain
dbt-tools schema impact
```

If either command is absent from `dbt-tools schema`, use the fallback pattern described
below. You can also check:

```bash
dbt-tools explain --help
dbt-tools impact --help
```

## Inputs

Identify the following before running:

- **`unique_id`** — the resource's unique identifier (e.g. `model.my_project.orders`).
  If unknown, use the [`discover`](../discover/SKILL.md) skill first.
- **`--dbt-target`** — artifact directory or remote prefix; required unless
  `DBT_TOOLS_DBT_TARGET` is set.

For `gs://` / `s3://` targets and GCS impersonation, use the same `--dbt-target` and remote flags documented in [dbt-artifacts-status/references/remote-client.md](../dbt-artifacts-status/references/remote-client.md).

## Workflow

1. **Check availability** with `dbt-tools schema explain` and `dbt-tools schema impact`.
2. **Explain the resource** — run `dbt-tools explain <unique_id> --dbt-target ./target --json`.
3. **Assess impact** — run `dbt-tools impact <unique_id> --dbt-target ./target --json`.
4. **Synthesize** — combine the explanation and impact surface into a clear summary for the user.

If either command is unavailable, skip to the **Fallback pattern** section.

## Recommended pattern

```bash
# Explain a resource
dbt-tools explain model.my_project.orders --dbt-target ./target --json

# Assess downstream impact
dbt-tools impact model.my_project.orders --dbt-target ./target --json

# Add --trace for investigation transcript (useful for debugging)
dbt-tools explain model.my_project.orders --dbt-target ./target --json --trace
```

## Interpreting results

**`explain` output** typically includes:

- Resource description and metadata
- Lineage context (position in the graph)
- `next_actions` or `primitive_commands` for follow-up investigation

**`impact` output** typically includes:

- Downstream resources that would be affected by a change
- Propagation depth and breadth

Check `dbt-tools schema explain` and `dbt-tools schema impact` to see the exact fields
available in your installed CLI version.

## Fallback pattern

When `explain` or `impact` are not available, compose equivalent workflows from stable commands:

```bash
# Fallback for explain: use discover to get description and context
dbt-tools discover --dbt-target ./target "<name or unique_id>" --json

# Fallback for impact: use deps to enumerate the downstream surface
dbt-tools deps <unique_id> --dbt-target ./target --direction downstream --json

# For a bounded view of immediate downstream impact only
dbt-tools deps <unique_id> --dbt-target ./target --direction downstream --depth 2 --json
```

The `discover` command returns `reasons`, `related`, `next_actions`, and `primitive_commands`
that together approximate an explanation. The `deps` downstream graph approximates an impact
surface.

## Failure handling

- **Command not in `dbt-tools schema`**: use the fallback pattern above.
- **`VALIDATION_ERROR`**: invalid `unique_id`; re-run `discover` to get a clean ID.
- **`ARTIFACT_BUNDLE_INCOMPLETE`**: `manifest.json` missing; run `dbt-tools status --json`.
- **Uncertain options**: run `dbt-tools explain --help` or `dbt-tools schema explain` to
  inspect available flags rather than guessing.

## Completion criteria

- Resource explained (purpose, lineage context, key description).
- Impact surface described (list of downstream resources or a scoped subgraph).
- If fallback was used, noted explicitly to the user.

## Related documentation

- Command recipes and fallback recipes: [references/commands.md](references/commands.md)
- Full CLI reference: [packages/cli/README.md](../../../../packages/cli/README.md)
- Resolving `unique_id`: [`discover`](../discover/SKILL.md) skill
- Dependency tracing: [`deps`](../deps/SKILL.md) skill
