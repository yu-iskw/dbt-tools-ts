# Readiness and command availability

`dbt-tools status` sets **`readiness`** from **`manifest.json`** and **`run_results.json`** (and optional **`catalog.json`** / **`sources.json`**) under the resolved **`--dbt-target`**. For **local** roots it **stats** those paths in place. For **`s3://`** / **`gs://`** roots it **resolves the bundle** (download) first, then stats the resulting temp paths—use the same **`DBT_TOOLS_REMOTE_SOURCE`** / credentials as other CLI commands.

## Matrix

| `readiness`     | Safe to run (typical)                                                                 | Avoid / expect failure                                                                                |
| --------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `full`          | `summary`, `graph`, `deps`, `inventory`, `search`, `timeline`, `run-report`, `status` | —                                                                                                     |
| `manifest-only` | `summary`, `graph`, `deps`, `inventory`, `search`, `status`                           | `timeline`, `run-report` (require `run_results.json`)                                                 |
| `unavailable`   | `status` (and `freshness` alias)                                                      | `summary`, `graph`, `deps`, `inventory`, `search`, `timeline`, `run-report` (require `manifest.json`) |

## Notes

- **`schema`** introspection does not require artifacts; it describes the CLI itself.
- Commands that need **`catalog.json`** (for example `graph --field-level`) still require a valid **`manifest.json`** path first; readiness `unavailable` means those flows are blocked until a manifest exists.
- If artifacts are not under `./target`, pass **`--dbt-target <dir>`** or set **`DBT_TOOLS_DBT_TARGET`** consistently for `status` and all follow-up commands.
