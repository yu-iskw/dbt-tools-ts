# Version compatibility

## Node.js

dbt-tools requires Node.js 20 or later. The exact version used by the maintainers is recorded in `.node-version` at the repository root.

| dbt-tools package version | Minimum Node.js |
| ------------------------- | --------------- |
| Current                   | 20              |

## dbt artifact schema versions

dbt-tools parses artifact files produced by dbt. The minimum supported manifest schema is **v10** (enforced at runtime). The supported range and the `dbt-artifacts-parser` dependency version bundled with each release together determine which schema versions are accepted.

| Artifact file      | Supported schema versions    |
| ------------------ | ---------------------------- |
| `manifest.json`    | v10, v11, v12 (v10 or later) |
| `run_results.json` | v5, v6                       |
| `catalog.json`     | v1                           |
| `sources.json`     | v3                           |

The **enforced** gate is **manifest schema ≥ v10**, applied when analysis builds `ManifestGraph` (for example `summary`, `discover`, `explain`, MCP `dbt_tools_set_target`, or a web workspace load). dbt-tools does not reject artifacts based on `metadata.dbt_version`. **dbt 1.10.0** is recommended messaging (docs and error text), not a hard dbt-version check. With `dbt-artifacts-parser` 0.7.0, artifacts through **dbt Core 1.12** are in the supported schema range. Manifest **v9 and older** fail at that graph-load step with an unsupported-version error.

To confirm which artifact schema version your dbt project produces, check the `metadata.dbt_schema_version` field:

```bash
cat target/manifest.json | jq '.metadata.dbt_schema_version'
```

`dbt-tools status` only checks whether `manifest.json` and `run_results.json` exist (`unavailable` / `manifest-only` / `full`). It does not parse the manifest or enforce the schema gate, so an old manifest can still report `full`. Produce artifacts with a dbt Core release that emits schema v10 or later (recommended: **1.10** through **1.12**).

## dbt version mapping

dbt versions correspond to artifact schema versions approximately as follows:

| dbt version range | `manifest.json` schema | `run_results.json` schema |
| ----------------- | ---------------------- | ------------------------- |
| dbt 1.6–1.8       | v10, v11               | v5                        |
| dbt 1.9           | v11, v12               | v5, v6                    |
| dbt 1.10–1.12     | v12                    | v6                        |

These mappings are approximate. The runtime check is schema version (≥ v10), not dbt version. Recommended operator floor is dbt **1.10.0**; currently tested upper bound is dbt Core **1.12**. Refer to the [dbt artifacts documentation](https://docs.getdbt.com/reference/artifacts/dbt-artifacts) for authoritative schema version information.

## Package compatibility

All `@dbt-tools/*` packages in a given release are designed to work together. Do not mix major versions across packages (for example, `@dbt-tools/cli@2.x` with `@dbt-tools/core@1.x`).

## Related

- [dbt Artifacts concepts](../concepts/dbt-artifacts.md)
- [Troubleshooting](./troubleshooting.md)
- [dbt artifacts reference](https://docs.getdbt.com/reference/artifacts/dbt-artifacts) (dbt Labs documentation)
