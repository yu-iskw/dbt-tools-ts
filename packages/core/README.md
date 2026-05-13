# @dbt-tools/core

**Composable analysis substrate** for dbt artifacts: the reusable **analysis engine** behind [`@dbt-tools/cli`](../cli/README.md) and [`@dbt-tools/web`](../web/README.md). Use it directly when you need programmatic dependency graphs, execution analysis (critical path, timelines, bottlenecks), graph exports, readiness-oriented snapshots, or building custom workflows on top of the same logic as the shipped tools. Product positioning: [ADR-0008](../../docs/adr/0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md).

---

## Architecture

```mermaid
graph TD
  AF["dbt-artifacts-parser\nparseManifest · parseRunResults"]
  AF --> AL["ArtifactLoader"]
  AL --> MG["ManifestGraph\ngraphology DAG"]
  AL --> EA["ExecutionAnalyzer\ncritical path · Gantt"]
  MG --> DS["DependencyService\nupstream · downstream · build order"]
  MG --> GE["GraphExport\nJSON · DOT · GEXF"]
  EA --> OF["OutputFormatter\nfield filtering · JSON/text"]
  OF --> FF["FieldFilter"]
```

---

## Installation

This package is a **TypeScript library** — there is no CLI binary. For the command line use [`@dbt-tools/cli`](../cli/README.md) (`dbt-tools`); for the browser UI use [`@dbt-tools/web`](../web/README.md) (`dbt-tools-web`).

```bash
pnpm add @dbt-tools/core
```

---

## Usage

```typescript
import { parseManifest } from 'dbt-artifacts-parser/manifest';
import { ManifestGraph, ExecutionAnalyzer } from '@dbt-tools/core';

// Build dependency graph
const manifest = parseManifest(manifestJson);
const graph = new ManifestGraph(manifest);

// Summary statistics
const summary = graph.getSummary();
console.log(`Nodes: ${summary.total_nodes}, Cycles: ${summary.has_cycles}`);

// Dependency traversal
const upstream = graph.getUpstream('model.my_project.my_model');
const downstream = graph.getDownstream('model.my_project.my_model');

// Execution analysis
const analyzer = new ExecutionAnalyzer(runResults, manifest);
const report = analyzer.getSummary();
console.log(`Critical path: ${report.critical_path.map((n) => n.name).join(' → ')}`);
```

---

## Exports

### Node.js (default)

```typescript
import {
  // Analysis
  ManifestGraph,
  ExecutionAnalyzer,
  DependencyService,
  SqlAnalyzer,
  RunResultsSearch,
  AnalysisSnapshot,
  // I/O
  ArtifactLoader,
  // Validation
  InputValidator,
  // Formatting
  OutputFormatter,
  FieldFilter,
  GraphExport,
  // Errors
  ErrorHandler,
  // Introspection
  SchemaGenerator,
} from '@dbt-tools/core';
```

### Browser (no Node.js dependencies)

For use in browser environments (e.g. web workers in `@dbt-tools/web`):

```typescript
import {
  ManifestGraph,
  ExecutionAnalyzer,
  RunResultsSearch,
  AnalysisSnapshot,
} from '@dbt-tools/core/browser';
```

---

## Environment helpers (Node)

The Node entry re-exports configuration readers from [`src/config/dbt-tools-env.ts`](./src/config/dbt-tools-env.ts), including `getDbtToolsTargetDirFromEnv`, `getDbtToolsReloadDebounceMs`, `isDbtToolsWatchEnabled`, and **`getDbtToolsRemoteSourceConfigFromEnv`** with types **`DbtToolsRemoteSourceConfig`** / **`DbtToolsRemoteSourceProvider`**.

`DBT_TOOLS_REMOTE_SOURCE` is consumed by the **`@dbt-tools/web`** Vite middleware (not the browser). For operators, see [`@dbt-tools/web`](../web/README.md) and [ADR-0004](../../docs/adr/0004-remote-object-storage-artifact-sources-and-auto-reload.md).

---

## API

### ManifestGraph

Builds a directed acyclic graph (DAG) from a parsed dbt manifest using [graphology](https://graphology.github.io/).

| Method                          | Description                                                             |
| ------------------------------- | ----------------------------------------------------------------------- |
| `getGraph()`                    | Returns the underlying `graphology` `DirectedGraph`                     |
| `getSummary()`                  | Returns `{ total_nodes, total_edges, has_cycles, node_counts_by_type }` |
| `getUpstream(nodeId, depth?)`   | All nodes that `nodeId` depends on (transitive, optional depth limit)   |
| `getDownstream(nodeId, depth?)` | All nodes that depend on `nodeId` (transitive, optional depth limit)    |

### ExecutionAnalyzer

Analyzes dbt execution results to compute critical paths and bottlenecks.

| Method                | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `getSummary()`        | Returns execution summary with critical path, total time, slowest nodes |
| `getNodeExecutions()` | Per-node execution details (status, duration, thread)                   |
| `getGanttData()`      | Gantt chart data for timeline visualization                             |

### DependencyService

Higher-level dependency queries with build-order support.

| Method                                 | Description                                   |
| -------------------------------------- | --------------------------------------------- |
| `getUpstreamBuildOrder(nodeId)`        | Topological ordering of upstream dependencies |
| `getDependencyTree(nodeId, direction)` | Nested tree structure of dependencies         |

### ArtifactLoader

Loads dbt artifact files from disk.

```typescript
import { ArtifactLoader } from '@dbt-tools/core';

const loader = new ArtifactLoader({ targetDir: './target' });
const manifest = await loader.loadManifest();
const runResults = await loader.loadRunResults();
```

### InputValidator

Validates user-supplied strings against common injection patterns (path traversal, control characters, URL encoding tricks).

### OutputFormatter / FieldFilter

Formats analysis output as JSON or human-readable text. `FieldFilter` limits output to a specified set of fields (useful for smaller API responses, logs, and agent/tool prompts).

### GraphExport

Exports the dependency graph in multiple formats:

- `json` — nodes and edges as JSON
- `dot` — Graphviz DOT format
- `gexf` — GEXF format (for Gephi and other tools)

### ErrorHandler

Standardized error wrapping with typed error codes (`VALIDATION_ERROR`, `FILE_NOT_FOUND`, `PARSE_ERROR`, `UNSUPPORTED_VERSION`, `UNKNOWN_ERROR`).

### SchemaGenerator

Runtime introspection — generates machine-readable schemas for CLI commands. Used by `@dbt-tools/cli schema`.

---

## Performance

`ManifestGraph` uses graphology's adjacency-list representation and is optimized for large manifests with 100k+ nodes.

---

## Development

```bash
pnpm build
pnpm test
```

See [AGENTS.md](../../AGENTS.md) for the full developer guide.

---

## License

The `@dbt-tools/*` packages use a **custom source-available license**; they are **not** OSI “open source.” The following is a **short summary** — the binding terms are in the **`LICENSE`** file at the root of each published npm package (`package.json` uses `SEE LICENSE IN LICENSE`).

- **You may** use and modify the software for **personal use** and for **internal use** within your organization for your own business purposes, **provided** you do not offer a **commercial service** where the software (or a derivative intended to replace or substantially replicate the published `@dbt-tools/*` packages) is a material part of the value you sell or deliver to third parties (for example hosted access, resale, or client production work centered on operating the software — see `LICENSE` for definitions).
- **You may not**, without **prior written permission** from the copyright holder, offer such a **commercial service**, or **publish** the software or that kind of derivative to a **package registry** (npm, GitHub Packages, and similar) for third-party consumption.
- **Dependencies** such as **`dbt-artifacts-parser`** remain under **their own** licenses (**Apache-2.0** for that library). This license does not override them.
