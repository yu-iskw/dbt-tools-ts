# explain-deps command recipes

```bash
dbt-tools explain model.my_project.orders --dbt-target ./target --json

dbt-tools deps model.my_project.orders --dbt-target ./target --direction downstream --json

dbt-tools deps model.my_project.orders --dbt-target ./target --direction downstream --depth 2 --json
```
