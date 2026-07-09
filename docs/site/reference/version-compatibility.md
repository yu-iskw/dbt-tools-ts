# Version compatibility

## Node.js

dbt-tools requires Node.js 20 or later. The exact version used by the maintainers is recorded in `.node-version` at the repository root.

| dbt-tools package version | Minimum Node.js |
| ------------------------- | --------------- |
| Current                   | 20              |

## TypeScript

Published packages are plain JavaScript; consumers do not need a specific TypeScript version. Maintainers build with **TypeScript 7** (`tsc` via `@typescript/native`). Type-aware tooling that still needs the TypeScript 6 programmatic API (for example typescript-eslint) uses the `@typescript/typescript6` compatibility package under the `typescript` dependency name until TypeScript 7.1 ships a stable API.

## dbt artifact schema versions

dbt-tools parses artifact files produced by dbt. The minimum supported manifest schema is **v10** (enforced at runtime). The supported range and the `dbt-artifacts-parser` dependency version bundled with each release together determine which schema versions are accepted.

| Artifact file      | Supported schema versions    |
| ------------------ | ---------------------------- |
| `manifest.json`    | v10, v11, v12 (v10 or later) |
| `run_results.json` | v5, v6                       |
| `catalog.json`     | v1                           |
| `sources.json`     | v3                           |

The minimum supported dbt version is **1.10.0**. Artifacts from earlier dbt versions (which may produce manifest v9 or older) are not supported and will cause a parse error at runtime.

To confirm which artifact schema version your dbt project produces, check the `metadata.dbt_schema_version` field:

```bash
cat target/manifest.json | jq '.metadata.dbt_schema_version'
```

If your artifact schema version is not supported, `dbt-tools status` will report a parse error. Upgrade dbt to 1.10.0 or later to produce supported artifacts.

## dbt version mapping

dbt versions correspond to artifact schema versions approximately as follows:

| dbt version range | `manifest.json` schema | `run_results.json` schema |
| ----------------- | ---------------------- | ------------------------- |
| dbt 1.6–1.8       | v10, v11               | v5                        |
| dbt 1.9           | v11, v12               | v5, v6                    |
| dbt 1.10+         | v12                    | v6                        |

These mappings are approximate. The minimum required version is dbt 1.10.0. Refer to the [dbt artifacts documentation](https://docs.getdbt.com/reference/artifacts/dbt-artifacts) for authoritative schema version information.

## Package compatibility

All `@dbt-tools/*` packages in a given release are designed to work together. Do not mix major versions across packages (for example, `@dbt-tools/cli@2.x` with `@dbt-tools/core@1.x`).

## Related

- [dbt Artifacts concepts](../concepts/dbt-artifacts.md)
- [Troubleshooting](./troubleshooting.md)
- [dbt artifacts reference](https://docs.getdbt.com/reference/artifacts/dbt-artifacts) (dbt Labs documentation)
