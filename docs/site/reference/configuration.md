# Configuration

dbt-tools packages are configured primarily through command-line flags. There is no global configuration file.

## CLI Configuration

The `@dbt-tools/cli` accepts the following flags:

| Flag | Description | Default |
|------|-------------|---------|
| `--dbt-target <path>` | Path to the dbt target directory | Required |

## MCP Server Configuration

The `@dbt-tools/mcp` server accepts the following flags:

| Flag | Description | Default |
|------|-------------|---------|
| `--dbt-target <path>` | Path to the dbt target directory | Required |

## Web UI Configuration

The `@dbt-tools/web` server accepts the following flags:

| Flag | Description | Default |
|------|-------------|---------|
| `--target <path>` | Path to the dbt target directory | Required |
| `--port <number>` | Port for the local server | `3000` |

## Environment Variables

No environment variables are currently required. Configuration is passed through command-line arguments.

## Target Directory

All tools expect the dbt target directory to contain:

- `manifest.json` — required for model graph and metadata
- `run_results.json` — required for run status (some commands may work without it)

The tools read these files at startup. To reflect a new dbt run, restart the tool or use a watch mode if available.
