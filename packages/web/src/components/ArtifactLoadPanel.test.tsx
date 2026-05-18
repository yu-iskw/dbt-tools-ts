// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtifactLoadPanel } from './ArtifactLoadPanel';

const { configureArtifactSourceFromApi, discoverArtifactSourceFromApi, refetchFromApi } =
  vi.hoisted(() => ({
    configureArtifactSourceFromApi: vi.fn(),
    discoverArtifactSourceFromApi: vi.fn(),
    refetchFromApi: vi.fn(),
  }));

vi.mock('../services/artifactSourceApi', () => ({
  configureArtifactSourceFromApi,
  discoverArtifactSourceFromApi,
  refetchFromApi,
}));

vi.mock('./ui/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const mockLoadResult = {
  analysis: { projectName: 'loaded-run' },
  metrics: {
    requestId: 1,
    source: 'preload',
    dispatchMarkName: 'dispatch',
    readyMarkName: 'ready',
    analysisReadyMeasureName: 'measure',
    timings: {
      decodeMs: 0,
      parseMs: 0,
      graphBuildMs: 0,
      snapshotBuildMs: 0,
      totalWorkerMs: 0,
    },
  },
};

const configuredStatus = {
  mode: 'preload' as const,
  currentSource: 'preload' as const,
  label: 'Artifacts',
  checkedAtMs: 1,
  remoteProvider: null,
  remoteLocation: null,
  pollIntervalMs: null,
  currentRun: {
    runId: 'current',
    label: 'Local',
    updatedAtMs: 1,
    versionToken: 'solo',
  },
  pendingRun: null,
  supportsSwitch: false,
  missingOptionalArtifacts: {
    missingCatalog: false,
    missingSources: false,
  },
};

function renderPanel() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onManagedLoad = vi.fn();
  const onError = vi.fn();
  act(() => {
    root.render(<ArtifactLoadPanel onManagedLoad={onManagedLoad} onError={onError} />);
  });
  return { container, root, onManagedLoad, onError };
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
  });
}

function changeInput(input: HTMLInputElement, value: string) {
  const prototype = HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(input, value);
  act(() => {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function clickSourceTab(container: HTMLElement, kind: 'local' | 's3' | 'gcs') {
  const tab = container.querySelector(`#artifact-source-tab-${kind}`) as HTMLButtonElement;
  act(() => {
    tab.click();
  });
}

describe('ArtifactLoadPanel', () => {
  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    configureArtifactSourceFromApi.mockReset();
    discoverArtifactSourceFromApi.mockReset();
    refetchFromApi.mockReset();
    refetchFromApi.mockResolvedValue(mockLoadResult);
    configureArtifactSourceFromApi.mockResolvedValue(configuredStatus);
  });

  afterEach(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('discovers on Enter and auto-loads when discovery succeeds', async () => {
    discoverArtifactSourceFromApi.mockResolvedValue({
      sourceKind: 'local',
      locationDisplay: '/mock/solo',
      discoveryError: null,
    });

    const { container, root, onManagedLoad } = renderPanel();
    const locationInput = container.querySelector('#artifact-location-input') as HTMLInputElement;

    changeInput(locationInput, '/mock/solo');
    await flushAsync();
    await act(async () => {
      locationInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();
    });

    expect(discoverArtifactSourceFromApi).toHaveBeenCalledTimes(1);
    await flushAsync();
    expect(configureArtifactSourceFromApi).toHaveBeenCalledWith(
      'local',
      '/mock/solo',
      undefined,
      undefined,
    );
    expect(onManagedLoad).toHaveBeenCalledTimes(1);

    cleanupRoot(root, container);
  });

  it('does not auto-discover when source type changes', async () => {
    discoverArtifactSourceFromApi.mockResolvedValue({
      sourceKind: 'local',
      locationDisplay: '/mock/solo',
      discoveryError: null,
    });

    const { container, root } = renderPanel();
    const locationInput = container.querySelector('#artifact-location-input') as HTMLInputElement;

    changeInput(locationInput, '/mock/solo');
    await flushAsync();
    clickSourceTab(container, 's3');
    await flushAsync();

    expect(discoverArtifactSourceFromApi).not.toHaveBeenCalled();

    cleanupRoot(root, container);
  });

  it('disables load and blocks configure when location changes after a successful local scan', async () => {
    discoverArtifactSourceFromApi.mockResolvedValue({
      sourceKind: 'local',
      locationDisplay: '/mock/a',
      discoveryError: null,
    });

    const { container, root, onManagedLoad, onError } = renderPanel();
    const locationInput = container.querySelector('#artifact-location-input') as HTMLInputElement;

    changeInput(locationInput, '/mock/a');
    await flushAsync();
    await act(async () => {
      locationInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();
    });
    await flushAsync();

    configureArtifactSourceFromApi.mockClear();
    onManagedLoad.mockClear();
    onError.mockClear();

    changeInput(locationInput, '/mock/b');
    await flushAsync();

    const loadButton = container.querySelector('button.primary-action') as HTMLButtonElement;
    expect(loadButton.disabled).toBe(true);

    await act(async () => {
      loadButton.click();
      await Promise.resolve();
    });
    await flushAsync();

    expect(configureArtifactSourceFromApi).not.toHaveBeenCalled();
    expect(onManagedLoad).not.toHaveBeenCalled();

    cleanupRoot(root, container);
  });

  it('disables load when GCS impersonation changes after a successful scan', async () => {
    discoverArtifactSourceFromApi.mockResolvedValue({
      sourceKind: 'gcs',
      locationDisplay: 'gs://b/p',
      discoveryError: null,
    });

    const { container, root, onManagedLoad } = renderPanel();
    const locationInput = container.querySelector('#artifact-location-input') as HTMLInputElement;

    clickSourceTab(container, 'gcs');
    await flushAsync();
    changeInput(locationInput, 'gs://b/p');
    await flushAsync();
    await act(async () => {
      locationInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();
    });
    await flushAsync();

    configureArtifactSourceFromApi.mockClear();
    onManagedLoad.mockClear();

    const impersonationInput = container.querySelector(
      '#artifact-gcs-impersonated-service-account',
    ) as HTMLInputElement;
    changeInput(impersonationInput, 'other@proj.iam.gserviceaccount.com');
    await flushAsync();

    const loadButton = container.querySelector('button.primary-action') as HTMLButtonElement;
    expect(loadButton.disabled).toBe(true);

    await act(async () => {
      loadButton.click();
      await Promise.resolve();
    });
    await flushAsync();

    expect(configureArtifactSourceFromApi).not.toHaveBeenCalled();
    expect(onManagedLoad).not.toHaveBeenCalled();

    cleanupRoot(root, container);
  });
});
