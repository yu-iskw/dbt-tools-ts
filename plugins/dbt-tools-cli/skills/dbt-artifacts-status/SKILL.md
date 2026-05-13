---
name: dbt-artifacts-status
description: Check local dbt artifact readiness with dbt-tools status before running manifest- or run_results-based analysis; interpret readiness and branch.
---

# dbt artifacts status (readiness gate)

**Skill handle (FQH):** `dbt-tools-cli:dbt-artifacts-status` (plugin `dbt-tools-cli`, skill directory `dbt-artifacts-status`). Use for documentation only; YAML `name` remains `dbt-artifacts-status` per [Agent Skills](https://agentskills.io/specification).

## When to use

Use this workflow whenever you are about to run **`@dbt-tools/cli`** commands that read **`manifest.json`**, **`run_results.json`**, or both—unless the user has already confirmed those artifacts exist at known paths.

Run the gate **before** `deps`, `inventory`, `search`, `summary`, `graph`, `timeline`, `run-report`, or similar analysis. Use it when working in a new workspace, CI, or after errors like missing files.

## Commands

Prefer **explicit JSON on stdout** and **structured JSON errors** (pass **`--json`** for both):

```bash
dbt-tools status --dbt-target ./target --json
```

When **`DBT_TOOLS_DBT_TARGET`** is set, you can omit the flag:

```bash
export DBT_TOOLS_DBT_TARGET=./target
dbt-tools status --json
```

## Interpret `readiness`

Parse the JSON object printed to stdout. The gate depends on **`readiness`** and on **`manifest.path`**, **`run_results.path`**, and **`target_dir`** (resolved directory or temp download directory for remote targets).

- **Value meanings** (`full`, `manifest-only`, `unavailable`) and **which CLI commands are safe** at each level: [references/readiness.md](references/readiness.md).
- **Field-level** output for users (ages, `summary`, stderr JSON shapes): [`status`](../status/SKILL.md) investigation skill.

## Branching rules

- If **`readiness` is `unavailable`**: do not run manifest-based analysis. Stop and tell the user **`manifest.path`** was not found (or run `dbt` to produce artifacts). Only `status` / `freshness` is meaningful until a manifest exists.
- If **`readiness` is `manifest-only`**: you may run commands that need only the manifest. Do **not** run **`timeline`** or **`run-report`** (they require `run_results.json`). See the matrix in [references/readiness.md](references/readiness.md).
- If **`readiness` is `full`**: manifest and run-result based commands are allowed, subject to normal CLI validation and parsing errors.

**Caveat:** for **local** `--dbt-target`, `status` only **stats** files in that directory. For **`s3://`** / **`gs://`** targets it **downloads** the same fixed keys as other commands, then reports stats on the temp files (see CLI README).

## Sub-agent contract

When delegating to a sub-agent whose job is **only** readiness:

1. Run `dbt-tools status --json` with the same **`--dbt-target`** / **`DBT_TOOLS_DBT_TARGET`** you will use for downstream commands.
2. Return the **parsed JSON** (or the raw stdout line) to the parent. The parent should pass at least **`readiness`**, **`target_dir`**, **`manifest.path`**, and **`run_results.path`** into downstream steps.

Downstream sub-agents (search, deps, run forensics) should assume this contract and **not** re-guess artifact locations.

## Related documentation

- Full CLI reference and options: [packages/cli/README.md](../../../../packages/cli/README.md) (`status` / `freshness` section).
- Agents and errors: [packages/cli/README.md](../../../../packages/cli/README.md).
