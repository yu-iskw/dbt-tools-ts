# Open CLI result in Web

See [Deep links](../reference/deep-links.md) for the canonical URL shapes. This recipe walks through the handoff.

## When to use this

Use this recipe to move from a CLI JSON result directly to the Web UI for the same resource. The Web UI provides lineage graphs, execution timelines, and visual context that are hard to interpret from JSON alone.

## Inputs required

- `manifest.json` and `run_results.json` under a target directory
- `dbt-tools-web` running locally (same `--dbt-target` as the CLI command)

## How deep links work

When `DBT_TOOLS_WEB_BASE_URL` is set, CLI JSON output includes a top-level `web_url` that opens the web workspace with query parameters (`view`, `resource`, `q`, and so on)—not path-style `/resources/...` URLs.

Start the web app and export its origin (no trailing path; use the URL the server prints):

```bash
npx @dbt-tools/web --dbt-target ./target
export DBT_TOOLS_WEB_BASE_URL=http://127.0.0.1:3000
```

Default **serve** port is **3000**. Vite **dev** (`pnpm dev:web` from the monorepo) often uses **5173**—set the variable to match your running instance.

## Step 1: Get the web_url from explain output

```bash
npx @dbt-tools/cli explain model.my_project.orders --dbt-target ./target --json \
  | jq -r '.web_url'
```

Example shape:

```text
http://127.0.0.1:3000/?view=inventory&resource=model.my_project.orders&assetTab=summary
```

## Step 2: Get the web_url from discover output

```bash
npx @dbt-tools/cli discover --dbt-target ./target "orders" --json \
  | jq -r '.web_url'
```

Discover puts `web_url` on the **top-level** JSON object (inventory view with the discover query), not on each match in `matches`.

Example shape:

```text
http://127.0.0.1:3000/?view=inventory&q=orders
```

## Step 3: Open the runs view

```text
http://127.0.0.1:3000/?view=runs
```

## Step 4 (optional): Automate the handoff

On macOS, pipe the `web_url` directly to `open`:

```bash
npx @dbt-tools/cli explain model.my_project.orders --dbt-target ./target --json \
  | jq -r '.web_url' \
  | xargs open
```

On Linux with a desktop environment, use `xdg-open`:

```bash
npx @dbt-tools/cli explain model.my_project.orders --dbt-target ./target --json \
  | jq -r '.web_url' \
  | xargs xdg-open
```

## Configuration reference

| Variable                 | Description                            | Example                 |
| ------------------------ | -------------------------------------- | ----------------------- |
| `DBT_TOOLS_WEB_BASE_URL` | Origin of the running Web UI (no path) | `http://127.0.0.1:3000` |

This is the **web app** origin, not the GitHub Pages docs base (`/dbt-tools-ts/` on the published site).

## Common failure modes

| Symptom                             | Likely cause                                 | Fix                                                                           |
| ----------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| `web_url` field missing from output | `DBT_TOOLS_WEB_BASE_URL` not set             | Export the variable before running CLI commands                               |
| Web UI not reachable                | `dbt-tools-web` not running                  | Start it with `npx @dbt-tools/web --dbt-target ./target`                      |
| Resource not found in Web UI        | Different `--dbt-target` between CLI and Web | Use the same directory for both                                               |
| Broken link after click             | Base URL includes `/dbt-tools-ts` or a path  | Use the web server origin only (see [Deep links](../reference/deep-links.md)) |

## Related

- [Debug a failed run](./debug-failed-run.md) — jump from failure JSON to visual context
- [Investigation tour](../guide/web/investigation-tour.md) — what the Web UI shows
- [Deep links](../reference/deep-links.md) — full deep link URL patterns
- [Configuration reference](../reference/configuration.md)
