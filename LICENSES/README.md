# Repository license map

This repository contains source-available `@dbt-tools/*` packages and may contain shared repository infrastructure. Use this file as the authoritative map of which paths fall under which terms. Automated tools, including GitHub license detection, may not reflect path-level licensing correctly.

| Scope                                                                                                                                                                   | License                                            | Full text                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`packages/core/`](../packages/core/), [`packages/cli/`](../packages/cli/), [`packages/web/`](../packages/web/) (`@dbt-tools/core`, `@dbt-tools/cli`, `@dbt-tools/web`) | **Source-available** (custom; not OSI open source) | [`../packages/LICENSE`](../packages/LICENSE)                                                                                                     |
| Shared repository infrastructure (for example root [`scripts/`](../scripts/), top-level docs, and tool configuration)                                                   | **Not a single license**                           | Per-file headers and the licenses of the packages you build or publish apply to shipped artifacts. For anything unclear, contact the maintainer. |

`dbt-artifacts-parser` is an external npm dependency of these packages and remains under its own Apache-2.0 license. This repository does not contain the parser package source.
