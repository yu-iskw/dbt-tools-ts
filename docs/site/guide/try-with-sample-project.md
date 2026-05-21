# Try with a sample project

Generate real `manifest.json` and `run_results.json` from a dbt run on fictional jaffle data—no warehouse account required for the default path. Then point any dbt-tools command at `./target` in the project directory.

For what each artifact file means and when dbt writes them, see [dbt artifacts & target/](../concepts/dbt-artifacts.md).

## Recommended — [jaffle_shop_duckdb](https://github.com/dbt-labs/jaffle_shop_duckdb)

This [dbt Labs](https://github.com/dbt-labs/jaffle_shop_duckdb) sample runs locally on DuckDB. Use its README for the latest Python and dbt version notes.

**Prerequisites:** Node.js 20+ (dbt-tools); Python 3.x and `pip install -r requirements.txt` per the jaffle repo; dbt **1.10+** for supported artifact schemas ([version compatibility](../reference/version-compatibility.md)).

```bash
git clone https://github.com/dbt-labs/jaffle_shop_duckdb.git
cd jaffle_shop_duckdb
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
dbt build
```

From the **same directory** (artifacts at `./target`):

```bash
npx @dbt-tools/cli status --dbt-target ./target --json
npx @dbt-tools/cli discover --dbt-target ./target "orders" --limit 5 --json
npx @dbt-tools/web --dbt-target ./target
```

Discover examples such as `orders` or `customers` match jaffle model names.

## Your own dbt project

If you already have a dbt project, run any command that produces artifacts, then point dbt-tools at `target/`:

```bash
cd my-dbt-project
dbt build   # or dbt run
npx @dbt-tools/cli status --dbt-target ./target --json
```

## Optional — [jaffle-shop](https://github.com/dbt-labs/jaffle-shop)

The classic [jaffle-shop](https://github.com/dbt-labs/jaffle-shop) tutorial project is another public sample. It **requires a configured warehouse profile** (Snowflake, BigQuery, and so on)—not the zero-setup DuckDB path. Use it when you already have adapter credentials and want the original tutorial layout.

## Use with the quickstart

Every command in the [5-minute quickstart](./quickstart.md) works once `./target` contains `manifest.json` and `run_results.json` from `dbt build` (or `dbt run`) in the sample repo directory.

## Public screenshots and demos

For screenshots, blog posts, or shared coding-agent sessions:

- Prefer artifacts from **public sample projects** (jaffle) or **sanitized non-production** targets.
- Never use **production** artifacts—they may expose schema paths, SQL, warehouse identifiers, or environment metadata.
- Jaffle data is fictional, but artifacts are still **real dbt JSON** and may contain paths or SQL in error messages. See [Data boundaries](../trust/data-boundaries.md).

## Related

- [5-minute quickstart](./quickstart.md)
- [New to dbt?](./foundations/new-to-dbt.md)
- [dbt artifacts & target/](../concepts/dbt-artifacts.md)
- [Data boundaries](../trust/data-boundaries.md)
- [Trust & Safety](../trust/)
