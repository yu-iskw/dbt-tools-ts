---
name: discover
description: Find dbt resources by name, type, tag, package, path, or approximate user wording
  using dbt-tools discover or dbt-tools search. Use when you need to resolve a unique_id
  before running deps, explain, or impact commands.
compatibility: dbt-tools on PATH; manifest.json required under --dbt-target.
---

# dbt resource discovery and search

**Skill handle (FQH):** `dbt-tools-cli:discover` (plugin `dbt-tools-cli`, skill directory `discover`). Use for documentation only; YAML `name` remains `discover` per [Agent Skills](https://agentskills.io/specification).

## When to use

Use this skill when the user:

- Names a resource approximately ("the orders model", "something with the finance tag")
- Asks you to find models, sources, tests, or seeds by type, tag, package, or path substring
- Needs a `unique_id` to pass to `deps`, `explain`, or `impact`
- Is uncertain which resources exist in the project

## Inputs

Identify the following before running:

- **Query** — the user's approximate resource name, keyword, or description; may be empty when
  filtering by type/tag alone
- **Filters** — optional `--type`, `--tag`, `--package`, `--path` to narrow results
- **`--dbt-target`** — artifact directory or remote prefix; required unless
  `DBT_TOOLS_DBT_TARGET` is set

## `discover` vs `search`

Both commands accept the same query token syntax and flag-based filters.

| Feature                     | `discover`                                 | `search`               |
| --------------------------- | ------------------------------------------ | ---------------------- |
| Ranked scoring              | Yes (`score`, `confidence`)                | No                     |
| Reasons for each match      | Yes (`reasons` array)                      | No                     |
| Disambiguation peers        | Yes (`disambiguation`)                     | No                     |
| Suggested next steps        | Yes (`next_actions`, `primitive_commands`) | No                     |
| Requires `run_results.json` | No (manifest-only)                         | No (manifest-only)     |
| Best for agents             | Yes — prefer when parsing output           | Simpler filter queries |

**Prefer `discover`** when you need scores, reasons, and suggested follow-up commands in JSON.
Use `search` for straightforward filter-only queries where ranking is not needed.

## Recommended pattern

```bash
# Ranked discovery — best for agents resolving a unique_id
dbt-tools discover --dbt-target ./target "orders"

# Filter-only (no query text needed)
dbt-tools discover --dbt-target ./target --type model

# Simple search when discover is not available or needed
dbt-tools search --dbt-target ./target "orders"
```

Use **`--limit`** to keep response size manageable:

```bash
dbt-tools discover --dbt-target ./target "orders" --limit 10
```

## Inline token syntax (both commands)

Embed filters directly in the query string:

| Token           | Meaning              |
| --------------- | -------------------- |
| `type:model`    | Filter to models     |
| `type:source`   | Filter to sources    |
| `tag:finance`   | Filter by tag        |
| `package:core`  | Filter by package    |
| `source:stripe` | Match as a text term |

Example: `dbt-tools discover --dbt-target ./target "type:model finance"`

Flag-based filters (`--type`, `--tag`, `--package`, `--path`) take precedence over inline tokens.

## Extracting `unique_id`

From **`discover`** JSON output, candidates are under `matches[].unique_id`:

```json
{
  "matches": [
    {
      "unique_id": "model.my_project.orders",
      "score": 0.95,
      "confidence": "high"
    }
  ]
}
```

From **`search`** JSON output, candidates are under `results[].unique_id`:

```json
{
  "results": [{ "unique_id": "model.my_project.orders" }]
}
```

When `confidence` is `high` and only one match is returned, use that `unique_id` directly.
When multiple matches are returned, surface the top candidates to the user and ask them to
confirm before proceeding.

## Handling zero or ambiguous results

- **Zero results**: broaden the query (remove type/tag filters, try a shorter term), or try
  `dbt-tools inventory --dbt-target ./target --type model` to browse all resources.
- **Ambiguous results** (`discover` may include a `disambiguation` array): surface the
  `disambiguation` peers to the user for manual selection.
- **Too many results**: use `--limit 10` to page; inspect `has_more` and `total` in the JSON
  to decide whether to page further (`--offset`).

## Failure handling

- **Missing manifest** (`ARTIFACT_BUNDLE_INCOMPLETE`): run `dbt-tools status` to check
  readiness, then tell the user which file is missing.
- **Invalid query tokens** (`VALIDATION_ERROR`): strip special characters from the query.
- **Zero matches with no error**: result is valid; broaden the search as described above.

## Completion criteria

- One or more candidate `unique_id` values resolved.
- If a single high-confidence match was found, pass its `unique_id` to the next command.
- If multiple candidates were found, confirm with the user before proceeding.

## Related documentation

- Command recipes and JSON shapes: [references/commands.md](references/commands.md)
- Full CLI reference: [packages/cli/README.md](../../../../packages/cli/README.md)
  (`discover` and `search` sections)
- Next step after discovery: [`deps`](../deps/SKILL.md) skill
