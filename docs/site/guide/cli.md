# @dbt-tools/cli

`@dbt-tools/cli` is the command-line interface for querying dbt artifacts.

## Installation

Run without installing using `npx`:

```bash
npx @dbt-tools/cli --help
```

Or install globally:

```bash
npm install -g @dbt-tools/cli
```

## Usage

Point the CLI at a dbt target directory containing `manifest.json` and `run_results.json`:

```bash
dbt-tools status --dbt-target ./target
```

## Common Commands

| Command | Description |
|---------|-------------|
| `status` | Show model run status from the latest run results |
| `models` | List models from the manifest |

## Options

| Flag | Description |
|------|-------------|
| `--dbt-target <path>` | Path to the dbt target directory |
| `--help` | Show help |

## Examples

```bash
# Show status of all models in the last run
npx @dbt-tools/cli status --dbt-target ./target

# List all models defined in the manifest
npx @dbt-tools/cli models --dbt-target ./target
```
