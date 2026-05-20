import type { ReactElement } from 'react';
const WORKSPACE_FEATURES = [
  {
    title: 'Health-first overview',
    body: 'Spot failing nodes, long-running bottlenecks, and critical-path pressure before opening individual assets.',
  },
  {
    title: 'Catalog-style context',
    body: 'Browse lineage-adjacent metadata such as descriptions, packages, execution status, and dependency depth in one flow.',
  },
  {
    title: 'Timeline investigation',
    body: 'Shift from summary to execution sequencing without leaving the workspace, inspired by dbt docs and observability tools.',
  },
] as const;

export function ArtifactLoadPanelHero(): ReactElement {
  return (
    <div className="upload-hero__copy">
      <p className="eyebrow">Load artifacts</p>
      <h2>Point the workspace at a directory or cloud prefix that contains dbt JSON artifacts.</h2>
      <p>
        The server discovers <code>manifest.json</code> and <code>run_results.json</code>{' '}
        (required), plus optional <code>catalog.json</code> and <code>sources.json</code>. Cloud
        access uses server-side credentials only.
      </p>

      <div className="upload-hero__callout">
        <span className="upload-hero__callout-badge">Layout</span>
        <strong>Artifacts must be at the location root (typical dbt target/).</strong>
        <p>
          Point at the directory or prefix that directly contains manifest.json and
          run_results.json.
        </p>
      </div>

      <div className="upload-feature-grid">
        {WORKSPACE_FEATURES.map((feature) => (
          <article key={feature.title} className="upload-feature-card">
            <strong>{feature.title}</strong>
            <p>{feature.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
