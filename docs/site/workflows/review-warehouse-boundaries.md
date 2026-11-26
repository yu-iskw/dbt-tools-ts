# Review warehouse boundaries in lineage

## Outcome

You can see which resources sit in which database, project, catalog, or schema, and which lineage edges cross those boundaries. You can share the view with a link.

## When to use this

- You want to know whether a model reads from another database, project, or catalog.
- You are planning a move of models between schemas or datasets and need the cross-boundary dependencies first.
- You want a quick check of where data crosses warehouse locations before a review.

## Steps

1. Open **Inventory** in the web UI.
2. Select a resource, then open the **Lineage** tab.
3. Set **Group by** to **Warehouse**. The control sits in the header of the Lineage graph card, next to **Expand lineage**, and is also in the expanded view. The graph draws nested boxes: the outer box is the project, database, or catalog, and the inner box is the dataset or schema.
4. Read the legend. It shows how many edges cross a dataset or schema boundary and how many cross a project, database, or catalog boundary.
5. Turn on **Crossings only** to hide everything except the nodes that touch a crossing. The selected node stays visible.
6. In a large graph, read the bundles first. See [Collapse containers and read bundles](#collapse-containers-and-read-bundles).
7. Copy the browser address. The URL includes `group=warehouse`, so the same grouped view opens for someone else.

## Collapse containers and read bundles

A grouped graph with more than 40 nodes opens with most containers collapsed. Each collapsed container is one dashed card that shows its name, how many resources it holds, their types, and a roll-up of their run status. Every container is collapsed except the one holding the selected node, so the selected node's neighbours show as counted bundles. Smaller graphs open fully expanded.

Edges between collapsed containers, or between a collapsed container and a visible node, merge into one **bundle**. A bundle has the same direction and crossing colour as the edges it holds, gets thicker as it holds more edges, and shows a count such as **×4**.

- **Open one container:** select its card, or select its header (the chevron on the right of the box label).
- **Open both ends of a bundle:** select the count on the bundle.
- **Collapse a container:** select its header. The container that holds the selected node never collapses.
- **Change everything at once:** use **Collapse others** or **Expand all** in the legend bar. The status line there reads, for example, `4 groups collapsed, 96 edges bundled`.

Bundling only changes what is drawn. The legend crossing counts always count real edges, so they do not change when you collapse or expand. Collapse state is not in the URL, so a shared link opens with the default for that graph size.

## What the boxes mean

The outer and inner containers come from the manifest `database` and `schema` of each resource and its `metadata.adapter_type`. Nothing calls the warehouse.

| Adapter                       | Outer box (crosses project/database) | Inner box (crosses dataset/schema) |
| ----------------------------- | ------------------------------------ | ---------------------------------- |
| BigQuery                      | Project                              | Dataset                            |
| Snowflake, Redshift, Postgres | Database                             | Schema                             |
| DuckDB, Databricks, Trino     | Catalog                              | Schema                             |
| Athena                        | Data catalog                         | Glue database                      |
| Spark                         | None (single schema level)           | Schema                             |

Edge colours: edges that cross an inner box are teal and dashed. Edges that cross an outer box use a stronger warning colour.

Resources with no physical location, such as exposures, metrics, semantic models, macros, and ephemeral models, sit in a dashed **Not in warehouse** lane. Their edges never count as crossings.

## Limits

- **Neighbourhood only.** The graph shows the selected resource's neighbourhood at depth 1 to 3. To see the broadest view, set the depth to **All**. The graph does not show the whole project unless you do that.
- **Layout is taller.** Each dataset or schema gets its own vertical band, so a grouped graph is taller than an ungrouped one.
- **Collapse is per view.** Expanding a container restores every edge it hid. Collapse state resets when you select another resource.
- **No dragging.** Nodes cannot be moved in grouped mode, and **Reset layout** is hidden.
- **Default setting.** To make grouping the default, set **Lineage group by** in **Settings > Inventory Defaults**. The URL parameter overrides it.

## Next

- [Open in web](open-in-web.md)
- [Investigation tour](../guide/web/investigation-tour.md)
- [Deep links reference](../reference/deep-links.md)
