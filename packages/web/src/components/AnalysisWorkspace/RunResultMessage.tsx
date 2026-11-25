import { CopyButton } from '@web/components/ui/CopyButton';

import type { StatusTone } from '@web/types';
import type { ReactElement } from 'react';

function copyFor(tone: 'danger' | 'neutral' | 'warning'): { title: string; label: string } {
  if (tone === 'danger') return { title: 'Error message', label: 'error message' };
  if (tone === 'warning') return { title: 'Warning message', label: 'warning message' };
  return { title: 'Skip reason', label: 'skip reason' };
}

/**
 * The dbt run_results message for a node that needs explaining (error, warning, skipped).
 * Successful nodes are left out: adapters write routine text such as "OK" or "SELECT 5" there.
 */
export function RunResultMessage({
  message,
  statusTone,
}: {
  message: string | null | undefined;
  statusTone: StatusTone | null | undefined;
}): ReactElement | null {
  if (message == null || message.trim() === '') return null;
  if (statusTone !== 'danger' && statusTone !== 'warning' && statusTone !== 'skipped') return null;
  const tone = statusTone === 'skipped' ? 'neutral' : statusTone;
  const { title, label } = copyFor(tone);
  return (
    <div className={`run-result-message run-result-message--${tone}`} role="note">
      <div className="run-result-message__header">
        <p className="run-result-message__title">{title}</p>
        <CopyButton value={message} label={label} />
      </div>
      <pre className="run-result-message__body">{message}</pre>
    </div>
  );
}
