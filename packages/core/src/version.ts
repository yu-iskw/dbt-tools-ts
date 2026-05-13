import type { ParsedManifest } from 'dbt-artifacts-parser/manifest';
import type { VersionInfo } from './types';

/**
 * Minimum supported manifest schema version
 * Manifest v10 corresponds to dbt Core 1.6+, but we require dbt 1.10+
 * Since v10 covers 1.6-1.9 and v12 covers 1.9+, accepting v10+ ensures we support 1.10+
 */
export const MIN_SUPPORTED_SCHEMA_VERSION = 10;

/**
 * Minimum supported dbt version (for reference in error messages)
 */
export const MIN_SUPPORTED_DBT_VERSION = '1.10.0';

/**
 * Extract manifest schema version number from dbt_schema_version URL
 */
export function getManifestSchemaVersion(manifest: ParsedManifest): number | null {
  const metadata = manifest.metadata as { dbt_schema_version?: string } | undefined;
  if (!metadata || !metadata.dbt_schema_version) {
    return null;
  }

  const schemaVersion = metadata.dbt_schema_version;
  // Match patterns like: https://schemas.getdbt.com/dbt/manifest/v12.json
  const match = schemaVersion.match(/\/manifest\/v(\d+)\.json$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract dbt version from manifest metadata
 */
export function getDbtVersion(manifest: ParsedManifest): string | null {
  const metadata = manifest.metadata as { dbt_version?: string } | undefined;
  return metadata?.dbt_version || null;
}

/**
 * Check if the manifest version is supported
 */
export function isSupportedVersion(manifest: ParsedManifest): boolean {
  const schemaVersion = getManifestSchemaVersion(manifest);
  if (schemaVersion === null) {
    return false;
  }
  return schemaVersion >= MIN_SUPPORTED_SCHEMA_VERSION;
}

/**
 * Get comprehensive version information from a manifest
 */
export function getVersionInfo(manifest: ParsedManifest): VersionInfo {
  const schemaVersion = getManifestSchemaVersion(manifest);
  const dbtVersion = getDbtVersion(manifest);
  const isSupported = isSupportedVersion(manifest);

  return {
    schema_version: schemaVersion,
    dbt_version: dbtVersion,
    is_supported: isSupported,
  };
}
