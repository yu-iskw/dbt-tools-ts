---
name: bind-target
description: Establish the dbt artifact root for this session (local path, s3://, or gs://). Use before any other dbt-tools analysis primitive.
compatibility: dbt-tools on PATH; pass --dbt-target or DBT_TOOLS_DBT_TARGET consistently.
---

# Bind target

**Handle:** `dbt-tools-cli:bind-target`

## Contract

- **Inputs:** artifact root path or URI the user intends to analyze
- **Outputs:** a single target string used for all following CLI invocations in the session
- **Done when:** every downstream command in the chain uses the same `--dbt-target` or `DBT_TOOLS_DBT_TARGET`

## Preconditions

- None (first primitive in a session)

## Out of scope

- Verifying manifest/run_results presence (use [`check-session`](../check-session/SKILL.md))
- GCS impersonation or S3 endpoint configuration (environment / operator setup)

## Implementation

See [references/implementation.md](references/implementation.md).
