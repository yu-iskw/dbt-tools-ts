# Contributing: agent plugins

This document is for **contributors and maintainers**: marketplace changes, structural checks, and optional vendor `plugin validate` runs. End-user discovery and the plugin index are in [`README.md`](README.md).

## Adding a new plugin

1. Create `plugins/<plugin-id>/` with the expected manifests (`.claude-plugin`, `.codex-plugin`, `.cursor-plugin`) and `skills/` layout per upstream docs.
2. **Codex:** append an entry to the `plugins` array in [`.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json) (`source.source: "local"`, `source.path` like `./plugins/<plugin-id>`, plus `policy` and `category` per Codex).
3. **Cursor:** add a matching entry to [`.cursor-plugin/marketplace.json`](../.cursor-plugin/marketplace.json) (same plugin ids and `./plugins/<plugin-id>` sources as Codex). Automated verification enforces alignment when `PLUGIN_FILTER` is unset.
4. **Claude Code:** add a matching entry to [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) (same plugin ids, `./plugins/<plugin-id>` sources, and descriptions as Cursor). Keep all three marketplace catalogs in sync.

## Verification

Checks run in **Docker** using [`plugins/tests/Dockerfile.agent-plugins`](tests/Dockerfile.agent-plugins) (image tag **`dbt-tools-ts:agent-plugins`**). Build and run via **`make -C plugins`** targets (see below) or equivalent `docker build` / `docker run` commands. The container runs [`plugins/tests/verify-agent-plugins.sh`](tests/verify-agent-plugins.sh), which sources [`verify-codex-plugins.sh`](tests/verify-codex-plugins.sh), [`verify-claude-plugins.sh`](tests/verify-claude-plugins.sh), and [`verify-cursor-plugins.sh`](tests/verify-cursor-plugins.sh). The repo is bind-mounted read-only at `/work`.

**Modes** (first script argument, or **`VERIFY_TARGET`** when argv is empty — default **`all`**):

| Mode         | What runs                                                                          |
| ------------ | ---------------------------------------------------------------------------------- |
| `structural` | Marketplaces + on-disk layout only                                                 |
| `codex`      | Structural + `codex plugin validate`                                               |
| `claude`     | Structural + `claude plugin validate`                                              |
| `cursor`     | Structural + `cursor-agent plugin validate`                                        |
| `all`        | Structural + all three vendor CLI phases (independent; aggregated exit on failure) |

Examples:

```bash
make -C plugins test-claude
./plugins/tests/verify-agent-plugins.sh structural   # from repo root, with tools on PATH
```

Raw Docker (from repository root, after `make -C plugins build-image` or `docker build`):

```bash
docker run --rm -v "$(pwd):/work:ro" -e HOME=/tmp/agent-plugins-home -e VERIFY_TARGET=claude dbt-tools-ts:agent-plugins
```

Verification is **offline-first** in two layers:

| Layer             | What runs                                                                                                        | Network / API keys                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **1. Structural** | Marketplaces, manifest names/paths, skills layout, Cursor/Codex catalog alignment                                | None                                                                        |
| **2. Vendor CLI** | **Preflight** then `codex` / `claude` / `cursor-agent` **`plugin validate`** per plugin when the tool exposes it | Depends on vendor behavior; measure empirically (often none for local dirs) |

### Pinned CLI versions (Docker image)

Versions are set as build args in [`plugins/tests/Dockerfile.agent-plugins`](tests/Dockerfile.agent-plugins). Update this table when you bump those args.

| Tool         | Package / source                                                                   | Pinned version       |
| ------------ | ---------------------------------------------------------------------------------- | -------------------- |
| Claude Code  | `npm install -g @anthropic-ai/claude-code`                                         | `2.1.98`             |
| Codex        | `npm install -g @openai/codex`                                                     | `0.118.0`            |
| Cursor Agent | `https://downloads.cursor.com/lab/<version>/linux/<arch>/agent-cli-package.tar.gz` | `2026.04.08-a41fba1` |

For Cursor downloads inside Docker: `TARGETARCH` `amd64` maps to path segment `x64`; `arm64` maps to `arm64`.

**Preflight:** each vendor probes availability (`command -v`, `plugin validate -h`, and for Cursor a `plugin` line in `cursor-agent --help`). If preflight fails, that vendor is **skipped** with a log line (not a failure). If preflight passes and `plugin validate` fails for a plugin, that vendor **fails**, but other vendors still run.

**Upstream quirks (soft-skip until pins/CLIs change):** as of `@openai/codex@0.118.0`, `codex plugin validate -h` may fail (no stable `plugin validate`). As of Cursor lab build `2026.04.08-a41fba1`, `cursor-agent --help` may omit a top-level `plugin` command. The orchestrator skips vendor CLI validation in those cases; see the verify scripts under [`plugins/tests/`](tests/).

**After bumping a pin:** edit the Dockerfile, rebuild the image (`make -C plugins build-image`), then preflight inside the container (e.g. `codex plugin validate -h`, `cursor-agent --help`, `cursor-agent plugin validate -h`). Prefer running without `CODEX_API_KEY` / `CURSOR_API_KEY` first; document optional secrets here only if a command fails with an auth error.

The image installs **bash**, **jq**, **Claude Code** (`claude`), **Codex** (`codex`), and **Cursor Agent** (`cursor-agent`). After structural checks, the orchestrator runs **CLI verification** for **Codex**, **Claude Code**, and **Cursor Agent** **independently**: each vendor runs preflight probes first; if a tool does not support `plugin validate`, that vendor is skipped with a log line. If one vendor’s validate fails (for example missing credentials), **the others still run**. The process exits **non-zero** if any vendor phase that actually ran `plugin validate` failed.

### What this does and does not test

**Does test:** internal consistency (structural verification); **`claude plugin validate`** when preflight succeeds; vendor Codex/Cursor **`plugin validate`** when preflight succeeds. The image **HEALTHCHECK** runs `claude --version`, `codex --version`, and `cursor-agent --version`.

**Does not test:** installing or loading plugins inside the **Codex** or **Cursor** desktop apps, or GUI-only / IDE-session flows. Those remain manual or separate E2E work if you need end-user fidelity.

### Makefile (from repository root)

| Target              | Purpose                                                      |
| ------------------- | ------------------------------------------------------------ |
| `test` / `test-all` | Full check (`VERIFY_TARGET=all`)                             |
| `test-structural`   | Structural only                                              |
| `test-codex`        | Structural + Codex CLI                                       |
| `test-claude`       | Structural + Claude Code CLI                                 |
| `test-cursor`       | Structural + Cursor Agent CLI                                |
| `build-image`       | `docker build` → `dbt-tools-ts:agent-plugins`                |
| `clean`             | `docker rmi` that image tag (does not delete plugin sources) |

```bash
make -C plugins test-all
make -C plugins test-claude
make -C plugins clean
```

### pnpm (from repository root)

| Script                                 | Purpose                          |
| -------------------------------------- | -------------------------------- |
| `pnpm verify:agent-plugins`            | Full check (`VERIFY_TARGET=all`) |
| `pnpm verify:agent-plugins:structural` | Structural only                  |
| `pnpm verify:agent-plugins:codex`      | Structural + Codex               |
| `pnpm verify:agent-plugins:claude`     | Structural + Claude              |
| `pnpm verify:agent-plugins:cursor`     | Structural + Cursor              |
| `pnpm test:agent-plugins`              | Alias of `verify:agent-plugins`  |
| `pnpm clean:agent-plugins`             | Same as `make -C plugins clean`  |

```bash
pnpm verify:agent-plugins
pnpm verify:agent-plugins:claude
```

**Single plugin (debug, Docker):**

```bash
make -C plugins build-image
docker run --rm -v "$(pwd):/work:ro" -e HOME=/tmp/agent-plugins-home -e VERIFY_TARGET=all \
  -e PLUGIN_FILTER=dbt-tools-cli dbt-tools-ts:agent-plugins
```

If the container drops into a Node REPL or runs the wrong command, rebuild: `make -C plugins build-image` (or `docker build --no-cache -f plugins/tests/Dockerfile.agent-plugins -t dbt-tools-ts:agent-plugins .` from repo root), then run `make -C plugins test-all` again.
