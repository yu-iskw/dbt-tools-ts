# dbt-tools published docs diagrams

Glossary for end-user diagrams on the VitePress GitHub Pages site (`docs/site/`). Implementation details stay out of this file.

## Language

**Asset diagram**:
A vector figure checked into the repository as an `.svg` file and referenced from site markdown. The published site shows that file; it is not generated at view time from Mermaid or similar.
_Avoid_: Live diagram, Mermaid diagram (when meaning a checked-in SVG), illustration (when meaning structural orientation)

**Orientation diagram**:
An asset diagram whose job is to show how major pieces relate (artifacts, surfaces, boundaries) so a new reader can place themselves.
_Avoid_: Architecture dump, system landscape (when meaning end-user orientation)

**Mechanics diagram**:
An asset diagram whose job is to show a short causal or request path (how something flows), not the full ops or deploy map.
_Avoid_: Sequence for every edge case, ops map

**Artifact-flow archetype**:
The first orientation diagram to ship: dbt produces a target of artifacts; CLI, MCP, and Web consume that same contract. Used to prove the authoring and publish path before adding more diagrams.
_Avoid_: Various diagrams, ecosystem collage, treating agent skills as an artifact consumer

**Pages-only diagram**:
A diagram that lives under `docs/site/` for end users of CLI, MCP, Web, and agent skills. It is not an ADR or contributor-architecture figure.
_Avoid_: ADR diagram on Pages, shared internal architecture library

**Diagram asset path**:
Checked-in site diagrams live under `docs/site/public/diagrams/` and are referenced with root-absolute paths such as `/diagrams/artifact-flow.svg` (VitePress `base` applies).
_Avoid_: Colocating structural diagrams next to markdown, scattering SVGs only in `public/` root

**Artifact-flow diagram**:
The first Pages-only orientation asset: `artifact-flow.svg`, embedded on `concepts/dbt-artifacts.md`. It shows dbt producing a target of `manifest.json` and `run_results.json`, then a peer fan-out to CLI, MCP, and Web (the surfaces that read artifacts). Caption notes coding agents use agent skills that invoke CLI or MCP; skills do not read artifacts (see surface-routing for invoke edges). Left-to-right layout with an opaque light canvas and white-on-purple labels. Hand-authored, editable SVG markup. Embedded as `![alt](/diagrams/artifact-flow.svg)` plus one caption sentence. Replaces the Mermaid fence on that page.
_Avoid_: Status badges on the figure, remote URI variants on the figure, duplicate Mermaid + SVG, package names on the fan-out boxes, generic “Agents” wording, agent skills as a peer artifact reader

**Diagrams README**:
A short process note at `docs/site/public/diagrams/README.md` describing path, naming, light fills, and hand-authored SVG rules for site diagrams. Not a glossary; not an `AGENTS.md` dump.
_Avoid_: Putting diagram process into `CONTEXT.md` or growing `AGENTS.md` for this

**Hybrid five**:
Five Pages-only asset diagrams shipped with the artifact-flow archetype in one delivery (six figures on the site): discovery-flow, local-remote-target, surface-routing, open-in-web, explain-blast-radius.
_Avoid_: Quota filler, MCP session-bind as a substitute for explain-blast-radius, redrawing artifact-flow as “ecosystem”, stacked PRs required for this set

**Discovery-flow diagram**:
Mechanics diagram on `concepts/discovery-parity.md` (`discovery-flow.svg`): a discovery query yields ranked matches with reasons shared by CLI, MCP, and Web (coding agents use the same contract via CLI or MCP).
_Avoid_: Full search UI mock, token grammar reference art

**Local-remote-target diagram**:
Orientation diagram on `concepts/local-and-remote-artifacts.md` (`local-remote-target.svg`): the same `manifest.json` / `run_results.json` pair under a local path or an `s3://` / `gs://` prefix. Labels use ASCII (`s3://...`, `gs://...`) so SVG XML stays valid.
_Avoid_: Full credential matrix, IAM walkthrough figure, web-upload branch on the figure

**Surface-routing diagram**:
Orientation diagram on `guide/agents/cli-vs-mcp-vs-skills.md` (`surface-routing.svg`): agent skills/plugins invoke CLI or MCP; CLI, MCP, and Web each use shared analysis (`@dbt-tools/core`); Web is a sibling surface, not driven by CLI or MCP.
_Avoid_: Duplicate of artifact-flow, CLI/MCP arrows into Web as a handoff destination, package-name soup

**Open-in-web diagram**:
Mechanics diagram on `workflows/open-in-web.md` (`open-in-web.svg`): with `DBT_TOOLS_WEB_BASE_URL` set, CLI discover/explain `--json` yields `web_url`; a browser opens that deep link into the Web UI. Not a product-layer call from CLI to Web.
_Avoid_: Full deep-link query-param encyclopedia, MCP in the figure

**Explain-blast-radius diagram**:
Mechanics diagram on `workflows/explain-failure.md` (`explain-blast-radius.svg`): unique*id → explain → downstream deps as blast radius.
\_Avoid*: Full lineage product screenshot, every deps flag
