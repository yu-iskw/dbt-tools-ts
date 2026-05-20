import {
  formatAdapterMetricValue,
  getAdapterMetricValue,
  getAdapterResponseFieldsBeyondNormalized,
  getPresentAdapterMetricDescriptors,
  type AdapterResponseMetrics,
} from '@dbt-tools/core/browser';
import { buildMaterializationTooltipText } from '@web/lib/analysis-workspace/materialization-semantics-ui';
import { useLayoutEffect, useRef, useState } from 'react';

import { TOOLTIP_LABEL_STYLE } from './constants';
import { formatMs, formatTimestamp } from './formatting';

import type { HoverState } from './hit-test';
import type { ResourceNode, ResourceTestStats } from '@web/types';
import type { ReactElement } from 'react';

const TOOLTIP_OFFSET_X = 16;
const TOOLTIP_OFFSET_Y = 0;
const TOOLTIP_FRAME_MARGIN = 12;

function formatMaterializationLabel(raw: string): string {
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function computeTooltipPlacement({
  hoverX,
  hoverY,
  frameWidth,
  frameHeight,
  tooltipWidth,
  tooltipHeight,
  offsetX = TOOLTIP_OFFSET_X,
  offsetY = TOOLTIP_OFFSET_Y,
  margin = TOOLTIP_FRAME_MARGIN,
}: {
  hoverX: number;
  hoverY: number;
  frameWidth: number;
  frameHeight: number;
  tooltipWidth: number;
  tooltipHeight: number;
  offsetX?: number;
  offsetY?: number;
  margin?: number;
}): { left: number; top: number } {
  const usableFrameWidth = Math.max(frameWidth, tooltipWidth + margin * 2);
  const usableFrameHeight = Math.max(frameHeight, tooltipHeight + margin * 2);

  let left = hoverX + offsetX;
  if (left + tooltipWidth > usableFrameWidth - margin) {
    left = hoverX - tooltipWidth - offsetX;
  }

  let top = hoverY + offsetY;
  if (top + tooltipHeight > usableFrameHeight - margin) {
    top = usableFrameHeight - tooltipHeight - margin;
  }

  left = Math.min(
    Math.max(margin, left),
    Math.max(margin, usableFrameWidth - tooltipWidth - margin),
  );
  top = Math.min(
    Math.max(margin, top),
    Math.max(margin, usableFrameHeight - tooltipHeight - margin),
  );

  return { left, top };
}

function resourceHasTimelineTooltipAdapter(resource: ResourceNode | undefined): boolean {
  if (!resource) return false;
  const adapterMetrics = resource.adapterMetrics;
  const adapterResponseFields = resource.adapterResponseFields;
  if (getAdapterResponseFieldsBeyondNormalized(adapterMetrics, adapterResponseFields).length > 0) {
    return true;
  }
  if (adapterMetrics == null) return false;
  return getPresentAdapterMetricDescriptors([adapterMetrics]).length > 0;
}

function GanttTooltipAdapterResponse({ resource }: { resource: ResourceNode | undefined }) {
  if (!resource) return null;
  const adapterMetrics = resource.adapterMetrics;
  const adapterResponseFields = resource.adapterResponseFields;
  const extraAdapterRawFields = getAdapterResponseFieldsBeyondNormalized(
    adapterMetrics,
    adapterResponseFields,
  );
  const adapterMetricDescriptors =
    adapterMetrics != null ? getPresentAdapterMetricDescriptors([adapterMetrics]) : [];
  if (extraAdapterRawFields.length === 0 && adapterMetricDescriptors.length === 0) {
    return null;
  }

  const metrics: AdapterResponseMetrics | undefined = adapterMetrics;

  return (
    <div style={{ marginTop: '0.25rem', maxWidth: 340 }}>
      <div style={{ marginBottom: '0.15rem' }}>
        <span style={TOOLTIP_LABEL_STYLE}>Adapter response</span>
      </div>
      {adapterMetricDescriptors.length > 0 && metrics != null ? (
        <div
          style={{
            whiteSpace: 'pre-wrap',
            fontSize: '0.82rem',
            lineHeight: 1.35,
          }}
        >
          {adapterMetricDescriptors
            .map((descriptor) => {
              const value = getAdapterMetricValue(metrics, descriptor.key);
              const text = value !== undefined ? formatAdapterMetricValue(descriptor, value) : '—';
              return `${descriptor.shortLabel}: ${text}`;
            })
            .join('\n')}
        </div>
      ) : null}
      {extraAdapterRawFields.length > 0 ? (
        <div
          style={{
            marginTop: adapterMetricDescriptors.length > 0 ? '0.35rem' : 0,
            whiteSpace: 'pre-wrap',
            fontSize: '0.82rem',
            lineHeight: 1.35,
          }}
          aria-label="Additional adapter response fields"
        >
          {extraAdapterRawFields.map((field) => `${field.label}: ${field.displayValue}`).join('\n')}
        </div>
      ) : null}
    </div>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={TOOLTIP_LABEL_STYLE}>{label}: </span>
      {value}
    </div>
  );
}

function TooltipSemanticsBlock({
  semantics,
  materialized,
}: {
  semantics: HoverState['item']['semantics'];
  materialized?: string | null;
}) {
  if (semantics) {
    return (
      <div style={{ marginTop: '0.25rem', maxWidth: 340 }}>
        <div>
          <span style={TOOLTIP_LABEL_STYLE}>Semantics: </span>
        </div>
        <div
          style={{
            whiteSpace: 'pre-wrap',
            fontSize: '0.82rem',
            lineHeight: 1.35,
          }}
        >
          {buildMaterializationTooltipText(semantics)}
        </div>
      </div>
    );
  }
  if (materialized) {
    return <TooltipRow label="Materialization" value={formatMaterializationLabel(materialized)} />;
  }
  return null;
}

function TooltipTimingBlock({
  hover,
  runStartedAt,
  canShowTimestamps,
  timeZone,
}: {
  hover: HoverState;
  runStartedAt: number | null | undefined;
  canShowTimestamps: boolean;
  timeZone: string;
}) {
  const startValue =
    canShowTimestamps && runStartedAt != null
      ? formatTimestamp(runStartedAt + hover.item.start, timeZone)
      : `+${formatMs(hover.item.start)}`;
  const endValue =
    canShowTimestamps && runStartedAt != null
      ? formatTimestamp(runStartedAt + hover.item.end, timeZone)
      : `+${formatMs(hover.item.end)}`;

  return (
    <>
      <TooltipRow label="Start" value={startValue} />
      <TooltipRow label="End" value={endValue} />
      <TooltipRow label="Duration" value={formatMs(hover.item.duration)} />
    </>
  );
}

function TooltipPhaseRow({
  label,
  start,
  end,
}: {
  label: string;
  start?: number | null;
  end?: number | null;
}) {
  if (start == null || end == null || end <= start) {
    return null;
  }
  return <TooltipRow label={label} value={formatMs(end - start)} />;
}

function TooltipTestsRow({ testStats }: { testStats?: ResourceTestStats }) {
  if (!testStats) return null;
  const parts = [
    testStats.pass > 0 ? `✓${testStats.pass}` : null,
    testStats.error > 0 ? `✗${testStats.error}` : null,
    testStats.warn > 0 ? `!${testStats.warn}` : null,
    testStats.skipped > 0 ? `−${testStats.skipped}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <TooltipRow label="Tests" value={parts.join(' · ')} />;
}

export function GanttTooltip({
  hover,
  frameWidth,
  frameHeight,
  runStartedAt,
  canShowTimestamps,
  timeZone,
  testStats,
  resourceByUniqueId,
}: {
  hover: HoverState;
  frameWidth: number;
  frameHeight: number;
  runStartedAt: number | null | undefined;
  canShowTimestamps: boolean;
  timeZone: string;
  testStats?: ResourceTestStats;
  /** Snapshot resources — used to show adapter_response on hover without duplicating fields on `GanttItem`. */
  resourceByUniqueId?: ReadonlyMap<string, ResourceNode>;
}): ReactElement {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() =>
    computeTooltipPlacement({
      hoverX: hover.x,
      hoverY: hover.y,
      frameWidth,
      frameHeight,
      tooltipWidth: 220,
      tooltipHeight: 160,
    }),
  );

  const tooltipResource = resourceByUniqueId?.get(hover.item.unique_id);
  const showAdapterBlock = resourceHasTimelineTooltipAdapter(tooltipResource);

  useLayoutEffect(() => {
    const tooltipEl = tooltipRef.current;
    if (!tooltipEl) return;
    const next = computeTooltipPlacement({
      hoverX: hover.x,
      hoverY: hover.y,
      frameWidth,
      frameHeight,
      tooltipWidth: tooltipEl.offsetWidth,
      tooltipHeight: tooltipEl.offsetHeight,
    });
    setPosition((current) =>
      current.left === next.left && current.top === next.top ? current : next,
    );
  }, [frameHeight, frameWidth, hover.x, hover.y, hover.item.unique_id, showAdapterBlock]);

  return (
    <div
      ref={tooltipRef}
      className="chart-tooltip"
      style={{
        position: 'absolute',
        left: position.left,
        top: position.top,
        pointerEvents: 'none',
        zIndex: 20,
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>
        {hover.item.name || hover.item.unique_id}
      </div>
      <TooltipRow label="Status" value={hover.item.status} />
      {hover.item.resourceType && <TooltipRow label="Type" value={hover.item.resourceType} />}
      <TooltipSemanticsBlock
        semantics={hover.item.semantics}
        materialized={hover.item.materialized}
      />
      <TooltipTimingBlock
        hover={hover}
        runStartedAt={runStartedAt}
        canShowTimestamps={canShowTimestamps}
        timeZone={timeZone}
      />
      <TooltipPhaseRow
        label="Compile"
        start={hover.item.compileStart}
        end={hover.item.compileEnd}
      />
      <TooltipPhaseRow
        label="Execute"
        start={hover.item.executeStart}
        end={hover.item.executeEnd}
      />
      <TooltipTestsRow testStats={testStats} />
      <GanttTooltipAdapterResponse resource={tooltipResource} />
    </div>
  );
}
