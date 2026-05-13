import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { AnalysisState, ResourceNode } from '@web/types';
import type {
  AssetViewState,
  LineageViewState,
  WorkspaceView,
} from '@web/lib/analysis-workspace/types';
import { searchResourcesFromWorker } from '@web/services/analysisLoader';
import { AssetsView } from '../AssetsView';
import { EmptyState } from '../../../EmptyState';
import { WorkspaceScaffold } from '../../shared';

const LINEAGE_SEARCH_DEBOUNCE_MS = 200;

export function InventoryView({
  analysis,
  resource,
  onSelectResource,
  assetViewState,
  onAssetViewStateChange,
  lineageViewState,
  onLineageViewStateChange,
  onInvestigationSelectionChange,
  onNavigateTo,
}: {
  analysis: AnalysisState;
  resource: ResourceNode | null;
  onSelectResource: (id: string) => void;
  assetViewState: AssetViewState;
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
  lineageViewState: LineageViewState;
  onLineageViewStateChange: Dispatch<SetStateAction<LineageViewState>>;
  onInvestigationSelectionChange: Dispatch<
    SetStateAction<{
      selectedResourceId: string | null;
      selectedExecutionId: string | null;
      sourceLens: WorkspaceView | null;
    }>
  >;
  onNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: AssetViewState['activeTab'];
      rootResourceId?: string;
    },
  ) => void;
}) {
  const [lineageSearchQuery, setLineageSearchQuery] = useState('');
  const [lineageSuggestions, setLineageSuggestions] = useState<ResourceNode[]>([]);
  const [lineageSearchLoading, setLineageSearchLoading] = useState(false);
  const [quickResourceId, setQuickResourceId] = useState('');
  const searchRequestSequence = useRef(0);

  useEffect(() => {
    const q = lineageSearchQuery.trim();
    const delayMs = q ? LINEAGE_SEARCH_DEBOUNCE_MS : 0;
    const handle = window.setTimeout(() => {
      if (!q) {
        searchRequestSequence.current += 1;
        setLineageSuggestions([]);
        setLineageSearchLoading(false);
        return;
      }

      searchRequestSequence.current += 1;
      const requestId = searchRequestSequence.current;
      setLineageSearchLoading(true);
      void searchResourcesFromWorker(q)
        .then((rows) => {
          if (searchRequestSequence.current === requestId) {
            setLineageSuggestions(rows);
          }
        })
        .catch(() => {
          if (searchRequestSequence.current === requestId) {
            setLineageSuggestions([]);
          }
        })
        .finally(() => {
          if (searchRequestSequence.current === requestId) {
            setLineageSearchLoading(false);
          }
        });
    }, delayMs);
    return () => window.clearTimeout(handle);
  }, [lineageSearchQuery]);

  const openLineageForResource = (id: string) => {
    if (!id) return;
    onAssetViewStateChange((c) => ({
      ...c,
      selectedResourceId: id,
      activeTab: 'lineage',
    }));
    onLineageViewStateChange((c) => ({
      ...c,
      rootResourceId: id,
      selectedResourceId: id,
    }));
    onInvestigationSelectionChange((c) => ({
      ...c,
      selectedResourceId: id,
      sourceLens: 'inventory',
    }));
  };

  return (
    <WorkspaceScaffold
      title="Inventory"
      description="Browse, filter, and inspect all workspace assets."
      className="inventory-view"
      suppressHeader={resource != null}
    >
      {resource ? (
        <AssetsView
          analysis={analysis}
          resource={resource}
          onSelectResource={(id) => {
            onSelectResource(id);
            onInvestigationSelectionChange((current) => ({
              ...current,
              selectedResourceId: id,
              sourceLens: 'inventory',
            }));
          }}
          assetViewState={assetViewState}
          onAssetViewStateChange={onAssetViewStateChange}
          lineageViewState={lineageViewState}
          onLineageViewStateChange={onLineageViewStateChange}
          onNavigateTo={onNavigateTo}
        />
      ) : (
        <div className="inventory-empty-state">
          <div className="inventory-empty-state__inner">
            <EmptyState
              icon="◱"
              headline="Select an asset to inspect"
              subtext="Use the browser panel on the left to find and select a model, source, seed, or other asset."
            />
            <div
              className="inventory-empty-state__lineage-pick"
              role="group"
              aria-label="Jump to lineage for an asset"
            >
              <label
                className="inventory-empty-state__lineage-label"
                htmlFor="inventory-lineage-search"
              >
                Or search for an asset to open its lineage graph
              </label>
              <input
                id="inventory-lineage-search"
                type="search"
                className="inventory-empty-state__lineage-search"
                value={lineageSearchQuery}
                onChange={(e) => {
                  setLineageSearchQuery(e.target.value);
                  setQuickResourceId('');
                }}
                placeholder="Name, type, package, or unique id…"
                autoComplete="off"
                enterKeyHint="search"
              />
              {lineageSearchLoading && (
                <p className="inventory-empty-state__lineage-hint" aria-live="polite">
                  Searching…
                </p>
              )}
              {lineageSuggestions.length > 0 && (
                <ul
                  className="inventory-empty-state__lineage-suggestions"
                  role="listbox"
                  aria-label="Matching assets"
                >
                  {lineageSuggestions.map((entry) => (
                    <li key={entry.uniqueId} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={quickResourceId === entry.uniqueId}
                        className={
                          quickResourceId === entry.uniqueId
                            ? 'inventory-lineage-suggestion inventory-lineage-suggestion--active'
                            : 'inventory-lineage-suggestion'
                        }
                        onClick={() => {
                          searchRequestSequence.current += 1;
                          setQuickResourceId(entry.uniqueId);
                          setLineageSearchQuery(`${entry.name} (${entry.resourceType})`);
                          setLineageSuggestions([]);
                          setLineageSearchLoading(false);
                        }}
                      >
                        <span className="inventory-lineage-suggestion__name">{entry.name}</span>
                        <span className="inventory-lineage-suggestion__meta">
                          {entry.resourceType}
                          {entry.packageName ? ` · ${entry.packageName}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="workspace-pill"
                disabled={!quickResourceId}
                onClick={() => openLineageForResource(quickResourceId)}
              >
                Open lineage graph
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceScaffold>
  );
}
