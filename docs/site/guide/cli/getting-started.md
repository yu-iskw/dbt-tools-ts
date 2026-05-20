# Getting started with @dbt-tools/cli

**One-shot, scriptable** analysis: machine-readable JSON, runtime `schema` introspection, `--fields` filtering, and stable exit codes for operators, CI, scripts, and coding agents.

Use `dbt-tools` for **one-shot** analysis from the shell or CI. Each invocation loads artifacts for that command unless you reuse the same local target path.

## Install and run

```bash
npx @dbt-tools/cli status --dbt-target ./target
```

Or global install:

```bash
npm install -g @dbt-tools/cli
dbt-tools summary --dbt-target ./target
```

Set `DBT_TOOLS_DBT_TARGET` or pass `--dbt-target` to your dbt `target/` directory.

## Learn more

- [Configuration](../../reference/configuration.md) — environment variables and targets
- [Package README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md)
