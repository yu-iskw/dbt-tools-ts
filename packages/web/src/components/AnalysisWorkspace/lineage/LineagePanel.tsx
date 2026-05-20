import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { PILL_BASE } from '@web/lib/analysis-workspace/constants';
import {
  type LineageDisplayMode,
  buildLineageGraphModel,
} from '@web/lib/analysis-workspace/lineage-model';

import { SectionCard, formatResourceTypeLabel } from '../shared';

import { LensSelector } from './LensSelector';
import { DepthStepper, SharedDepthSelector } from './LineageDepthControls';
import { LineageGraphSurface } from './LineageGraphSurface';

import type { LensMode } from '@web/lib/analysis-workspace/types';
import type { AnalysisState, ResourceNode } from '@web/types';
import type { ReactElement, Dispatch, SetStateAction } from 'react';

export function LineagePanel({
  resource,
  dependencySummary,
  dependencyIndex,
  resourceById,
  upstreamDepth,
  downstreamDepth,
  allDepsMode,
  lensMode,
  activeLegendKeys,
  setUpstreamDepth,
  setDownstreamDepth,
  setAllDepsMode,
  setLensMode,
  setActiveLegendKeys,
  onSelectResource,
  displayMode = 'focused',
  openFullscreen = false,
  onFullscreenChange,
  fullscreenScope = 'viewport',
}: {
  resource: ResourceNode;
  dependencySummary: AnalysisState['dependencyIndex'][string] | undefined;
  dependencyIndex: AnalysisState['dependencyIndex'];
  resourceById: Map<string, ResourceNode>;
  upstreamDepth: number;
  downstreamDepth: number;
  allDepsMode: boolean;
  lensMode: LensMode;
  activeLegendKeys: Set<string>;
  setUpstreamDepth: Dispatch<SetStateAction<number>>;
  setDownstreamDepth: Dispatch<SetStateAction<number>>;
  setAllDepsMode: Dispatch<SetStateAction<boolean>>;
  setLensMode: (mode: LensMode) => void;
  setActiveLegendKeys: Dispatch<SetStateAction<Set<string>>>;
  onSelectResource: (id: string) => void;
  displayMode?: LineageDisplayMode;
  openFullscreen?: boolean;
  onFullscreenChange?: (open: boolean) => void;
  fullscreenScope?: 'container' | 'viewport';
}): ReactElement {
  const [isFullscreenOpen, setFullscreenOpen] = useState(false);
  const ALL_DEPS_DEPTH = 20;

  useEffect(() => {
    setFullscreenOpen(openFullscreen);
  }, [openFullscreen]);

  const setFullscreen = useCallback(
    (open: boolean) => {
      setFullscreenOpen(open);
      onFullscreenChange?.(open);
    },
    [onFullscreenChange],
  );

  useEffect(() => {
    if (!isFullscreenOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenOpen, setFullscreen]);

  useEffect(() => {
    if (!isFullscreenOpen || typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreenOpen]);

  const toggleLegendKey = (key: string) => {
    setActiveLegendKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const graphModel = useMemo(
    () =>
      buildLineageGraphModel({
        resource,
        dependencySummary,
        dependencyIndex,
        resourceById,
        upstreamDepth: allDepsMode ? ALL_DEPS_DEPTH : upstreamDepth,
        downstreamDepth: allDepsMode ? ALL_DEPS_DEPTH : downstreamDepth,
        displayMode,
      }),
    [
      allDepsMode,
      dependencyIndex,
      dependencySummary,
      displayMode,
      downstreamDepth,
      resource,
      resourceById,
      upstreamDepth,
    ],
  );

  const depthToolbar = () => (
    <div className="lineage-toolbar">
      <LensSelector lensMode={lensMode} setLensMode={setLensMode} />
      <SharedDepthSelector
        upstreamDepth={upstreamDepth}
        downstreamDepth={downstreamDepth}
        allDepsMode={allDepsMode}
        setUpstreamDepth={setUpstreamDepth}
        setDownstreamDepth={setDownstreamDepth}
        setAllDepsMode={setAllDepsMode}
      />
      <DepthStepper
        label="Upstream"
        value={upstreamDepth}
        setValue={setUpstreamDepth}
        disabled={allDepsMode}
      />
      <DepthStepper
        label="Downstream"
        value={downstreamDepth}
        setValue={setDownstreamDepth}
        disabled={allDepsMode}
      />
      {activeLegendKeys.size > 0 && (
        <button type="button" className={PILL_BASE} onClick={() => setActiveLegendKeys(new Set())}>
          Clear filters
        </button>
      )}
      {displayMode === 'focused' && !isFullscreenOpen ? (
        <button type="button" className="workspace-pill" onClick={() => setFullscreen(true)}>
          Expand
        </button>
      ) : null}
    </div>
  );

  const summaryHeaderAction =
    displayMode === 'summary' ? (
      <button type="button" className="workspace-pill" onClick={() => setFullscreen(true)}>
        Expand lineage
      </button>
    ) : undefined;

  const fullscreenDialog = isFullscreenOpen ? (
    <div
      className={`lineage-dialog lineage-dialog--${fullscreenScope}`}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="lineage-dialog__backdrop"
        aria-label="Dismiss lineage overlay"
        onClick={() => setFullscreen(false)}
      />
      <section className="lineage-dialog__panel">
        <div className="lineage-dialog__header">
          <div className="lineage-dialog__header-main">
            <div>
              <p className="eyebrow">Lineage</p>
              <h3>{resource.name}</h3>
              <p className="lineage-dialog__subtitle">
                Exact dependency graph with staged upstream and downstream columns.
              </p>
            </div>
            <button
              type="button"
              className="lineage-dialog__close"
              aria-label="Close lineage graph"
              onClick={() => setFullscreen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className="lineage-dialog__toolbar">{depthToolbar()}</div>
        </div>
        <LineageGraphSurface
          model={graphModel}
          onSelectResource={onSelectResource}
          lensMode={lensMode}
          activeLegendKeys={activeLegendKeys}
          onToggleLegendKey={toggleLegendKey}
          displayMode="focused"
          fullscreen
        />
      </section>
    </div>
  ) : null;

  return (
    <>
      <SectionCard
        title={displayMode === 'summary' ? 'Lineage graph' : 'Lineage'}
        subtitle={
          displayMode === 'summary'
            ? undefined
            : `Exact upstream and downstream lineage for ${resource.name}.`
        }
        headerRight={displayMode === 'focused' ? depthToolbar() : summaryHeaderAction}
      >
        <div className={`lineage-summary lineage-summary--${displayMode}`}>
          <div className="lineage-summary__stats">
            <div className="lineage-summary__stat">
              <span>Selected resource</span>
              <strong>{formatResourceTypeLabel(resource.resourceType)}</strong>
            </div>
            <div className="lineage-summary__stat">
              <span>Direct upstream</span>
              <strong>{dependencySummary?.upstreamCount ?? 0}</strong>
            </div>
            <div className="lineage-summary__stat">
              <span>Direct downstream</span>
              <strong>{dependencySummary?.downstreamCount ?? 0}</strong>
            </div>
          </div>
          <LineageGraphSurface
            model={graphModel}
            onSelectResource={onSelectResource}
            lensMode={lensMode}
            activeLegendKeys={activeLegendKeys}
            onToggleLegendKey={toggleLegendKey}
            displayMode={displayMode}
          />
        </div>
      </SectionCard>

      {fullscreenDialog &&
        typeof document !== 'undefined' &&
        createPortal(fullscreenDialog, document.body)}
    </>
  );
}
