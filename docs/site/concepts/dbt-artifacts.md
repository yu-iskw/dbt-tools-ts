# dbt Artifacts

dbt-tools analyzes structured outputs from dbt runs. The primary inputs are:

| Artifact                        | Role                                                |
| ------------------------------- | --------------------------------------------------- |
| `manifest.json`                 | Project graph: models, sources, tests, dependencies |
| `run_results.json`              | Execution timing, status, and per-node results      |
| `catalog.json` / `sources.json` | Optional metadata when present                      |

## Target layout

Tools expect a **dbt target directory** (typically `./target`) with `manifest.json` and `run_results.json` at the root of that location. Remote object storage follows the same one-pair-per-location contract—see [Local and remote artifacts](./local-and-remote-artifacts.md).

## Parsing boundary

Artifact parsing and type definitions come from the external **`dbt-artifacts-parser`** npm package. This repository owns analysis, CLI, MCP, and web layers on top of that parser.

## Safe examples

Documentation and public sites must use **synthetic** project names and metadata. Do not paste real warehouse credentials, customer data, or production manifests into examples.
