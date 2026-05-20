# Operational Intelligence

Operational intelligence refers to structured, deterministic signals derived from dbt artifacts that help operators and automation systems understand and act on the state of a dbt project.

## Why Determinism Matters

Many observability tools produce aggregate metrics or probabilistic summaries. dbt-tools takes a different approach: every output is derived directly and deterministically from the artifact files on disk. Given the same input files, the same output is always produced.

This makes dbt-tools outputs:

- **Reproducible** — run the same analysis twice, get the same result
- **Auditable** — trace any output back to the source artifact
- **Agent-friendly** — AI agents and automation can rely on stable, structured signals

## Types of Operational Signals

### Run Status

Derived from `run_results.json`. Answers questions like:

- Which models succeeded, failed, or were skipped in the last run?
- How long did each model take to execute?
- What errors occurred and in which models?

### Graph Structure

Derived from `manifest.json`. Answers questions like:

- What are the upstream dependencies of a model?
- Which models are downstream of a source?
- What tests cover a particular model?

### Change Impact

Combining manifest and run results to answer:

- Which models were affected by a recent code change?
- Which tests should be re-run after modifying a source model?

## Use Cases

| Audience | Use Case |
|----------|----------|
| Analytics engineers | Quickly diagnose which models failed and why |
| Platform engineers | Automate re-runs and alerting based on artifact signals |
| AI agents | Query dbt project state through the MCP server |
| Data governance | Audit model lineage and test coverage |
