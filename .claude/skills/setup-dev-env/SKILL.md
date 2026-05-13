---
name: setup-dev-env
description: Set up the development environment for the project. Use when starting work on the project, when dependencies are out of sync, or to fix environment setup failures.
---

# Setup Development Environment

This skill automates the process of setting up the development environment to ensure all tools and dependencies are correctly installed and configured.

## Workflow Checklist

- [ ] **Step 1: Environment Validation**
  - [ ] Check Node.js version against `.node-version`
- [ ] **Step 2: Dependency Installation**
  - [ ] Run `pnpm install` (installs the Trunk launcher from `@trunkio/launcher` into `node_modules/.bin`)
- [ ] **Step 3: Verify Trunk**
  - [ ] Run `pnpm exec trunk --version` or `pnpm trunk --version`
- [ ] **Step 4: Tooling Setup**
  - [ ] Run `pnpm exec trunk install` to fetch managed linters and formatters (optional but recommended)

## Detailed Instructions

### 1. Environment Validation

#### Node.js Version

Read the `.node-version` file in the workspace root. Ensure the current Node.js environment matches this version. If there's a mismatch, inform the user to switch Node versions (e.g., using `nvm` or `fnm`).

### 2. Dependency Installation

Run the following command at the workspace root to install all project dependencies. This brings the Trunk **launcher** into `node_modules/.bin` so `pnpm` scripts can run `trunk` without a global install.

```bash
pnpm install
```

### 3. Verify Trunk

Confirm the launcher is available:

```bash
pnpm exec trunk --version
```

If this fails, dependencies may be incomplete—re-run `pnpm install` at the repo root.

If you need a global `trunk` on your PATH (optional), see the [Trunk installation guide](https://docs.trunk.io/references/cli/getting-started/install). On macOS, Homebrew (`brew install trunk-io`) is one option.

### 4. Tooling Setup

Trunk manages linters and formatters hermetically. Run the following command to ensure all required tools are downloaded and ready. Use `pnpm lint`, `pnpm format`, and `pnpm exec trunk install` as needed for this repository.

```bash
pnpm exec trunk install
```

## Success Criteria

- All `pnpm` dependencies are installed successfully.
- `pnpm exec trunk --version` succeeds.
- Managed Trunk tools are initialized if you ran `pnpm exec trunk install`.
- The Node.js version matches the requirement in `.node-version`.

## Post-Setup Verification

To ensure the environment is fully operational:

1. **Invoke Verifier**: Run the `verifier` subagent (see `.claude/agents/verifier.md`). This confirms that the freshly installed dependencies allow for a successful build, pass lint checks, and satisfy all unit tests.
2. **Handle Failure**: If the `verifier` fails, follow its reporting to resolve environment-specific issues.
