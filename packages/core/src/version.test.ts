// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from 'dbt-artifacts-parser/manifest';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { loadTestManifest } from 'dbt-artifacts-parser/test-utils';
import { describe, it, expect } from 'vitest';

import {
  getManifestSchemaVersion,
  getDbtVersion,
  isSupportedVersion,
  getVersionInfo,
  MIN_SUPPORTED_SCHEMA_VERSION,
  MIN_SUPPORTED_DBT_VERSION,
} from './version';

import type { ParsedManifest } from 'dbt-artifacts-parser/manifest';

describe('Version Detection', () => {
  describe('getManifestSchemaVersion', () => {
    it('should extract schema version from v12 manifest', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const version = getManifestSchemaVersion(manifest);
      expect(version).toBe(12);
    });

    it('should extract schema version from v11 manifest', () => {
      const manifestJson = loadTestManifest('v11', 'manifest.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const version = getManifestSchemaVersion(manifest);
      expect(version).toBe(11);
    });

    it('should extract schema version from v10 manifest', () => {
      const manifestJson = loadTestManifest('v10', 'manifest.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const version = getManifestSchemaVersion(manifest);
      expect(version).toBe(10);
    });

    it('should return null for manifest without schema version', () => {
      const manifest = {
        metadata: {},
        nodes: {},
      } as unknown;
      const version = getManifestSchemaVersion(manifest as unknown as ParsedManifest);
      expect(version).toBeNull();
    });
  });

  describe('getDbtVersion', () => {
    it('should extract dbt version from manifest', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const dbtVersion = getDbtVersion(manifest);
      expect(dbtVersion).toBeTruthy();
      expect(typeof dbtVersion).toBe('string');
    });

    it('should return null for manifest without dbt version', () => {
      const manifest = {
        metadata: {
          dbt_schema_version: 'https://schemas.getdbt.com/dbt/manifest/v12.json',
        },
        nodes: {},
      } as unknown;
      const dbtVersion = getDbtVersion(manifest as unknown as ParsedManifest);
      expect(dbtVersion).toBeNull();
    });
  });

  describe('isSupportedVersion', () => {
    it('should return true for v12 manifest', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      expect(isSupportedVersion(manifest)).toBe(true);
    });

    it('should return true for v11 manifest', () => {
      const manifestJson = loadTestManifest('v11', 'manifest.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      expect(isSupportedVersion(manifest)).toBe(true);
    });

    it('should return true for v10 manifest', () => {
      const manifestJson = loadTestManifest('v10', 'manifest.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      expect(isSupportedVersion(manifest)).toBe(true);
    });

    it('should return false for v9 manifest', () => {
      const manifestJson = loadTestManifest('v9', 'manifest.json', 'jaffle_shop_at_1.5rc1');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      expect(isSupportedVersion(manifest)).toBe(false);
    });

    it('should return false for manifest without schema version', () => {
      const manifest = {
        metadata: {},
        nodes: {},
      } as unknown;
      expect(isSupportedVersion(manifest as unknown as ParsedManifest)).toBe(false);
    });
  });

  describe('getVersionInfo', () => {
    it('should return complete version info for v12 manifest', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const versionInfo = getVersionInfo(manifest);

      expect(versionInfo.schema_version).toBe(12);
      expect(versionInfo.dbt_version).toBeTruthy();
      expect(versionInfo.is_supported).toBe(true);
    });

    it('should return unsupported status for v9 manifest', () => {
      const manifestJson = loadTestManifest('v9', 'manifest.json', 'jaffle_shop_at_1.5rc1');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const versionInfo = getVersionInfo(manifest);

      expect(versionInfo.schema_version).toBe(9);
      expect(versionInfo.is_supported).toBe(false);
    });

    it('should handle missing metadata gracefully', () => {
      const manifest = {
        metadata: {},
        nodes: {},
      } as unknown;
      const versionInfo = getVersionInfo(manifest as unknown as ParsedManifest);

      expect(versionInfo.schema_version).toBeNull();
      expect(versionInfo.dbt_version).toBeNull();
      expect(versionInfo.is_supported).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should have correct minimum supported schema version', () => {
      expect(MIN_SUPPORTED_SCHEMA_VERSION).toBe(10);
    });

    it('should have correct minimum supported dbt version', () => {
      expect(MIN_SUPPORTED_DBT_VERSION).toBe('1.10.0');
    });
  });
});
