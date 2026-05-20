import { STATUS_COLORS, getResourceTypeColor, getStatusColor } from '@web/constants/colors';
import { getResourceTypeSoftFill, getThemeHex } from '@web/constants/theme-colors';
import { useSyncedDocumentTheme } from '@web/hooks/use-theme';
import { GANTT_LEGEND_PRIMARY_TYPES } from '@web/lib/analysis-workspace/constants';
import {
  MATERIALIZATION_KIND_ORDER,
  materializationKindShortLabel,
} from '@web/lib/analysis-workspace/materialization-semantics-ui';

import type { MaterializationKind } from '@web/types';
import type { ReactElement, CSSProperties } from 'react';

interface GanttLegendProps {
  /** Count per status key (lowercase). Only entries with count > 0 are shown. */
  statusCounts: ReadonlyMap<string, number>;
  /** Count per resource type in scoped timeline data. Primary types are always listed; count may be 0. */
  typeCounts: ReadonlyMap<string, number>;
  /** Optional: when provided, clicking a swatch toggles the corresponding filter. */
  activeStatuses?: Set<string>;
  activeTypes?: Set<string>;
  onToggleStatus?: (status: string) => void;
  onToggleType?: (type: string) => void;
  /** Whether test chips are currently shown inside bundle rows. */
  showTests?: boolean;
  onToggleShowTests?: () => void;
  /** Scoped count of test/unit_test executions in gantt data (omitted from typeCounts aggregates). */
  testsLegendCount?: number;
  /** Whether the view is in failures-only mode. */
  failuresOnly?: boolean;
  onToggleFailuresOnly?: () => void;
  /** Explain bar fill (resource type) vs border (status). */
  showBarEncodingKey?: boolean;
  /** Show compile vs execute phase swatches when run_results include both phases. */
  showCompileExecuteLegend?: boolean;
  /** Count per normalized materialization kind in scoped timeline rows (read-only legend). */
  materializationCounts?: ReadonlyMap<string, number>;
}

const SWATCH_STYLE: CSSProperties = {
  display: 'inline-block',
  width: 10,
  height: 10,
  borderRadius: 2,
  flexShrink: 0,
};

const LEGEND_ITEM_ACTIVE_CLASS = ' gantt-legend__item--active';

type ThemeHex = ReturnType<typeof getThemeHex>;

function legendItemClass(isActive: boolean): string {
  return `gantt-legend__item${isActive ? LEGEND_ITEM_ACTIVE_CLASS : ''}`;
}

function typeLegendSwatchStyle(themeHex: ThemeHex, leftBorderColor: string): CSSProperties {
  return {
    ...SWATCH_STYLE,
    background: themeHex.bgSoft,
    borderLeft: `3px solid ${leftBorderColor}`,
    borderRadius: 0,
  };
}

function GanttBarEncodingKey({
  theme,
  themeHex,
  showCompileExecuteLegend,
}: {
  theme: 'dark' | 'light';
  themeHex: ThemeHex;
  showCompileExecuteLegend?: boolean;
}) {
  const typeFill = getResourceTypeSoftFill('model', theme);
  const statusStroke = getStatusColor('success', theme);
  return (
    <div className="gantt-legend__group gantt-legend__group--bar-key">
      <span className="gantt-legend__label">Bars</span>
      <div className="gantt-legend__bar-key-row">
        <span
          className="gantt-legend__bar-key-swatch"
          style={{
            background: typeFill,
            border: `2px solid ${themeHex.borderDefault}`,
            borderRadius: 3,
          }}
          title="Bar fill follows resource type"
          aria-hidden
        />
        <span className="gantt-legend__bar-key-caption">Fill = type</span>
        <span
          className="gantt-legend__bar-key-swatch"
          style={{
            background: themeHex.bgSoft,
            border: `2px solid ${statusStroke}`,
            borderRadius: 3,
          }}
          title="Bar outline follows run status"
          aria-hidden
        />
        <span className="gantt-legend__bar-key-caption">Border = status</span>
      </div>
      {showCompileExecuteLegend ? (
        <div className="gantt-legend__bar-key-row gantt-legend__bar-key-row--phases">
          <span
            className="gantt-legend__bar-key-swatch"
            style={{
              background: theme === 'dark' ? 'rgba(0, 0, 0, 0.24)' : 'rgba(0, 0, 0, 0.12)',
              border: `1px solid ${themeHex.borderDefault}`,
              borderRadius: 2,
            }}
            aria-hidden
          />
          <span className="gantt-legend__bar-key-caption">Compile (darker)</span>
          <span
            className="gantt-legend__bar-key-swatch"
            style={{
              background: typeFill,
              border: `1px solid ${themeHex.borderDefault}`,
              borderRadius: 2,
            }}
            aria-hidden
          />
          <span className="gantt-legend__bar-key-caption">Execute</span>
        </div>
      ) : null}
    </div>
  );
}

function StatusLegendGroup({
  visibleStatuses,
  statusCounts,
  activeStatuses,
  onToggleStatus,
  failuresOnly,
  onToggleFailuresOnly,
  theme,
}: {
  visibleStatuses: string[];
  statusCounts: ReadonlyMap<string, number>;
  activeStatuses?: Set<string>;
  onToggleStatus?: (status: string) => void;
  failuresOnly?: boolean;
  onToggleFailuresOnly?: () => void;
  theme: 'dark' | 'light';
}) {
  if (visibleStatuses.length === 0 && onToggleFailuresOnly == null) {
    return null;
  }

  return (
    <div className="gantt-legend__group">
      <span className="gantt-legend__label">Status</span>
      {visibleStatuses.map((status) => {
        const isActive = activeStatuses?.has(status) ?? false;
        const color = getStatusColor(status, theme);
        const count = statusCounts.get(status) ?? 0;
        return (
          <button
            key={status}
            type="button"
            className={legendItemClass(isActive)}
            onClick={() => onToggleStatus?.(status)}
            title={`${status} (${count})`}
          >
            <span style={{ ...SWATCH_STYLE, background: color }} />
            <span className="gantt-legend__name">{status}</span>
            <span className="gantt-legend__count">{count}</span>
          </button>
        );
      })}
      {onToggleFailuresOnly != null && (
        <button
          type="button"
          className={legendItemClass(Boolean(failuresOnly))}
          onClick={onToggleFailuresOnly}
          title={
            failuresOnly ? 'Show all parent rows' : 'Show only parents with errors or failing tests'
          }
          aria-pressed={failuresOnly ?? false}
        >
          <span
            style={{
              ...SWATCH_STYLE,
              background: getStatusColor('fail', theme),
            }}
            aria-hidden
          />
          <span className="gantt-legend__name">failures only</span>
        </button>
      )}
    </div>
  );
}

function TypeLegendGroup({
  visibleTypes,
  typeCounts,
  activeTypes,
  onToggleType,
  showTests,
  onToggleShowTests,
  testsLegendCount,
  theme,
  themeHex,
}: {
  visibleTypes: string[];
  typeCounts: ReadonlyMap<string, number>;
  activeTypes?: Set<string>;
  onToggleType?: (type: string) => void;
  showTests?: boolean;
  onToggleShowTests?: () => void;
  testsLegendCount: number;
  theme: 'dark' | 'light';
  themeHex: ThemeHex;
}) {
  if (visibleTypes.length === 0 && onToggleShowTests == null) {
    return null;
  }

  return (
    <div className="gantt-legend__group">
      <span className="gantt-legend__label">Type</span>
      {visibleTypes.map((type) => {
        const isActive = activeTypes?.has(type) ?? false;
        const color = getResourceTypeColor(type, theme);
        const count = typeCounts.get(type) ?? 0;
        return (
          <button
            key={type}
            type="button"
            className={legendItemClass(isActive)}
            onClick={() => onToggleType?.(type)}
            title={`${type} (${count})`}
          >
            <span style={typeLegendSwatchStyle(themeHex, color)} />
            <span className="gantt-legend__name">{type}</span>
            <span className="gantt-legend__count">{count}</span>
          </button>
        );
      })}
      {onToggleShowTests != null && (
        <button
          type="button"
          className={legendItemClass(Boolean(showTests))}
          onClick={onToggleShowTests}
          title={showTests ? 'Hide test chips' : 'Show test chips'}
          aria-pressed={showTests ?? false}
        >
          <span
            style={typeLegendSwatchStyle(themeHex, getResourceTypeColor('test', theme))}
            aria-hidden
          />
          <span className="gantt-legend__name">tests</span>
          <span className="gantt-legend__count">{testsLegendCount}</span>
        </button>
      )}
    </div>
  );
}

function MaterializationLegendGroup({
  materializationRows,
  materializationCounts,
  themeHex,
}: {
  materializationRows: string[];
  materializationCounts?: ReadonlyMap<string, number>;
  themeHex: ThemeHex;
}) {
  if (materializationRows.length === 0 || materializationCounts == null) {
    return null;
  }

  return (
    <div className="gantt-legend__group gantt-legend__group--materialization">
      <span className="gantt-legend__label">Materialization</span>
      <span className="gantt-legend__hint">Manifest-derived; not a bar color.</span>
      {materializationRows.map((kind) => {
        const count = materializationCounts.get(kind) ?? 0;
        return (
          <div
            key={kind}
            className="gantt-legend__item gantt-legend__item--static"
            title="Normalized from manifest config.materialized and resource type"
          >
            <span
              className="gantt-legend__mat-icon"
              aria-hidden
              style={{
                ...SWATCH_STYLE,
                borderRadius: 0,
                border: `2px dashed ${themeHex.borderDefault}`,
                background: themeHex.bgSoft,
              }}
            />
            <span className="gantt-legend__name">
              {materializationKindShortLabel(kind as MaterializationKind)}
            </span>
            <span className="gantt-legend__count">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export function GanttLegend({
  statusCounts,
  typeCounts,
  activeStatuses,
  activeTypes,
  onToggleStatus,
  onToggleType,
  showTests,
  onToggleShowTests,
  testsLegendCount = 0,
  failuresOnly,
  onToggleFailuresOnly,
  showBarEncodingKey = true,
  showCompileExecuteLegend = false,
  materializationCounts,
}: GanttLegendProps): ReactElement | null {
  const theme = useSyncedDocumentTheme();
  const themeHex = getThemeHex(theme);
  const visibleStatuses = Object.keys(STATUS_COLORS).filter((s) => (statusCounts.get(s) ?? 0) > 0);
  const visibleTypes = [...new Set([...GANTT_LEGEND_PRIMARY_TYPES, ...typeCounts.keys()])].sort(
    (a, b) => a.localeCompare(b),
  );

  const materializationRows =
    materializationCounts != null
      ? MATERIALIZATION_KIND_ORDER.filter((kind) => (materializationCounts.get(kind) ?? 0) > 0)
      : [];

  const hasAnything =
    visibleStatuses.length > 0 ||
    visibleTypes.length > 0 ||
    onToggleShowTests != null ||
    onToggleFailuresOnly != null ||
    materializationRows.length > 0;

  if (!hasAnything) return null;

  return (
    <div className="gantt-legend">
      {showBarEncodingKey ? (
        <GanttBarEncodingKey
          theme={theme}
          themeHex={themeHex}
          showCompileExecuteLegend={showCompileExecuteLegend}
        />
      ) : null}
      <StatusLegendGroup
        visibleStatuses={visibleStatuses}
        statusCounts={statusCounts}
        activeStatuses={activeStatuses}
        onToggleStatus={onToggleStatus}
        failuresOnly={failuresOnly}
        onToggleFailuresOnly={onToggleFailuresOnly}
        theme={theme}
      />
      <TypeLegendGroup
        visibleTypes={visibleTypes}
        typeCounts={typeCounts}
        activeTypes={activeTypes}
        onToggleType={onToggleType}
        showTests={showTests}
        onToggleShowTests={onToggleShowTests}
        testsLegendCount={testsLegendCount}
        theme={theme}
        themeHex={themeHex}
      />
      <MaterializationLegendGroup
        materializationRows={materializationRows}
        materializationCounts={materializationCounts}
        themeHex={themeHex}
      />
    </div>
  );
}
