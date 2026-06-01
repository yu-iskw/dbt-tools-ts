# MCP prompts

Curated **prompts** are user-invoked workflow templates. Each prompt returns short instructions for the model to follow using existing tools and `dbt-tools://` resources.

## Prompt catalog

| Prompt                       | Required args | Purpose                              |
| ---------------------------- | ------------- | ------------------------------------ |
| `triage_dbt_run`             | —             | Failures, skips, bottlenecks         |
| `analyze_model_blast_radius` | `uniqueId`    | Upstream/downstream impact           |
| `inspect_dbt_resource`       | `uniqueId`    | Compact resource review              |
| `optimize_dbt_run`           | —             | Runtime/cost optimization candidates |
| `review_artifact_snapshot`   | —             | Freshness and cache health           |

Optional arguments are documented in [packages/mcp/REFERENCE.md](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/REFERENCE.md).

## Client support

Clients without prompts continue using tools directly. Prompt text references both resource URIs and tool names for compatibility.

## Safety

Prompts instruct the model not to run dbt, modify project files, or treat heuristics as authoritative. SQL is not embedded by default.
