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

function changeInput(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(input, value);
  act(() => {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('ArtifactLoadPanel', () => {
  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    configureArtifactSourceFromApi.mockReset();
    discoverArtifactSourceFromApi.mockReset();
    refetchFromApi.mockReset();
    refetchFromApi.mockResolvedValue({
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
    });
  });

  afterEach(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('discovers on Enter and does not auto-discover when source type changes', async () => {
    discoverArtifactSourceFromApi.mockResolvedValue({
      sourceKind: 'local',
      locationDisplay: '/mock/multi',
      candidates: [
        {
          runId: 'runA',
          label: 'Local (runA)',
          updatedAtMs: 1,
          versionToken: 'a',
        },
      ],
      needsSelection: false,
      discoveryError: null,
    });
    configureArtifactSourceFromApi.mockResolvedValue({
      mode: 'preload',
      currentSource: 'preload',
      label: 'Artifacts',
      checkedAtMs: 1,
      remoteProvider: null,
      remoteLocation: null,
      pollIntervalMs: null,
      currentRun: {
        runId: 'runA',
        label: 'Local (runA)',
        updatedAtMs: 1,
        versionToken: 'a',
      },
      pendingRun: null,
      supportsSwitch: false,
      missingOptionalArtifacts: {
        missingCatalog: false,
        missingSources: false,
      },
    });

    const { container, root, onManagedLoad } = renderPanel();
    const locationInput = container.querySelector('#artifact-location-input') as HTMLInputElement;
    const sourceSelect = container.querySelector('#artifact-source-kind') as HTMLSelectElement;

    changeInput(locationInput, '/mock/multi');
    await flushAsync();
    await act(async () => {
      locationInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();
    });

    expect(discoverArtifactSourceFromApi).toHaveBeenCalledTimes(1);
    await flushAsync();
    expect(onManagedLoad).toHaveBeenCalledTimes(1);

    changeInput(sourceSelect, 's3');
    await flushAsync();

    expect(discoverArtifactSourceFromApi).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('runA');

    cleanupRoot(root, container);
  });

  it('auto-commits a single discovered candidate', async () => {
    discoverArtifactSourceFromApi.mockResolvedValue({
      sourceKind: 'local',
      locationDisplay: '/mock/solo',
      candidates: [
        {
          runId: 'soloRun',
          label: 'Local (soloRun)',
          updatedAtMs: 1,
          versionToken: 'solo',
        },
      ],
      needsSelection: false,
      discoveryError: null,
    });
    configureArtifactSourceFromApi.mockResolvedValue({
      mode: 'preload',
      currentSource: 'preload',
      label: 'Artifacts',
      checkedAtMs: 1,
      remoteProvider: null,
      remoteLocation: null,
      pollIntervalMs: null,
      currentRun: {
        runId: 'soloRun',
        label: 'Local (soloRun)',
        updatedAtMs: 1,
        versionToken: 'solo',
      },
      pendingRun: null,
      supportsSwitch: false,
      missingOptionalArtifacts: {
        missingCatalog: false,
        missingSources: false,
      },
    });

    const { container, root, onManagedLoad } = renderPanel();
    const locationInput = container.querySelector('#artifact-location-input') as HTMLInputElement;

    changeInput(locationInput, '/mock/solo');
    await flushAsync();
    await act(async () => {
      locationInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();
    });

    expect(configureArtifactSourceFromApi).toHaveBeenCalledWith(
      'local',
      '/mock/solo',
      'soloRun',
      undefined,
    );
    expect(refetchFromApi).toHaveBeenCalledWith('preload');
    expect(onManagedLoad).toHaveBeenCalledTimes(1);

    cleanupRoot(root, container);
  });

  it('waits for explicit selection before committing multiple candidates', async () => {
    discoverArtifactSourceFromApi.mockResolvedValue({
      sourceKind: 'local',
      locationDisplay: '/mock/multi',
      candidates: [
        {
          runId: 'runAlpha',
          label: 'Local (runAlpha)',
          updatedAtMs: 1,
          versionToken: 'alpha',
        },
        {
          runId: 'runBeta',
          label: 'Local (runBeta)',
          updatedAtMs: 2,
          versionToken: 'beta',
        },
      ],
      needsSelection: true,
      discoveryError: null,
    });
    configureArtifactSourceFromApi.mockResolvedValue({
      mode: 'preload',
      currentSource: 'preload',
      label: 'Artifacts',
      checkedAtMs: 1,
      remoteProvider: null,
      remoteLocation: null,
      pollIntervalMs: null,
      currentRun: {
        runId: 'runBeta',
        label: 'Local (runBeta)',
        updatedAtMs: 2,
        versionToken: 'beta',
      },
      pendingRun: null,
      supportsSwitch: false,
      missingOptionalArtifacts: {
        missingCatalog: false,
        missingSources: false,
      },
    });

    const { container, root, onManagedLoad } = renderPanel();
    const locationInput = container.querySelector('#artifact-location-input') as HTMLInputElement;

    changeInput(locationInput, '/mock/multi');
    await flushAsync();
    await act(async () => {
      locationInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();
    });

    expect(configureArtifactSourceFromApi).not.toHaveBeenCalled();
    expect(onManagedLoad).not.toHaveBeenCalled();

    const betaRadio = container.querySelector('#artifact-run-runBeta') as HTMLInputElement;
    expect(betaRadio).not.toBeNull();
    act(() => {
      betaRadio.click();
    });

    const loadButton = container.querySelector('button.primary-action') as HTMLButtonElement;
    await act(async () => {
      loadButton.click();
      await Promise.resolve();
    });

    expect(configureArtifactSourceFromApi).toHaveBeenCalledWith(
      'local',
      '/mock/multi',
      'runBeta',
      undefined,
    );
    expect(onManagedLoad).toHaveBeenCalledTimes(1);

    cleanupRoot(root, container);
  });
});
