import { truncateSqlText } from '@dbt-tools/core/util/sql-truncation';

export function truncateResourceCodeFields<
  T extends { rawCode?: string | null; compiledCode?: string | null },
>(resource: T): T {
  const out = { ...resource };
  if (out.rawCode != null && out.rawCode !== '') {
    out.rawCode = truncateSqlText(out.rawCode).text;
  }
  if (out.compiledCode != null && out.compiledCode !== '') {
    out.compiledCode = truncateSqlText(out.compiledCode).text;
  }
  return out;
}
