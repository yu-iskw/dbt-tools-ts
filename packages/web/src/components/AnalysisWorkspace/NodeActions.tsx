import {
  getNodeActions,
  type NodeActionContext,
  type NodeActionId,
  type NodeNavigate,
} from '@web/lib/analysis-workspace/node-actions';

import { CopyButton, useCopyToClipboard } from '../ui/CopyButton';

import type { ReactElement } from 'react';

const COPY_ID_LABEL = 'unique ID';

/**
 * The shared "go elsewhere with this node" actions plus a Copy ID control.
 * `buttons` renders inspector pills; `menu` renders context-menu items.
 */
export function NodeActions({
  nodeId,
  context,
  exclude,
  onNavigateTo,
  variant = 'buttons',
  onAfterAction,
}: {
  nodeId: string;
  context: NodeActionContext;
  /** Views the user is already in; their actions are left out. */
  exclude: readonly NodeActionId[];
  onNavigateTo: NodeNavigate;
  variant?: 'buttons' | 'menu';
  /** Runs after an action or copy fires (e.g. to close a menu). */
  onAfterAction?: () => void;
}): ReactElement {
  const copyText = useCopyToClipboard(COPY_ID_LABEL);
  const actions = getNodeActions(context, nodeId, exclude);

  if (variant === 'menu') {
    return (
      <>
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="graph-context-menu__item"
            onClick={() => {
              action.navigate(nodeId, onNavigateTo);
              onAfterAction?.();
            }}
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          className="graph-context-menu__item"
          onClick={() => {
            copyText(nodeId);
            onAfterAction?.();
          }}
        >
          Copy unique ID
        </button>
      </>
    );
  }

  return (
    <div className="entity-inspector__actions">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="workspace-pill"
          onClick={() => action.navigate(nodeId, onNavigateTo)}
        >
          {action.label}
        </button>
      ))}
      <CopyButton value={nodeId} label={COPY_ID_LABEL} />
    </div>
  );
}
