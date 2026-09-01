# CLI to web deep links

When the CLI and web UI run against the same project, you can jump from terminal output into the investigation UI without retyping queries.

## Setup

1. Start the published web app and note its origin (default **http://127.0.0.1:3000**).

```bash
npx @dbt-tools/web --dbt-target ./target
```

Vite **dev** (`pnpm dev:web`) uses **5173**—set the base URL to whatever origin the process printed.

2. Export the base URL (no trailing path):

```bash
export DBT_TOOLS_WEB_BASE_URL=http://127.0.0.1:3000
```

3. Run CLI commands with `--json`. When the base URL is set, JSON includes **`web_url`** and **`review_url`** (same target for `discover`, `explain`, and `impact`). Human output can append an “Open in web” line.

## URL shapes

The CLI builds query-string URLs aligned with the web workspace. All three land in **Inventory**:

| Command   | Typical `web_url` / `review_url` params                                      |
| --------- | ---------------------------------------------------------------------------- |
| `discover` | `view=inventory` and `q=` (omitted only when there is no query string to pass) |
| `explain`  | `view=inventory`, `resource=<unique_id>`, `assetTab=summary`                 |
| `impact`   | `view=inventory`, `resource=<unique_id>`, `assetTab=lineage`                 |

Example discover:

```text
http://127.0.0.1:3000/?view=inventory&q=orders
```

Example explain:

```text
http://127.0.0.1:3000/?view=inventory&resource=model.my_project.orders&assetTab=summary
```

Example impact:

```text
http://127.0.0.1:3000/?view=inventory&resource=model.my_project.orders&assetTab=lineage
```

You can also open **`?view=timeline`** and **`?view=runs`** by hand.

## Extra params (compact)

| Param      | View                         | Values / notes                                                                                          |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `assetTab` | Inventory                    | `summary`, `lineage`, `tests`, `sql`                                                                    |
| `kind`     | Runs                         | `all`, `models`, `tests`, `seeds`, `snapshots`, `operations`                                            |
| `adapter`  | Runs                         | Omit to show warehouse columns when data exists; `adapter=0` hides them                                 |
| `up`/`down` | Inventory Lineage tab       | Upstream / downstream hop depths                                                                        |

Full query-string contract: [Web README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md). CLI `web_url` / `review_url` fields: [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) (discover section).

## Workflow

See [Open the same context in the browser](../workflows/open-in-web.md).

## Learn more

- [Discovery parity](../concepts/discovery-parity.md)
- [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) — discover section
