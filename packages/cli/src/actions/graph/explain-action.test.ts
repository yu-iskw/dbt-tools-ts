import * as fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createJaffleArtifactBundleDir } from '../../internal/cli-test-bundle-dir';

import { explainAction } from './explain-action';

describe('explainAction', () => {
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

  it('emits explain JSON with resolved target', async () => {
    await explainAction('customers', { dbtTarget: dbtTargetDir, json: true }, handleError);
    const raw = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as {
      intent: string;
      target: { resolved_unique_id: string };
      summary: { name: string };
    };
    expect(parsed.intent).toBe('explain');
    expect(parsed.target.resolved_unique_id).toContain('customers');
    expect(parsed.summary.name.length).toBeGreaterThan(0);
  });

  it('adds web_url when DBT_TOOLS_WEB_BASE_URL is set', async () => {
    vi.stubEnv('DBT_TOOLS_WEB_BASE_URL', 'http://127.0.0.1:5173');
    try {
      await explainAction('customers', { dbtTarget: dbtTargetDir, json: true }, handleError);
      const raw = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(raw) as { web_url?: string };
      expect(parsed.web_url).toContain('view=inventory');
      expect(parsed.web_url).toContain('assetTab=summary');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('emits runnable primitive commands', async () => {
    await explainAction('customers', { dbtTarget: dbtTargetDir, json: true }, handleError);
    const raw = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
    const parsed = JSON.parse(raw) as { primitive_commands: string[] };
    expect(parsed.primitive_commands).toContain(
      'dbt-tools deps "model.jaffle_shop.customers" --direction downstream',
    );
    expect(parsed.primitive_commands).toContain('dbt-tools search "model.jaffle_shop.customers"');
  });
});
