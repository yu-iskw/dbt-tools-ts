# Version compatibility

## Node.js

dbt-tools requires Node.js 20 or later. The exact version used by the maintainers is recorded in `.node-version` at the repository root.

| dbt-tools package version | Minimum Node.js |
| ------------------------- | --------------- |
| Current                   | 20              |

## dbt artifact schema versions

dbt-tools parses artifact files produced by dbt. The supported artifact schema versions depend on the `dbt-artifacts-parser` dependency version bundled with each dbt-tools release.

| Artifact file      | Schema versions supported                            |
| ------------------ | ---------------------------------------------------- |
| `manifest.json`    | v9, v10, v11 (check release notes for current range) |
| `run_results.json` | v4, v5                                               |
| `catalog.json`     | v1                                                   |
| `sources.json`     | v3                                                   |

To confirm which artifact schema version your dbt project produces, check the `metadata.dbt_schema_version` field:

```bash
cat target/manifest.json | jq '.metadata.dbt_schema_version'
```

If your artifact schema version is not supported, `dbt-tools status` will report a parse error. Upgrade dbt-tools to a version that supports your schema, or downgrade dbt to produce a supported schema version.

## dbt version mapping

dbt versions correspond to artifact schema versions approximately as follows:

| dbt version range | `manifest.json` schema | `run_results.json` schema |
| ----------------- | ---------------------- | ------------------------- |
| dbt 1.5           | v9                     | v4                        |
| dbt 1.6           | v10                    | v5                        |
| dbt 1.7+          | v11                    | v5                        |

These mappings are approximate. Refer to the [dbt artifacts documentation](https://docs.getdbt.com/reference/artifacts/dbt-artifacts) for authoritative schema version information.

## Package compatibility

All `@dbt-tools/*` packages in a given release are designed to work together. Do not mix major versions across packages (for example, `@dbt-tools/cli@2.x` with `@dbt-tools/core@1.x`).

## Related

- [dbt Artifacts concepts](../concepts/dbt-artifacts.md)
- [Troubleshooting](./troubleshooting.md)
- [dbt artifacts reference](https://docs.getdbt.com/reference/artifacts/dbt-artifacts) (dbt Labs documentation)
