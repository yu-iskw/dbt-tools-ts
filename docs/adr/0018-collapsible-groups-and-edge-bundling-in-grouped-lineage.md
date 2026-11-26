# ADR-0018: Collapsible groups and edge bundling in grouped lineage

Date: 2026-11-26

## Status

Accepted. Amends [ADR-0017](0017-warehouse-location-and-grouped-lineage.md) section 3.1.

## Context

[ADR-0017](0017-warehouse-location-and-grouped-lineage.md) section 3.1 says the grouped view "must
never drop, add, or re-route edges". That rule keeps grouped and ungrouped views in agreement on
dependency meaning, but it makes dense neighbourhoods unreadable. A real graph with 88 nodes and
178 edges has a selected node with about 40 cross-project edges. Quieter drawing alone cannot fix a
fan of edges that all touch the same node.

The question users ask of the grouped view is which containers depend on which, and how strongly.
That question is answered at container level. Showing every model-to-model edge buries it.

## Decision

### 1. Amendment to ADR-0017 section 3.1

The grouped view may collapse a container into one summary node and may bundle the edges between
two display nodes into one counted edge, if all of these hold:

1. **The edge list is unchanged.** The underlying edges are never modified. Expanding a container
   restores every edge it hid.
2. **Counts are conserved.** For any collapse state, bundled edges plus internal edges (both ends
   inside one collapsed container) plus individually drawn edges equal the total number of edges.
   Legend crossing counts always describe real edges, never bundles, and do not change when a
   container collapses.
3. **Direction is never changed.** A bundle has one direction. Dependencies in both directions
   between two display nodes are two bundles.
4. **Collapse is view state.** It does not change graph meaning. Ungrouped mode is unaffected and
   has no collapse.

Section 3.1 of ADR-0017 otherwise stands: grouping never adds or drops dependencies, and nodes are
never guessed into containers.

### 2. Collapse model

1. A collapsed inner container (or the "Not in warehouse" lane) becomes one summary node that
   carries its member count, resource type counts, run status roll-up, and internal edge count.
2. A bundle takes the strongest crossing tier of its member edges (outer, then inner, then none).
3. The container that holds the selected node is never collapsed. Selecting a node inside a
   collapsed container expands that container.
4. The pure model lives in the web library, takes the visible nodes, edges, group model, collapsed
   set, and selected id, and is deterministic for the same input order.

### 3. Default policy

1. A grouped graph with more than 40 nodes starts with every container collapsed except the
   container of the selected node. Containers that hold direct neighbours collapse too: on a
   real graph with 88 nodes and 178 edges, keeping them open left 11 containers open and 143
   edges drawn, while collapsing them left 27 drawn edges.
2. Smaller graphs start fully expanded.
3. The legend bar always offers **Expand all** and **Collapse others**, and states how many groups
   are collapsed and how many edges are bundled.

### 4. Web state

Collapse state is component state, like **Crossings only**. It is not in the URL. ADR-0017
section 5 and [ADR-0010](0010-shared-discovery-ranker-intent-commands-and-cli-web-deep-links.md)
make a later additive parameter possible (for example `collapse=auto`) without changing existing
links.

## Consequences

**Positive:**

- Dense graphs show a handful of container-level bundles first, and one container opens on demand.
- The conservation rule is testable as a property over any collapse set.

**Negative / risks:**

- A bundle hides which models carry the dependency until the user expands it. The count and the
  expand control are always visible.
- Default collapse can surprise users who expect to see everything. **Expand all** and the status
  line are always visible, and graphs of 40 nodes or fewer start expanded.
- Collapse state is not shareable by link until a URL parameter is added.

## Related

- [ADR-0017](0017-warehouse-location-and-grouped-lineage.md) — grouped lineage; section 3.1 amended here
- [ADR-0006](0006-timeline-includes-dbt-sources-via-snapshot-synthesis.md) — display aids do not change graph meaning
- [ADR-0010](0010-shared-discovery-ranker-intent-commands-and-cli-web-deep-links.md) — additive URL parameters
