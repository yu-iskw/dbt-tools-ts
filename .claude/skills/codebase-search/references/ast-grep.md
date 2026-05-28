# ast-grep — structural search

Official reference: [ast-grep docs](https://ast-grep.github.io/) (`sg run --help`, `sg scan --help`).

CLI name is **`sg`**; [`mise.toml`](../../../../mise.toml) also exposes `ast-grep` (same binary). Prefer **`sg run`** for one-shot exploration.

**Agent defaults:** `-l typescript` or `-l tsx`; `--json=stream --color=never --heading=never` (requires `=` after `--json`).

## Metavariables

From [pattern syntax](https://ast-grep.github.io/guide/pattern-syntax.html):

| Pattern | Matches |
| ------- | ------- |
| `$NAME` | One named AST node (uppercase after `$`) |
| `$$OP` | One unnamed node (operators, punctuation) |
| `$$$REST` | Zero or more nodes (args, statements, import specifiers) |

Patterns must be **valid, parseable code** — not regex.

## Examples (this monorepo)

```bash
# Class declarations (include body — `export class $NAME` alone matches nothing)
sg run -p 'class $NAME { $$$ }' -l typescript packages/core/src/errors \
  --json=stream --color=never --heading=never

# Import statements with captured module path
sg run -p 'import { $$$ } from $MOD' -l typescript packages/mcp/src/server.ts \
  --json=stream --color=never --heading=never

# Exported functions (include return type and body in pattern)
sg run -p 'export function $NAME($$$ARGS): $RET { $$$BODY }' -l typescript packages/core/src \
  --globs 'packages/core/src/**/*.ts' --globs '!**/*.test.ts' \
  --json=stream --color=never --heading=never

# Paths only
sg run -p 'interface $NAME { $$$ }' -l typescript packages/mcp/src \
  --files-with-matches --color=never
```

## Key flags

| Flag | Purpose |
| ---- | ------- |
| `-p`, `--pattern` | AST pattern |
| `-l`, `--lang` | Language (`typescript`, `tsx`, …) — **required** for ad-hoc `run` |
| `--globs` | Include/exclude paths (`!` prefix excludes; later globs win) |
| `--json=stream` | One JSON object per line (best for agents) |
| `--files-with-matches` | Paths only |
| `--debug-query=ast` | Debug pattern parsing |
| `-U`, `--update-all` | Apply rewrites without confirmation — **only when mutating** |

## scan vs run

- **`sg run`** — one-off CLI search/rewrite; use for exploration.
- **`sg scan`** — project rules from `sgconfig.yml` or `--rule`; use for repeatable lint/refactor ([rewrite guide](https://ast-grep.github.io/guide/rewrite-code.html)).

Avoid `-i`/`--interactive` in agents.

## Pitfalls

- **Incomplete patterns** — e.g. `export class $NAME` without `{ $$$ }` parses but matches nothing. Use the [playground](https://ast-grep.github.io/playground.html) to refine.
- **Always set `-l`** for ad-hoc patterns.
- **`--max-results`** applies to `sg scan`, not `sg run`.
