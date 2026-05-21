# bind-target — CLI implementation

| Primitive   | Current CLI                                               | Notes                                                |
| ----------- | --------------------------------------------------------- | ---------------------------------------------------- |
| bind-target | `--dbt-target <path\|s3://…\|gs://…>` on **each** command | Or `export DBT_TOOLS_DBT_TARGET=…` and omit the flag |

## Recipes

```bash
export DBT_TOOLS_DBT_TARGET=./target

# Explicit flag (equivalent)
dbt-tools status --dbt-target ./target --json
dbt-tools status --dbt-target s3://my-bucket/dbt/prod --json
```

Use the **same** target for the entire agent session. Remote credentials follow AWS/GCP client chains; optional `DBT_TOOLS_GCS_*` / `DBT_TOOLS_S3_*` for provider options — see [packages/cli/README.md](../../../../../packages/cli/README.md).
