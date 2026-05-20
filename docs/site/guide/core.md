# @dbt-tools/core

`@dbt-tools/core` is the shared parsing and analysis library used by all other dbt-tools packages.

## What it provides

- Typed parsers for `manifest.json`, `run_results.json`, and related dbt artifact schemas
- Graph traversal utilities for the dbt node dependency graph
- Deterministic scoring and status aggregation logic
- Shared TypeScript types consumed by `@dbt-tools/cli`, `@dbt-tools/mcp`, and `@dbt-tools/web`

## Usage

`@dbt-tools/core` is not intended for direct end-user installation. It is a library dependency of the other packages. If you are building a custom integration, you may depend on it directly:

```bash
npm install @dbt-tools/core
```

```ts
import { parseManifest } from "@dbt-tools/core";

const manifest = await parseManifest("./target/manifest.json");
```

## Parser Boundary

dbt artifact parsing is delegated to the `dbt-artifacts-parser` npm package. `@dbt-tools/core` adds typed wrappers and analysis logic on top of those parsed structures.
