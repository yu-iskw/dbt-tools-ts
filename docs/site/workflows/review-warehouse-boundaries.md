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
3. Set **Group by** to **Warehouse** in the lineage toolbar. The graph draws nested boxes: the outer box is the project, database, or catalog, and the inner box is the dataset or schema.
4. Read the legend. It shows how many edges cross a dataset or schema boundary and how many cross a project, database, or catalog boundary.
5. Turn on **Crossings only** to hide everything except the nodes that touch a crossing. The selected node stays visible.
6. Copy the browser address. The URL includes `group=warehouse`, so the same grouped view opens for someone else.

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
- **No dragging.** Nodes cannot be moved in grouped mode, and **Reset layout** is hidden.
- **Default setting.** To make grouping the default, set **Lineage group by** in **Settings > Inventory Defaults**. The URL parameter overrides it.

## Next

- [Open in web](open-in-web.md)
- [Investigation tour](../guide/web/investigation-tour.md)
- [Deep links reference](../reference/deep-links.md)
