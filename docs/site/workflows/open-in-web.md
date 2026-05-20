# Open the same context in the browser

## Outcome

A `web_url` from CLI JSON opens the web UI on the same discover query or resource you analyzed in the terminal.

## When to use this

| Surface | Use when                                                                  |
| ------- | ------------------------------------------------------------------------- |
| CLI     | You already ran `discover` or `explain` and want a shareable browser view |
| MCP     | Skip—use CLI for handoff URLs or open the web app manually                |
| Web     | Destination of the deep link                                              |

## Prerequisites

- Web app running and `DBT_TOOLS_WEB_BASE_URL` set to its origin ([deep links](../reference/deep-links.md))
- Artifacts under `target/` ([overview](../guide/overview.md))

## Steps

1. Start `dbt-tools-web` and export `DBT_TOOLS_WEB_BASE_URL`.
2. Run `discover` or `explain` with `--json`.
3. Copy `web_url` from the JSON payload into a browser (or follow the human “Open in web” line).

## Example

```bash
export DBT_TOOLS_WEB_BASE_URL=http://127.0.0.1:5173
dbt-tools discover --dbt-target ./target "orders" --json
dbt-tools explain model.my_project.orders --dbt-target ./target --json
```

## Next

- [Investigation tour](../guide/web/investigation-tour.md)
- [Deep links](../reference/deep-links.md)
- [Find a model](find-a-model.md)
