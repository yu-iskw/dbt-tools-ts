# Recipes

Recipes are end-to-end task guides. Each one starts from a user goal, shows which interface to use, and walks through the commands or UI steps to reach a clear outcome.

## Choose a recipe

| Goal | Recipe |
|---|---|
| Check whether a dbt run succeeded and identify failed nodes | [Debug a failed run](./debug-failed-run.md) |
| Rank slow models and find timing bottlenecks | [Investigate slow models](./investigate-slow-models.md) |
| Understand which models would break if you changed one | [Find model impact](./find-model-impact.md) |
| Produce a dbt health summary in GitHub Actions or CI | [Generate CI health summary](./generate-ci-health-summary.md) |
| Move from CLI JSON output to visual browser investigation | [Open CLI result in Web](./open-cli-result-in-web.md) |
| Let an AI agent query dbt artifacts safely | [Ask an agent about a dbt run](./ask-agent-about-dbt-run.md) |

## Prerequisites for all recipes

- `manifest.json` and `run_results.json` under a dbt target directory
- Node.js 20+

Run `npx @dbt-tools/cli status --dbt-target ./target --json` first to confirm artifacts are readable.

> **No real dbt project?** Use [demo artifacts](../guide/demo-artifacts.md) to try any recipe without a warehouse.

## How recipes relate to existing workflows

The site also has detailed [Workflows](../workflows/) pages under each interface section (CLI, Web, Agents). Recipes and workflows cover overlapping ground from different angles:

- **Recipes** start with a user goal and route to the right interface.
- **Workflows** start with a specific interface and walk through its steps.

Both are valid. Use whichever framing matches how you think about your task.

## Related

- [Choose by goal](../guide/choose-by-goal.md) — quick routing table
- [5-minute quickstart](../guide/quickstart.md) — get your first command running
- [Deploy](../deploy/) — local, S3, GCS, and CI configuration
- [Trust & Safety](../trust/) — data boundaries, agent safety, and licensing
