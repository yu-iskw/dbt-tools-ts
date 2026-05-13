import { describe, expect, it } from 'vitest';
import { defaultRunsSortDirection, nextRunsSort, runsColumnHeaderSortUi } from './runsSort';

describe('runsSort', () => {
  it('defaults duration and attention to descending', () => {
    expect(defaultRunsSortDirection('duration')).toBe('desc');
    expect(defaultRunsSortDirection('attention')).toBe('desc');
  });

  it('defaults name and adapter columns', () => {
    expect(defaultRunsSortDirection('name')).toBe('asc');
    expect(defaultRunsSortDirection('adapter:bytes')).toBe('desc');
  });

  it('toggles direction when the same column is selected', () => {
    expect(nextRunsSort('name', { sortBy: 'name', sortDirection: 'asc' })).toEqual({
      sortBy: 'name',
      sortDirection: 'desc',
    });
  });

  it('applies column default direction when switching columns', () => {
    expect(nextRunsSort('duration', { sortBy: 'name', sortDirection: 'asc' })).toEqual({
      sortBy: 'duration',
      sortDirection: 'desc',
    });
  });

  it('exposes header UI only for the active column', () => {
    expect(runsColumnHeaderSortUi('name', 'duration', 'desc').ariaSort).toBe('none');
    expect(runsColumnHeaderSortUi('name', 'name', 'asc').ariaSort).toBe('ascending');
  });
});
