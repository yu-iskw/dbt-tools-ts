# Demo artifacts

Use synthetic dbt artifacts to try dbt-tools without a warehouse or a real dbt project.

## What demo artifacts are

Demo artifacts are hand-crafted `manifest.json` and `run_results.json` files that follow the dbt artifact schema. They contain realistic-looking model names, test names, and timing data but no real warehouse metadata, credentials, or customer information.

You can use them with any dbt-tools command that accepts `--dbt-target`.

## Option A: Use your own target directory

If you have a dbt project, run any dbt command that produces artifacts, then point dbt-tools at the output:

```bash
cd my-dbt-project
dbt run                                    # or dbt test, dbt build
npx @dbt-tools/cli status --dbt-target ./target --json
```

## Option B: Download the demo artifact bundle

The repository ships synthetic fixtures in the GitHub release assets. Download and unzip them:

```bash
curl -L -o demo-artifacts.zip \
  https://github.com/yu-iskw/dbt-tools-ts/releases/latest/download/demo-artifacts.zip
unzip demo-artifacts.zip -d ./demo-target
```

Then use `./demo-target` as your `--dbt-target` in any quickstart or recipe command.

## Option C: Create minimal artifacts by hand

You can create a minimal `manifest.json` and `run_results.json` that satisfies the dbt-tools schema. See the [dbt artifacts reference](https://docs.getdbt.com/reference/artifacts/dbt-artifacts) for the expected schema version and required fields.

## Using demo artifacts with the quickstart

Every command in the [5-minute quickstart](./quickstart.md) works with demo artifacts:

```bash
npx @dbt-tools/cli status --dbt-target ./demo-target --json
npx @dbt-tools/cli discover --dbt-target ./demo-target "orders" --json
npx @dbt-tools/web --dbt-target ./demo-target
```

## Important: demo artifacts for public examples

If you share screenshots, blog posts, or public demos, always use synthetic artifacts. Real dbt artifacts may contain:

- Model names and schema paths that reveal project structure
- Error messages with SQL, column names, or warehouse identifiers
- Environment metadata from `DBT_ENV_CUSTOM_ENV_*` variables
- Invocation IDs and timestamps

See [Data boundaries](../trust/data-boundaries.md) for the full list of what may appear in artifact files.

## Related

- [5-minute quickstart](./quickstart.md)
- [Data boundaries](../trust/data-boundaries.md)
- [Trust & Safety](../trust/)
