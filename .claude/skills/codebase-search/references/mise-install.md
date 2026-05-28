# mise install

Tools are declared in repository root [`mise.toml`](../../../../mise.toml):

- `ast-grep` → `ast-grep`, `sg`
- `ripgrep` → `rg`
- `fd` → `fd`

Registry shorthands: [mise registry](https://mise.jdx.dev/registry.html).

## First-time setup

```bash
cd /path/to/dbt-tools-ts   # repository root
mise trust                 # trust this repo's mise.toml
mise install               # download pinned tools
eval "$(mise activate bash)"   # inject shims into current shell
```

Alternatively, ensure `~/.local/share/mise/shims` is on `PATH`.

## Verify

```bash
mise ls --current
fd --version
rg --version
sg --version
```

Expected: three tools listed from `/workspace/mise.toml` (paths will vary).

## Notes

- Mise is **optional** for CI and quality gates; Node/pnpm/Trunk remain required.
- [`setup-dev-env`](../../setup-dev-env/SKILL.md) includes this as an optional final step.
