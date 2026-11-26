# ADR-0017: Warehouse location and grouped lineage

Date: 2026-11-26

## Status

Accepted

## Context

Lineage views show resources as flat boxes. Users investigating a large project need to see
which lineage edges cross a warehouse container boundary (a BigQuery project or dataset, a
Snowflake database or schema, a DuckDB catalog, and so on). Deriving that grouping in the web
UI would mean each surface re-parses `relation_name` and re-decides adapter quirks, which
risks drift between CLI, MCP, and web, and would make `relation_name` quoting a hidden
dependency.

[ADR-0003](0003-large-manifest-web-performance-dependency-index-and-lazy-sql.md) requires
cross-surface execution semantics to be normalized in `@dbt-tools/core`, not re-derived in UI
code. [ADR-0006](0006-timeline-includes-dbt-sources-via-snapshot-synthesis.md) requires display
aids to leave graph meaning unchanged.

## Decision

### 1. Warehouse location is normalized in core

1. Each resource node may carry an adapter-aware `warehouseLocation`: an ordered list of
   container levels, outer first, plus the relation identifier.
2. The location is built from manifest `database`, `schema`, and alias fields, with
   `metadata.adapter_type` selecting the level names. Adapter mappings are:

   | Adapter                       | Levels (outer > inner)       |
   | ----------------------------- | ---------------------------- |
   | BigQuery                      | project > dataset            |
   | Snowflake, Redshift, Postgres | database > schema            |
   | DuckDB, Databricks, Trino     | catalog > schema             |
   | Athena                        | data catalog > Glue database |
   | Spark                         | schema only                  |
   | Unknown adapter               | database > schema (fallback) |

3. `relation_name` is never parsed. Its quoting is adapter-specific, so the structured manifest
   fields are the only input.
4. Sources carry `database`, `schema`, and `identifier` like other relations and are located
   the same way.
5. Resources with no physical relation have no location: exposures, metrics, semantic models,
   macros, tests, and ephemeral models.

### 2. Boundary crossings are core-owned semantics

For an edge between two located resources, core classifies it as:

- `outer`: the two resources have different outer containers.
- `inner`: the same outer container, but different inner containers.
- `none`: otherwise.

An edge with an unlocated endpoint is never a crossing. Surfaces must consume this
classification rather than recompute it.

### 3. Grouped lineage is a display aid

1. The grouped view may relocate and enclose nodes. It must never drop, add, or re-route edges
   or change edge direction, so the graph keeps the meaning defined by
   [ADR-0006](0006-timeline-includes-dbt-sources-via-snapshot-synthesis.md). Amended by
   [ADR-0018](0018-collapsible-groups-and-edge-bundling-in-grouped-lineage.md), which allows
   collapsing containers and bundling edges under conservation rules.
2. Sources stay first-class nodes inside their containers.
3. Resources without a location go to a separate "Not in warehouse" lane rather than being
   dropped or guessed into a container.

### 4. Layout: custom band layout, no new dependency

1. The grouped layout places each inner container in its own vertical band on top of the
   existing rank columns. Boxes in different containers therefore cannot overlap.
2. No graph-layout dependency is added.
3. Rejected for now:
   - **elkjs compound layout:** better edge routing, but a large dependency under a dual
     EPL-2.0 OR GPL-3.0 license that needs an owner decision, plus worker and bundle cost.
   - **Swimlane grid:** breaks the left-to-right dependency flow.

   Revisit the band layout if dense graphs become unreadable.

### 5. Web state

1. Lineage view state gains `groupBy: 'none' | 'warehouse'`.
2. The URL parameter `group=warehouse` is additive. Existing links are unchanged, and the
   default is `none`.
3. A saved default lives in workspace preferences.

### 6. Scope

The grouped view applies to the selected-resource lineage neighbourhood, consistent with the
current lineage graph. It is not a whole-project map. A whole-project overview, or a list or
matrix of crossings, is a possible follow-up and is not part of this decision.

## Consequences

**Positive:**

- Adapter location rules live in one place and can be reused by CLI and MCP later without
  changing the web contract.
- Crossing semantics are defined once and testable in core.
- Edges are never hidden or altered by grouping, so the grouped and ungrouped views agree
  on dependency meaning.

**Negative / risks:**

- Grouped graphs are taller than ungrouped ones because each container needs its own band.
- Dragging is disabled in grouped mode.
- Named labels exist for BigQuery, Snowflake, DuckDB, Databricks, Redshift, Postgres, Trino,
  Athena, and Spark. Only DuckDB is covered by a real artifact fixture. The other adapters
  are covered only by synthetic unit tests, so their labels are less proven.
- Adapter mappings need maintenance as warehouses change how they name containers.

## Related

- [ADR-0003](0003-large-manifest-web-performance-dependency-index-and-lazy-sql.md) — normalized shared semantics belong in core
- [ADR-0006](0006-timeline-includes-dbt-sources-via-snapshot-synthesis.md) — display aids do not change graph meaning
- [ADR-0010](0010-shared-discovery-ranker-intent-commands-and-cli-web-deep-links.md) — shared contracts across CLI and web
