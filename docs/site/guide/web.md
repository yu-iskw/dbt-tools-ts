# @dbt-tools/web

`@dbt-tools/web` is a browser-based UI for exploring dbt artifacts interactively.

## Quick Start

Run without installing using `npx`:

```bash
npx @dbt-tools/web --target ./target
```

This starts a local web server and opens a browser window where you can explore your dbt project's models, runs, and metadata.

## Features

- Visual model status dashboard
- Run result inspection
- dbt artifact browsing
- Graph exploration

## Options

| Flag | Description |
|------|-------------|
| `--target <path>` | Path to the dbt target directory |
| `--port <number>` | Local server port (default: 3000) |

## Development

To run the web UI from source in the monorepo:

```bash
pnpm dev:web
```
