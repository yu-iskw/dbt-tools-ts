# Licensing

## dbt-tools license

The `@dbt-tools/*` packages (`@dbt-tools/core`, `@dbt-tools/cli`, `@dbt-tools/web`) are released under a **source-available** license that is **not an OSI-approved open source license**. The full text is at [`packages/LICENSE`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/LICENSE) in the repository.

> **Important:** The root `LICENSE` file in this repository is Apache 2.0 and applies to shared repository infrastructure (scripts, tooling configuration, etc.), not to the published `@dbt-tools/*` packages. For package licensing, refer to `packages/LICENSE`. See [`LICENSES/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/LICENSES/README.md) for the authoritative path-to-license map.

Key implications of the package license:

- You may read the source code in this repository.
- Commercial use, internal platform deployment, redistribution, and modification rights are governed by the terms in `packages/LICENSE`. Review that file before using dbt-tools in commercial, internal platform, or redistributed contexts.
- The packages are not dual-licensed under a permissive or copyleft OSI license such as MIT, Apache 2.0, or GPL.

If you have questions about licensing for a specific use case, review [`packages/LICENSE`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/LICENSE) or contact the maintainers.

## Dependency licenses

The `@dbt-tools/*` packages depend on third-party npm packages. Each dependency retains its own license, which is independent of the dbt-tools license.

Notable dependency: `dbt-artifacts-parser` is an external npm package, not part of this repository. Its license terms apply separately. Review the dependency's license before use in contexts where the dependency's terms matter to your organization.

You can inspect all dependency licenses with standard tooling:

```bash
npx license-checker --production
```

or

```bash
pnpm licenses list
```

## dbt license

dbt itself is a separate project maintained by dbt Labs with its own license terms. dbt-tools reads artifact files produced by dbt but is not affiliated with, endorsed by, or distributed by dbt Labs.

## Related

- [Trust & Safety](./index.md)
- Package license: [`packages/LICENSE`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/LICENSE)
- License map: [`LICENSES/README.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/LICENSES/README.md)
