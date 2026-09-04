# Site diagram assets

Checked-in SVG diagrams for the VitePress GitHub Pages site (`docs/site/`).

## Path and URLs

- Store structural diagrams here: `docs/site/public/diagrams/`.
- Reference them from markdown with root-absolute paths, for example `/diagrams/artifact-flow.svg`.
- VitePress `base` (`/dbt-tools-ts/`) applies the same way as `/logo.svg`.
- Local `markdown-link-check` maps `/diagrams/` to these files via `.markdown-link-check.json` `replacementPatterns` (Trunk passes `-c`).

Brand chrome (logo, favicon, decorative motifs) may stay under `docs/site/public/` root; prefer this folder for orientation and mechanics figures.

## Naming

- Use `kebab-case` filenames (`artifact-flow.svg`).
- Prefer names that state the story (`artifact-flow`, not `diagram-1`).
- Orientation diagrams show how major pieces relate; mechanics diagrams show a short causal path. See `CONTEXT.md` at the repo root for glossary terms.

## Authoring

- Hand-author editable SVG markup (`<rect>`, `<text>`, `<line>` / simple paths). Avoid opaque exports that are hard to diff.
- Start each SVG with a full-`viewBox` opaque canvas fill `#F6F7FB` so dark-mode page backgrounds do not show through `<img>` embeds.
- On purple (`#635BFF`) fills, use `#FFFFFF` for all text (no pale secondary purple-on-purple).
- Use `#64748B` only for strokes and labels on the opaque light canvas.
- Keep labels as real `<text>` so they stay selectable and searchable.
- On the published site, prefer **coding agent** / **agent skills** wording over generic “Agents”.
- Embed with markdown `![alt](/diagrams/….svg)` plus a short caption when the figure needs a caveat the pixels should not carry alone.

Do not grow `AGENTS.md` with diagram process; keep glossary in `CONTEXT.md` and process here.
