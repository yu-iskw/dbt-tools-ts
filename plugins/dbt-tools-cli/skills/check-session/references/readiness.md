# Readiness and primitive availability

`dbt-tools status` sets **`readiness`** from **`manifest.json`** and **`run_results.json`** under the bound target. Local roots are stat-only; remote roots download first.

| `readiness`     | Safe primitives                                                                             | Avoid                               |
| --------------- | ------------------------------------------------------------------------------------------- | ----------------------------------- |
| `full`          | All eight primitives                                                                        | —                                   |
| `manifest-only` | `bind-target`, `check-session`, `find-resources`, `describe-resource`, `trace-dependencies` | `query-executions`, `summarize-run` |
| `unavailable`   | `bind-target`, `check-session`                                                              | All analysis primitives             |

See [packages/cli/README.md](../../../../../packages/cli/README.md) for additional CLI commands not covered by these primitives.
