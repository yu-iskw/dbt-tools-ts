# dbt-tools-mcp (agent plugin)

First-party plugin with **primitive agent skills** for [`@dbt-tools/mcp`](../../packages/mcp/README.md). Skills match [`plugins/dbt-tools-cli`](../dbt-tools-cli/README.md) by name; MCP tools are documented in each skill’s `references/implementation.md`.

## Bundled MCP server

[`mcp.json`](mcp.json) only starts the server:

```json
{
  "mcpServers": {
    "dbt-tools": {
      "command": "npx",
      "args": ["-y", "@dbt-tools/mcp"]
    }
  }
}
```

No `DBT_TOOLS_*` env in the bundle. Agents set the artifact root with **`dbt_tools_set_target`** (see [`bind-target`](skills/bind-target/SKILL.md)).

## Skill handles (FQH)

```text
dbt-tools-mcp:<skill-directory>
```

| Handle                             | Skill                                                      | MCP tool (current)             |
| ---------------------------------- | ---------------------------------------------------------- | ------------------------------ |
| `dbt-tools-mcp:bind-target`        | [`bind-target`](skills/bind-target/SKILL.md)               | `dbt_tools_set_target`         |
| `dbt-tools-mcp:check-session`      | [`check-session`](skills/check-session/SKILL.md)           | `dbt_tools_status`             |
| `dbt-tools-mcp:refresh-snapshot`   | [`refresh-snapshot`](skills/refresh-snapshot/SKILL.md)     | `dbt_tools_refresh`            |
| `dbt-tools-mcp:find-resources`     | [`find-resources`](skills/find-resources/SKILL.md)         | `dbt_tools_search_resources`   |
| `dbt-tools-mcp:describe-resource`  | [`describe-resource`](skills/describe-resource/SKILL.md)   | `dbt_tools_get_resource`       |
| `dbt-tools-mcp:trace-dependencies` | [`trace-dependencies`](skills/trace-dependencies/SKILL.md) | `dbt_tools_query_dependencies` |
| `dbt-tools-mcp:query-executions`   | [`query-executions`](skills/query-executions/SKILL.md)     | `dbt_tools_query_executions`   |
| `dbt-tools-mcp:summarize-run`      | [`summarize-run`](skills/summarize-run/SKILL.md)           | `dbt_tools_get_run_summary`    |

Full tool reference: [`packages/mcp/REFERENCE.md`](../../packages/mcp/REFERENCE.md).

## Configure MCP for your environment

Bundled config is intentionally minimal. Customize in **your** project MCP file (Cursor [`.cursor/mcp.json`](https://cursor.com/docs/mcp.md), Claude [`.mcp.json`](https://code.claude.com/docs/en/mcp), Codex `~/.codex/config.toml`).

| Need                       | Where                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Artifact root each session | **`dbt_tools_set_target`** (skill `bind-target`)                                                                                          |
| Same target every session  | User overlay: `"args": ["-y","@dbt-tools/mcp","--dbt-target","./target"]`                                                                 |
| GCS impersonation          | User overlay: `--gcs-impersonate-service-account` and/or `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT` (startup only; not via `set_target`) |
| S3 region / GCS project    | `--s3-region`, `--s3-endpoint`, `--gcs-project-id`, or matching `DBT_TOOLS_*` env vars                                                    |
| Package version            | `-V` / `--version` on `dbt-tools-mcp`                                                                                                     |

Example user overlay (GCS, flags preferred):

```json
{
  "mcpServers": {
    "dbt-tools": {
      "command": "npx",
      "args": [
        "-y",
        "@dbt-tools/mcp",
        "--dbt-target",
        "gs://my-bucket/dbt/prod",
        "--gcs-impersonate-service-account",
        "reader@my-project.iam.gserviceaccount.com"
      ],
      "env": {
        "DBT_TOOLS_GCS_PROJECT_ID": "my-gcp-project"
      }
    }
  }
}
```

Or set the target at runtime: omit `--dbt-target` from `args` and call `dbt_tools_set_target` with `gs://bucket/prefix` (impersonation must still be configured at MCP startup).

The same `--dbt-target` and remote client flags apply to **`dbt-tools-web`** when running the investigation UI alongside agents ([docs/site/reference/web-cli.md](../../docs/site/reference/web-cli.md)).

## When to use CLI plugin instead

- **Manifest-only** preflight (`readiness: manifest-only`) before `run_results.json` exists
- One-shot commands without enabling MCP
- CI scripts on PATH

See [`plugins/dbt-tools-cli`](../dbt-tools-cli/README.md).

## Sub-agent recipes

```text
New session: bind-target → check-session → (work)
Post dbt run: refresh-snapshot → query-executions → describe-resource
```

See [plugins/README.md](../README.md) and [plugins/CONTRIBUTING.md](../CONTRIBUTING.md).
