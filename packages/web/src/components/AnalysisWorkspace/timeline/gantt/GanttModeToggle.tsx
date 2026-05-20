import type { DisplayMode } from './constants';
import type { ReactElement } from 'react';

export function GanttModeToggle({
  activeMode,
  onChange,
  activeTimeZone,
  timeZones,
  onTimeZoneChange,
}: {
  activeMode: DisplayMode;
  onChange: (next: DisplayMode) => void;
  activeTimeZone: string;
  timeZones: string[];
  onTimeZoneChange: (next: string) => void;
}): ReactElement {
  return (
    <div className="gantt-controls">
      <div className="gantt-controls__cluster">
        {activeMode === 'timestamps' && (
          <label className="gantt-timezone-select">
            <span>Timezone</span>
            <select
              value={activeTimeZone}
              onChange={(event) => onTimeZoneChange(event.target.value)}
            >
              {timeZones.map((timeZone) => (
                <option key={timeZone} value={timeZone}>
                  {timeZone}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="gantt-mode-toggle">
          <button
            type="button"
            className={activeMode === 'duration' ? 'active' : ''}
            onClick={() => onChange('duration')}
          >
            Duration
          </button>
          <button
            type="button"
            className={activeMode === 'timestamps' ? 'active' : ''}
            onClick={() => onChange('timestamps')}
          >
            Timestamps
          </button>
        </div>
      </div>
    </div>
  );
}
