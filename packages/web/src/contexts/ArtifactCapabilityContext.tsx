import { createContext, useContext } from 'react';
import type { MissingOptionalArtifactsState } from '@web/services/artifactSourceApi';

const defaultCaps: MissingOptionalArtifactsState = {
  missingCatalog: false,
  missingSources: false,
};

export const ArtifactCapabilityContext = createContext<MissingOptionalArtifactsState>(defaultCaps);

export function useArtifactCapability(): MissingOptionalArtifactsState {
  return useContext(ArtifactCapabilityContext);
}
