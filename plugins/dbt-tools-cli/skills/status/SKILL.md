---
name: status
description: Check dbt artifact readiness with dbt-tools status—pre-flight gate before analysis
  or investigation of presence, freshness, and readiness. Use before deps, discover,
  query-executions, or when the user asks if artifacts exist.
compatibility: dbt-tools on PATH; local, s3://, or gs:// target.
---

# dbt-tools status

**Skill handle (FQH):** `dbt-tools-cli:status` (plugin `dbt-tools-cli`, skill directory `status`). Use for documentation only; YAML `name` remains `status` per [Agent Skills](https://agentskills.io/specification).

## Readiness gate (run first)

Use before **`@dbt-tools/cli`** commands that read **`manifest.json`**, **`run_results.json`**, or both—unless the user has already confirmed artifacts at known paths.

Run the gate **before** `deps`, `inventory`, `search`, `summary`, `graph`, `timeline`, `query-executions`, `run-summary`, `discover`, or similar analysis. Use it in a new workspace, CI, or after missing-file errors.

Prefer **JSON on stdout** and **structured JSON errors** (pass **`--json`** for both):

```bash
dbt-tools status --dbt-target ./target --json
```

When **`DBT_TOOLS_DBT_TARGET`** is set:

```bash
dbt-tools status --json
```

Parse **`readiness`**, **`manifest.path`**, **`run_results.path`**, and **`target_dir`** (local path or temp download for remote targets). Command availability by level: [references/readiness.md](references/readiness.md).

### Branching rules

- If **`readiness` is `unavailable`**: do not run manifest-based analysis. Stop and tell the user **`manifest.path`** was not found (or run `dbt` to produce artifacts). Only `status` / `freshness` is meaningful until a manifest exists.
- If **`readiness` is `manifest-only`**: you may run commands that need only the manifest. Do **not** run **`timeline`**, **`query-executions`**, or **`run-summary`** (they require `run_results.json`). See [references/readiness.md](references/readiness.md).
- If **`readiness` is `full`**: manifest and run-result based commands are allowed, subject to normal CLI validation and parsing errors.

**Caveat:** for **local** `--dbt-target`, `status` only **stats** files in that directory. For **`s3://`** / **`gs://`** targets it **downloads** the same fixed keys as other commands, then reports stats on the temp files (see CLI README).

### Sub-agent contract

When delegating to a sub-agent whose job is **only** readiness:

1. Run `dbt-tools status --json` with the same **`--dbt-target`** / **`DBT_TOOLS_DBT_TARGET`** you will use for downstream commands.
2. Return the **parsed JSON** (or the raw stdout line) to the parent. The parent should pass at least **`readiness`**, **`target_dir`**, **`manifest.path`**, and **`run_results.path`** into downstream steps.

Downstream sub-agents (search, deps, run forensics) should assume this contract and **not** re-guess artifact locations.

## Investigation (user questions)

Use when the user asks:

- "Do my dbt artifacts exist at `./target`?"
- "Are my artifacts stale or up to date?"
- "When was the manifest last generated?"
- "Is the target directory ready for analysis?"
- "Check the freshness of my dbt artifacts."

### Inputs

- **`--dbt-target`** — local directory path, `s3://bucket/prefix`, or `gs://bucket/prefix`; or **`DBT_TOOLS_DBT_TARGET`** when set.

`freshness` is an alias:

```bash
dbt-tools freshness --dbt-target ./target --json
```

Always pass **`--json`** when you need to parse the result programmatically.

### Interpreting results

| Field                     | What to surface to the user                                         |
| ------------------------- | ------------------------------------------------------------------- |
| `readiness`               | `full` · `manifest-only` · `unavailable` (see below)                |
| `manifest.exists`         | Whether `manifest.json` was found                                   |
| `manifest.modified_at`    | ISO-8601 timestamp of last modification                             |
| `manifest.age_seconds`    | Age in seconds at command run time                                  |
| `run_results.exists`      | Whether `run_results.json` was found                                |
| `run_results.modified_at` | ISO-8601 timestamp                                                  |
| `run_results.age_seconds` | Age in seconds                                                      |
| `summary`                 | Human-readable one-liner from the CLI (repeat to the user verbatim) |

**`readiness` values:**

| Value           | Meaning                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| `full`          | `manifest.json` and `run_results.json` are both present. All analysis commands usable. |
| `manifest-only` | `manifest.json` found; `run_results.json` missing. Run-result commands unavailable.    |
| `unavailable`   | `manifest.json` not found. Most analysis commands will fail.                           |

### Failure handling

- **Target directory not found or no artifacts**: `readiness` will be `unavailable`; tell the user which path was checked (`target_dir` field) and suggest running `dbt` to generate artifacts.
- **Remote fetch error** (`s3://` / `gs://`): structured JSON on stderr when `--json` is passed; check `error.code` (typically `ARTIFACT_BUNDLE_INCOMPLETE` or `UNKNOWN_ERROR`).
- **Missing `--dbt-target` and env var not set**: the CLI exits with a validation error asking you to pass `--dbt-target`.

When `--json` is set, structured errors appear on stderr:

```json
{
  "error": "ArtifactBundleResolutionError",
  "code": "ARTIFACT_BUNDLE_INCOMPLETE",
  "message": "...",
  "details": { "target": "./target", "missing": ["manifest.json"], "found": [] }
}
```

### Completion criteria

- `readiness` value reported to the user.
- Age of the most-recent artifact surfaced (use `age_seconds` or `modified_at`).
- Path that was checked (`target_dir`) mentioned so the user can confirm the right location.

## Related documentation

- Command options and JSON output shape: [references/commands.md](references/commands.md)
- Readiness command matrix: [references/readiness.md](references/readiness.md)
- Full CLI reference: [packages/cli/README.md](../../../../packages/cli/README.md) (`status` / `freshness` section)
