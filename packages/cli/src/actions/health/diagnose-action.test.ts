import * as fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createJaffleArtifactBundleDir } from '../../internal/cli-test-bundle-dir';

import { diagnoseNodeAction } from './diagnose-action';

describe('diagnoseNodeAction', () => {
  const handleError = (error: unknown) => {
    throw error;
  };

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let dbtTargetDir: string;

  beforeEach(async () => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    dbtTargetDir = await createJaffleArtifactBundleDir();
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
    await fs.rm(dbtTargetDir, { recursive: true, force: true });
  });

  it('emits runnable primitive commands', async () => {
    await diagnoseNodeAction('customers', { dbtTarget: dbtTargetDir, json: true }, handleError);
    const raw = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
    const parsed = JSON.parse(raw) as { primitive_commands: string[] };
    expect(parsed.primitive_commands).toContain(
      'dbt-tools deps "model.jaffle_shop.customers" --direction downstream --format flat',
    );
  });
});
