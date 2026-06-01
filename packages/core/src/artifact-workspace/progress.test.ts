import { describe, expect, it, vi } from 'vitest';

import { ArtifactLoadProgressHub } from './progress.js';

describe('ArtifactLoadProgressHub', () => {
  it('hasConsumers is true when callback or listeners are registered', () => {
    const hub = new ArtifactLoadProgressHub();
    expect(hub.hasConsumers()).toBe(false);

    hub.setCallback(vi.fn());
    expect(hub.hasConsumers()).toBe(true);
    hub.setCallback(undefined);
    expect(hub.hasConsumers()).toBe(false);

    const unsubscribe = hub.subscribe(vi.fn());
    expect(hub.hasConsumers()).toBe(true);
    unsubscribe();
    expect(hub.hasConsumers()).toBe(false);
  });

  it('emit fans out to callback and subscribers', () => {
    const hub = new ArtifactLoadProgressHub();
    const callback = vi.fn();
    const listener = vi.fn();
    hub.setCallback(callback);
    hub.subscribe(listener);

    hub.emit('ready', 100, 'Snapshot ready');

    expect(callback).toHaveBeenCalledWith({
      phase: 'ready',
      progress: 100,
      message: 'Snapshot ready',
    });
    expect(listener).toHaveBeenCalledWith({
      phase: 'ready',
      progress: 100,
      message: 'Snapshot ready',
    });
  });
});
