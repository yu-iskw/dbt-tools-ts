# Open CLI result in Web

## When to use this

Use this recipe to move from a CLI JSON result directly to the Web UI for the same resource. The Web UI provides lineage graphs, execution timelines, and visual context that are hard to interpret from JSON alone.

## Inputs required

- `manifest.json` and `run_results.json` under a target directory
- `dbt-tools-web` running locally (same `--dbt-target` as the CLI command)

## How deep links work

When `DBT_TOOLS_WEB_BASE_URL` is set, CLI JSON output includes a `web_url` field that links directly to the corresponding resource or view in the Web UI.

Set the base URL before running CLI commands:

```bash
export DBT_TOOLS_WEB_BASE_URL=http://localhost:3000/dbt-tools-ts
```

Then open the Web UI in another terminal:

```bash
npx @dbt-tools/web --dbt-target ./target
```

## Step 1: Get the web_url from explain output

```bash
npx @dbt-tools/cli explain model.my_project.orders --dbt-target ./target --json \
  | jq -r '.web_url'
```

This returns a URL such as `http://localhost:3000/dbt-tools-ts/resources/model.my_project.orders`. Open it in your browser.

## Step 2: Get the web_url from discover output

```bash
npx @dbt-tools/cli discover --dbt-target ./target "orders" --json \
  | jq -r '.results[0].web_url'
```

Discover returns a list of matching resources. Each result includes a `web_url` if the base URL is configured.

## Step 3: Open the run status view

Navigate to the root of the Web UI to see the overall run health view:

```
http://localhost:3000/dbt-tools-ts/
```

Or open the run results view directly:

```
http://localhost:3000/dbt-tools-ts/runs
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

| Variable | Description | Example |
|---|---|---|
| `DBT_TOOLS_WEB_BASE_URL` | Base URL of the running Web UI instance | `http://localhost:3000/dbt-tools-ts` |

The Web UI base path includes the VitePress base (`/dbt-tools-ts/`) when running locally. If you deploy the Web UI under a different path, adjust the variable accordingly.

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `web_url` field missing from output | `DBT_TOOLS_WEB_BASE_URL` not set | Export the variable before running CLI commands |
| Web UI not reachable | `dbt-tools-web` not running | Start it with `npx @dbt-tools/web --dbt-target ./target` |
| Resource not found in Web UI | Different `--dbt-target` between CLI and Web | Use the same directory for both |

## Related

- [Debug a failed run](./debug-failed-run.md) — jump from failure JSON to visual context
- [Investigation tour](../guide/web/investigation-tour.md) — what the Web UI shows
- [Deep links reference](../reference/deep-links.md) — full deep link URL patterns
- [Configuration reference](../reference/configuration.md)
