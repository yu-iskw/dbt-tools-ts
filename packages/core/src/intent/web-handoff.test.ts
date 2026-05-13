import { describe, expect, it } from 'vitest';
import { buildDiscoverWebUrl, buildExplainWebUrl, buildImpactWebUrl } from './web-handoff';

describe('web-handoff', () => {
  it('buildDiscoverWebUrl normalizes bare origin to path before query', () => {
    const u = buildDiscoverWebUrl('http://127.0.0.1:5173', 'orders');
    expect(u).toBe('http://127.0.0.1:5173/?view=inventory&q=orders');
  });

  it('buildDiscoverWebUrl omits q when query is empty', () => {
    const u = buildDiscoverWebUrl('http://127.0.0.1:5173', '');
    expect(u).toBe('http://127.0.0.1:5173/?view=inventory');
  });

  it('buildDiscoverWebUrl preserves structured filters inside q', () => {
    const u = buildDiscoverWebUrl(
      'http://127.0.0.1:5173',
      'orders type:model package:jaffle_shop tag:daily path:models/marts',
    );
    expect(u).toContain('view=inventory');
    expect(u).toContain(
      'q=orders+type%3Amodel+package%3Ajaffle_shop+tag%3Adaily+path%3Amodels%2Fmarts',
    );
  });

  it('buildExplainWebUrl opens inventory summary for a unique_id', () => {
    const u = buildExplainWebUrl('http://127.0.0.1:5173', 'model.pkg.orders');
    expect(u).toContain('view=inventory');
    expect(u).toContain('resource=model.pkg.orders');
    expect(u).toContain('assetTab=summary');
  });

  it('buildImpactWebUrl opens inventory lineage tab', () => {
    const u = buildImpactWebUrl('http://127.0.0.1:5173', 'model.pkg.orders');
    expect(u).toContain('view=inventory');
    expect(u).toContain('assetTab=lineage');
  });
});
