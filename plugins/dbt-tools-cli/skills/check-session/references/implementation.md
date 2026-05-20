# check-session — CLI implementation

| Primitive     | Current CLI               | Notes                             |
| ------------- | ------------------------- | --------------------------------- |
| check-session | `dbt-tools status --json` | `dbt-tools freshness` is an alias |

## Recipes

```bash
dbt-tools status --dbt-target ./target --json
```

## Key JSON fields

| Field                      | Use                                      |
| -------------------------- | ---------------------------------------- |
| `readiness`                | `full` · `manifest-only` · `unavailable` |
| `target_dir`               | Resolved path checked                    |
| `manifest` / `run_results` | `exists`, `modified_at`, `age_seconds`   |
| `summary`                  | Repeat verbatim to the user              |

Primitive availability by `readiness`: [readiness.md](readiness.md).
