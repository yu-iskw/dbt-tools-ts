# Web app styles (`@dbt-tools/web`)

## Import order

`src/index.css` is the only stylesheet entry from `main.tsx`. It imports slices in this order:

1. **`tokens.css`** — `:root`, `[data-theme="dark"]`, and CSS variable aliases only.
2. **`base.css`** — global element rules (`*`, `html`, `body`, etc.).
3. **`app-shell.css`** — layout shell (sidebar, frame, header) and many analyzer/landing rules that sat **before** the lineage section in the original monolith. Shell and workspace selectors are interleaved there on purpose: **cascade order matches the old `index.css`**.
4. **`ui-primitives.css`** — spinner, skeleton, tooltip, toast, empty state, plus blocks that followed them in the monolith (sidebar link icons, signals, upload/overview landing). Kept in one file to avoid reordering rules.
5. **`lineage-graph.css`** — dependency graph, lineage viewport, graph toolbars/menus.
6. **`workspace.css`** — explorer tree, overview modules/bands, type donut, shared legend rows.

Do not change `@import` order without checking for specificity/cascade regressions.

## CSS ↔ TypeScript colors

`src/constants/themeColors.generated.ts` is **auto-generated** from `tokens.css` by `pnpm tokens:sync` (script: `scripts/sync-css-tokens-to-ts.mjs`). When you change any token in `tokens.css`, run `pnpm tokens:sync` and commit the generated file. CI verifies freshness via `pnpm tokens:check`.

Canvas, SVG, and chart code that cannot use CSS `var()` should import from `themeColors.generated.ts`.

The **legacy** manual mirror `src/constants/themeColors.ts` remains for existing consumers (status hex maps, canvas colors, resource-type fills) that have not yet been migrated to the generated file.

## Status colors in TypeScript

**`src/constants/colors.ts`** defines `STATUS_COLORS` and helpers (`getStatusColor`, `getResourceTypeColor`) for execution/run status and resource-type accents. Chart code uses **`getStatusTonePalette`** from `src/lib/analysis-workspace/constants.ts` for **StatusTone**-aligned palettes (Gantt legend, donuts, etc.).
