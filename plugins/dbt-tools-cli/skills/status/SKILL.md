---
name: status
description: Check dbt artifact presence, freshness, and readiness under a target directory
  using dbt-tools status. Use when the user asks whether artifacts exist, how old they are,
  or whether they are ready for analysis.
compatibility: dbt-tools on PATH; a dbt artifact directory or remote prefix (s3:// or gs://).
---

# dbt artifacts status (investigation)

**Skill handle (FQH):** `dbt-tools-cli:status` (plugin `dbt-tools-cli`, skill directory `status`). Use for documentation only; YAML `name` remains `status` per [Agent Skills](https://agentskills.io/specification).

## When to use

Use this skill when the user asks:

- "Do my dbt artifacts exist at `./target`?"
- "Are my artifacts stale or up to date?"
- "When was the manifest last generated?"
- "Is the target directory ready for analysis?"
- "Check the freshness of my dbt artifacts."

This skill is a standalone investigation tool focused on presence and freshness. For a
pre-flight gate that blocks other commands until artifacts are confirmed, see the
[`dbt-artifacts-status`](../dbt-artifacts-status/SKILL.md) skill instead.

## Inputs

Identify the following before running:

- **`--dbt-target`** — local directory path, `s3://bucket/prefix`, or `gs://bucket/prefix`;
  use the `DBT_TOOLS_DBT_TARGET` environment variable when it is already set in the
  user's environment.

## Recommended pattern

```bash
dbt-tools status --dbt-target ./target --json
```

`freshness` is an alias:

```bash
dbt-tools freshness --dbt-target ./target --json
```

When `DBT_TOOLS_DBT_TARGET` is set:

```bash
dbt-tools status --json
```

Always pass **`--json`** when you need to parse the result programmatically.

## Interpreting results

Parse the JSON object on stdout:

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

For a full matrix of which CLI commands are safe to run by readiness level, see
[`../dbt-artifacts-status/references/readiness.md`](../dbt-artifacts-status/references/readiness.md).

## Failure handling

- **Target directory not found or no artifacts**: `readiness` will be `unavailable`; tell the
  user which path was checked (`target_dir` field) and suggest running `dbt` to generate artifacts.
- **Remote fetch error** (`s3://` / `gs://`): structured JSON on stderr when `--json` is passed;
  check `error.code` (typically `ARTIFACT_BUNDLE_INCOMPLETE` or `UNKNOWN_ERROR`).
- **Missing `--dbt-target` and env var not set**: the CLI exits with a validation error asking
  you to pass `--dbt-target`.

When `--json` is set, structured errors appear on stderr:

```json
{
  "error": "ArtifactBundleResolutionError",
  "code": "ARTIFACT_BUNDLE_INCOMPLETE",
  "message": "...",
  "details": { "target": "./target", "missing": ["manifest.json"], "found": [] }
}
```

## Completion criteria

- `readiness` value reported to the user.
- Age of the most-recent artifact surfaced (use `age_seconds` or `modified_at`).
- Path that was checked (`target_dir`) mentioned so the user can confirm the right location.

## Related documentation

- Command options and JSON output shape: [references/commands.md](references/commands.md)
- Full CLI reference: [packages/cli/README.md](../../../../packages/cli/README.md)
  (`status / freshness` section)
- Pre-flight gate use-case: [`dbt-artifacts-status`](../dbt-artifacts-status/SKILL.md)
