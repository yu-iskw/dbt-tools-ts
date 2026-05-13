interface SpinnerProps {
  /** Diameter in pixels. Default: 24. */
  size?: number;
  /** Optional accessible label. Default: omitted (decorative). */
  label?: string;
}

/**
 * An SVG ring spinner that respects the `--accent` CSS custom property.
 * Used in loading cards and action buttons during async operations.
 *
 * @example
 * // In a button:
 * {loading ? <><Spinner size={16} /> Analyzing…</> : "Analyze artifacts"}
 *
 * // As a standalone loader:
 * <Spinner size={48} label="Loading workspace" />
 */
export function Spinner({ size = 24, label }: SpinnerProps) {
  return (
    <svg
      className="spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={label ? undefined : 'true'}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {/* Background track */}
      <circle cx="12" cy="12" r="10" stroke="var(--panel-border)" strokeWidth="2.5" />
      {/* Spinning arc */}
      <path
        d="M12 2 A10 10 0 0 1 22 12"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
