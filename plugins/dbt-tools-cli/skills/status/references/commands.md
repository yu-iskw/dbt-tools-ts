# status — command reference

## Quick recipes

```bash
# Local target — JSON output
dbt-tools status --dbt-target ./target --json

# Remote S3 target
dbt-tools status --dbt-target s3://my-bucket/dbt/prod --json

# Remote GCS target
dbt-tools status --dbt-target gs://my-bucket/dbt/prod --json

# Using environment variable (omit --dbt-target)
export DBT_TOOLS_DBT_TARGET=./target
dbt-tools status --json

# freshness is an alias for status
dbt-tools freshness --dbt-target ./target --json
```

## JSON output shape

```json
{
  "target_dir": "./target",
  "manifest": {
    "path": "/project/target/manifest.json",
    "exists": true,
    "modified_at": "2024-01-15T10:00:00Z",
    "age_seconds": 3600
  },
  "run_results": {
    "path": "/project/target/run_results.json",
    "exists": true,
    "modified_at": "2024-01-15T10:01:00Z",
    "age_seconds": 3540
  },
  "readiness": "full",
  "latest_modified_at": "2024-01-15T10:01:00Z",
  "age_seconds": 3540,
  "summary": "All artifacts present. Manifest and execution analysis available."
}
```

**`readiness` values:** `full` · `manifest-only` · `unavailable`

## Decision guidance

| `readiness`     | Agent action                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `full`          | All analysis commands available; report `age_seconds` to user.                                  |
| `manifest-only` | Manifest-only commands (deps, search, inventory, discover) available; skip run-result commands. |
| `unavailable`   | No analysis possible; tell user to run `dbt` to generate artifacts at the checked path.         |

## Failure responses

| Symptom                                            | Likely cause                          | Response                                                         |
| -------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `readiness: unavailable`                           | `manifest.json` absent at target path | Report `target_dir`; suggest running `dbt compile` or `dbt run`. |
| JSON error on stderr: `ARTIFACT_BUNDLE_INCOMPLETE` | Target dir exists but files missing   | Same as above; show `details.missing`.                           |
| Error: `--dbt-target` required                     | Neither flag nor env var was set      | Ask user to provide the artifact directory path.                 |
| Remote fetch error (`s3://`/`gs://`)               | Credentials or path wrong             | Check `error.message`; verify bucket/prefix and credentials.     |

## Notes

- For **local** targets, `status` only stats files — it does not parse artifact JSON.
- For **remote** targets (`s3://`, `gs://`), the CLI downloads the files first, then stats the temp copies.
- `--fields` is **not** supported on `status`; the output is always the full readiness object.
- `dbt-tools schema status` returns the runtime option schema if you need to verify available flags.
