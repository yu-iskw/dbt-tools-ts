# Recipes

Use these recipes when you know the dbt problem you want to solve but are not sure which dbt-tools interface to use.

| Goal | Recipe |
| ---- | ------ |
| Debug a failed dbt run | [Debug a failed run](./debug-failed-run.md) |
| Find slow models | [Investigate slow models](./investigate-slow-models.md) |
| Understand model impact | [Find model impact](./find-model-impact.md) |
| Add artifact checks to CI | [Check run health](../workflows/check-run-health.md) |
| Open CLI findings in a browser | [Open in web](../workflows/open-in-web.md) |
| Connect a coding agent | [Wire your coding agent](../workflows/wire-your-coding-agent.md) |

Each recipe shows CLI, Web, and MCP paths where applicable. Older step-by-step pages remain under [Workflows](../workflows/) with stable URLs; new work should start from this index.

## Prerequisites

- `manifest.json` and `run_results.json` under your target root, or the [demo artifacts](../guide/demo-artifacts.md)
- Node.js 20+

## Related

- [5-minute quickstart](../guide/quickstart.md)
- [Choose by goal](../guide/choose-by-goal.md)
- [Troubleshooting](../reference/troubleshooting.md)
