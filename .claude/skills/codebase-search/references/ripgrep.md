# ripgrep — search contents

Official reference: [ripgrep GUIDE.md](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md) (`rg --help`, `rg --type-list`).

**Default behavior:** respects `.gitignore`; skips hidden files and binary files (NUL byte heuristic); does not follow symlinks.

**Agent defaults:** `--no-config --color=never` (ignore user ripgrep config; no ANSI in pipes). Add `--no-heading` when parsing line output.

## Examples (this monorepo)

```bash
# Literal symbol search in TypeScript (no regex escaping)
rg -F 'ArtifactWorkspace' packages/mcp -t ts -m 5 --no-config --no-heading --color=never

# List candidate files without searching contents
rg --files packages/ -g '*.ts' -g '!**/*.test.ts' -g '!**/*.spec.ts'

# Files that contain a string (paths only)
rg -l 'resolveSafePath' packages/core/src -t ts --no-config

# JSON Lines for structured parsing (do not combine with -l/-c/--files)
rg --json --no-heading --color=never 'resolveSafePath' packages/core/src/io -t ts -m 3 --no-config

# Count matches per file
rg -c 'pnpm' package.json packages/*/package.json --no-config

# Deterministic path order (disables parallelism; use when order matters)
rg --sort=path -F 'DBT_TOOLS' docs/ --no-config --no-heading
```

## Key flags

| Flag | Purpose |
| ---- | ------- |
| `-F`, `--fixed-strings` | Literal search (symbols, env vars, error strings) |
| `-t TYPE`, `--type=TYPE` | Built-in type filter (`ts`, `js`, `json`, `yaml`, `md`) |
| `-g GLOB`, `--glob=GLOB` | Include/exclude paths (`!` prefix excludes) |
| `-l`, `--files-with-matches` | Paths only |
| `-m NUM`, `--max-count=NUM` | Cap matches per file |
| `--json` | JSON Lines (`begin` / `match` / `end`) — see [JSON schema](https://docs.rs/grep-printer/latest/grep_printer/struct.JSON.html) |
| `--files` | List searchable files (no pattern search) |
| `--no-config` | Ignore `RIPGREP_CONFIG_PATH` |

Use `-F` for identifiers and env var names; `-w` for whole-word matches.

## Pitfalls

- **`--json` conflicts** with `-l`, `-c`, and `--files` — pick one output mode.
- **Binary files** skipped unless `-a`/`--text` or `-uuu`.
- **Gitignored trees** skipped unless `-u`/`-uu`.
- **User config** can change defaults — always pass `--no-config` in automation.
