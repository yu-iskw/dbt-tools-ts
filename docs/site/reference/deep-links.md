# CLI to web deep links

When the CLI and web UI run against the same project, you can jump from terminal output into the investigation UI without retyping queries.

## Setup

1. Start the web app and note its origin (for example `http://127.0.0.1:5173`).

```bash
npx @dbt-tools/web --target ./target
```

2. Export the base URL (no trailing path required):

```bash
export DBT_TOOLS_WEB_BASE_URL=http://127.0.0.1:5173
```

3. Run CLI commands with `--json`. When the base URL is set, JSON may include `web_url` and `review_url`; human output can append an “Open in web” line.

## URL shapes

The CLI builds query-string URLs aligned with the web workspace:

| Command    | Typical `web_url` params                                                      |
| ---------- | ----------------------------------------------------------------------------- |
| `discover` | `view=inventory` and `q=` (discover query; omitted for filter-only discovery) |
| `explain`  | `view=inventory`, `resource=<unique_id>`, `assetTab=summary`                  |

Example discover output (conceptual):

```text
http://127.0.0.1:5173/?view=inventory&q=orders
```

Example explain output (conceptual):

```text
http://127.0.0.1:5173/?view=inventory&resource=model.my_project.orders&assetTab=summary
```

Downstream impact in the web UI uses lineage tab semantics (`assetTab=lineage`) in helpers—pair CLI `deps --direction downstream` with the web lineage view when handoff links are enabled for impact-style flows.

## Workflow

See [Open the same context in the browser](../workflows/open-in-web.md).

## Learn more

- [ADR-0010 — shared discovery and deep links](https://github.com/yu-iskw/dbt-tools-ts/blob/main/docs/adr/0010-shared-discovery-ranker-intent-commands-and-cli-web-deep-links.md)
- [Discovery parity](../concepts/discovery-parity.md)
- [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) — discover section
