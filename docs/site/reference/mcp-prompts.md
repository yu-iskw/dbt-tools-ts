# MCP prompts

Curated **prompts** are user-invoked workflow templates. Each prompt returns short instructions for the model to follow using existing tools and `dbt-tools://` resources.

## Prompt catalog

| Prompt                       | Required args | Optional args                                                           | Purpose                              |
| ---------------------------- | ------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| `triage_dbt_run`             | —             | `focus`: `failures` \| `performance` \| `cost` \| `all`; `limit`: 1–100 | Failures, skips, bottlenecks         |
| `analyze_model_blast_radius` | `uniqueId`    | `direction`: `upstream` \| `downstream`; `depth`: integer ≥ 1           | Upstream/downstream impact           |
| `inspect_dbt_resource`       | `uniqueId`    | `includeSql`: boolean                                                   | Compact resource review              |
| `optimize_dbt_run`           | —             | `focus`: `runtime` \| `cost` \| `balanced`; `limit`: 1–100              | Runtime/cost optimization candidates |
| `review_artifact_snapshot`   | —             | —                                                                       | Freshness and cache health           |

Defaults when omitted: `triage_dbt_run` uses `focus=all` and `limit=10`; `analyze_model_blast_radius` uses `direction=downstream`; `optimize_dbt_run` uses `focus=balanced` and `limit=10`. `inspect_dbt_resource` does not fetch SQL unless `includeSql` is true.

Prompts are workflow templates, not extra tools. Tool inputs and examples: [MCP tools](./mcp-tools.md) and [`packages/mcp/REFERENCE.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/REFERENCE.md).

## Client support

Clients without prompts continue using tools directly. Prompt text references both resource URIs and tool names for compatibility.

## Safety

Prompts instruct the model not to run dbt, modify project files, or treat heuristics as authoritative. SQL is not embedded by default.
