# Trust & Safety

dbt-tools reads dbt artifacts and turns them into operational signals for humans, scripts, and agents. Before using production artifacts, remote object storage, or AI-agent integrations, review the pages in this section.

## Start here

| Topic                                             | Read this if…                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| [Data boundaries](./data-boundaries.md)           | You want to know what files are read and what data may appear in output |
| [Agent safety](./agent-safety.md)                 | You are pointing MCP or agent skills at production artifacts            |
| [Production hardening](./production-hardening.md) | You are deploying in CI, cloud storage, or shared environments          |
| [Licensing](./licensing.md)                       | You are evaluating dbt-tools for commercial or internal platform use    |

Contributors: formal threat register in the [repository threat model](https://github.com/yu-iskw/dbt-tools-ts/blob/main/docs/security/threat-model.md) (RFC-0001).

## Core principles

**dbt-tools reads artifacts, not warehouses.** The default tools in this repository parse local or remote artifact files. They do not issue queries against your warehouse unless you explicitly configure a feature that does so.

**Output reflects artifact content.** CLI JSON, Web UI views, and MCP tool responses contain the same data that is in your artifact files. What you expose in artifacts, you expose in tool output.

**Agent clients control their own data handling.** The MCP server returns data to the connected AI client. That client's own settings govern whether it persists, logs, or transmits the returned data. dbt-tools does not control what an AI client does with tool responses.

**Read-only access is sufficient.** dbt-tools does not write to artifact files or modify your dbt project. Credential policies should grant read-only access to the artifact prefix.

## Related

- [Deploy](../deploy/) — local, S3, GCS, and CI configuration
- [Credentials](../deploy/credentials.md) — least-privilege credential setup
- [Ask an agent about a dbt run](../recipes/ask-agent-about-dbt-run.md)
