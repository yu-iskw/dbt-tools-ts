import { describe, expect, it } from 'vitest';

import { buildDocumentTitle } from './document-title';

import type { AnalysisState } from '@web/types';

function analysisWith(
  tones: Array<'danger' | 'positive' | 'warning'>,
  projectName: string | null = 'shop',
): AnalysisState {
  return {
    projectName,
    executions: tones.map((statusTone) => ({ statusTone })),
  } as unknown as AnalysisState;
}

describe('buildDocumentTitle', () => {
  it('is the bare product name without analysis', () => {
    expect(buildDocumentTitle(null, 'health')).toBe('dbt-tools');
  });

  it('leads with the failure count when any execution failed', () => {
    expect(buildDocumentTitle(analysisWith(['danger', 'danger', 'warning']), 'runs')).toBe(
      '✕ 2 failed · Runs · shop — dbt-tools',
    );
  });

  it('shows warnings when nothing failed, singular for one', () => {
    expect(buildDocumentTitle(analysisWith(['warning', 'positive']), 'health')).toBe(
      '⚠ 1 warning · Health · shop — dbt-tools',
    );
    expect(buildDocumentTitle(analysisWith(['warning', 'warning']), 'timeline')).toBe(
      '⚠ 2 warnings · Timeline · shop — dbt-tools',
    );
  });

  it('omits the verdict for a clean run', () => {
    expect(buildDocumentTitle(analysisWith(['positive']), 'inventory')).toBe(
      'Inventory · shop — dbt-tools',
    );
  });

  it('omits the project segment when the project name is null', () => {
    expect(buildDocumentTitle(analysisWith(['positive'], null), 'health')).toBe(
      'Health — dbt-tools',
    );
  });

  it('labels the settings view', () => {
    expect(buildDocumentTitle(analysisWith([]), 'settings')).toBe('Settings · shop — dbt-tools');
  });
});
