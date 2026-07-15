import { readValidatedUtf8 } from '@dbt-tools/core';

import type { RemoteObjectStoreClient } from '@dbt-tools/core/artifact-io';
import type { ResolvedArtifactRun } from '@dbt-tools/core/artifact-workspace';

export interface ArtifactRunBytes {
  manifestBytes: Uint8Array;
  runResultsBytes: Uint8Array;
  catalogBytes?: Uint8Array;
  sourcesBytes?: Uint8Array;
}

export async function readLocalRunArtifactBytes(
  run: ResolvedArtifactRun,
): Promise<ArtifactRunBytes> {
  const encoder = new TextEncoder();
  const [manifestText, runResultsText, catalogText, sourcesText] = await Promise.all([
    readValidatedUtf8(run.manifestKey),
    readValidatedUtf8(run.runResultsKey),
    run.catalogKey != null
      ? readValidatedUtf8(run.catalogKey).catch(() => null)
      : Promise.resolve(null),
    run.sourcesKey != null
      ? readValidatedUtf8(run.sourcesKey).catch(() => null)
      : Promise.resolve(null),
  ]);
  const manifestBytes = encoder.encode(manifestText);
  const runResultsBytes = encoder.encode(runResultsText);
  const catalogBytes = catalogText != null ? encoder.encode(catalogText) : null;
  const sourcesBytes = sourcesText != null ? encoder.encode(sourcesText) : null;

  return {
    manifestBytes,
    runResultsBytes,
    ...(catalogBytes != null ? { catalogBytes } : {}),
    ...(sourcesBytes != null ? { sourcesBytes } : {}),
  };
}

export async function readRemoteRunArtifactBytes(
  run: ResolvedArtifactRun,
  bucket: string,
  client: RemoteObjectStoreClient,
): Promise<ArtifactRunBytes> {
  const readOptional = async (key: string | undefined): Promise<Uint8Array | null> => {
    if (key == null) return null;
    try {
      return await client.readObjectBytes(bucket, key);
    } catch {
      return null;
    }
  };

  const [manifestBytes, runResultsBytes, catalogBytes, sourcesBytes] = await Promise.all([
    client.readObjectBytes(bucket, run.manifestKey),
    client.readObjectBytes(bucket, run.runResultsKey),
    readOptional(run.catalogKey),
    readOptional(run.sourcesKey),
  ]);

  return {
    manifestBytes,
    runResultsBytes,
    ...(catalogBytes != null ? { catalogBytes } : {}),
    ...(sourcesBytes != null ? { sourcesBytes } : {}),
  };
}
