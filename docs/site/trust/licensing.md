# Licensing

## dbt-tools license

The `@dbt-tools/*` packages published from this repository are released under the terms specified in the repository's `LICENSE` file. This license is **source-available** but **not an OSI-approved open source license**.

Key implications:

- You may read the source code in this repository.
- Commercial use, internal platform deployment, redistribution, and modification rights are governed by the specific license terms. Review the `LICENSE` file before using dbt-tools in a commercial, internal platform, or redistributed context.
- The packages are not dual-licensed under a permissive or copyleft OSI license such as MIT, Apache 2.0, or GPL.

If you have questions about licensing for a specific use case, review the `LICENSE` file in the repository or contact the maintainers.

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
- Repository [LICENSE](https://github.com/yu-iskw/dbt-tools-ts/blob/main/LICENSE) file
