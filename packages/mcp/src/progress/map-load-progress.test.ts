import { describe, expect, it, vi } from 'vitest';

import { createMcpLoadProgressNotifier } from './map-load-progress.js';

describe('createMcpLoadProgressNotifier', () => {
  it('returns undefined when progressToken is missing', () => {
    expect(createMcpLoadProgressNotifier(undefined)).toBeUndefined();
    expect(createMcpLoadProgressNotifier({ _meta: {} } as never)).toBeUndefined();
  });

  it('throttles intermediate updates and allows phase reset', async () => {
    vi.useFakeTimers();
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const notifier = createMcpLoadProgressNotifier({
      _meta: { progressToken: 'tok' },
      sendNotification,
    } as never);

    notifier?.({
      phase: 'validate-target',
      progress: 5,
      message: 'Validating',
    });
    notifier?.({
      phase: 'discover-bundle',
      progress: 25,
      message: 'Discovering',
    });
    expect(sendNotification).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(250);
    notifier?.({
      phase: 'ready',
      progress: 100,
      message: 'Ready',
    });
    expect(sendNotification).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(250);
    notifier?.({
      phase: 'validate-target',
      progress: 5,
      message: 'Retry',
    });
    expect(sendNotification).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });
});
