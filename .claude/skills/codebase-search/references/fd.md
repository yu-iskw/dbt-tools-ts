# fd — find files

Official reference: [fd README](https://github.com/sharkdp/fd) (`fd --help`).

**Default behavior:** smart case; skips hidden files and gitignored paths in git repos; matches **filename** (not full path) unless `-p` is set.

## Examples (this monorepo)

```bash
# Exact filename (glob) under packages/
fd -g 'vitest.config.ts' packages/

# All TypeScript / TSX sources under a package (match-all pattern + extensions)
fd . packages/web/src -e ts -e tsx

# Match a path segment (full path, not just basename)
fd -p 'packages/mcp/src' -e ts .

# Cap results (exit after N paths)
fd -g '*.test.ts' packages/core --max-results 20

# Pipe paths into another command (batch form; put -X last)
fd -e ts -e tsx . packages/web/src/components -X rg -l 'SettingsView' --no-heading
```

## Key flags

| Flag | Purpose |
| ---- | ------- |
| `-g`, `--glob` | Glob pattern instead of regex |
| `-e`, `--extension` | Filter by extension (repeatable) |
| `-p`, `--full-path` | Match against full path |
| `-E`, `--exclude` | Exclude glob (overrides ignore logic) |
| `-X`, `--exec-batch` | Run command once with all results as args — **must be last** |
| `--max-results` | Stop after N paths |

## Pitfalls

- **`fd packages/web/src` is wrong** — `packages/web/src` is treated as the pattern, not the root. Use `fd . packages/web/src` or `fd -g '*.tsx' packages/web/src`.
- **No pattern + path:** when the search root is separate, pass `.` as the pattern.
- **`-X` placement:** everything after `-X`/`--exec-batch` goes to the subprocess, not fd.
