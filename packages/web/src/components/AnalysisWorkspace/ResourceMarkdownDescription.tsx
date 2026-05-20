import { useEffect, useRef, useState, type AnchorHTMLAttributes, type ReactElement } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

function MarkdownAnchor({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const openInNewTab =
    typeof href === 'string' && (href.startsWith('http://') || href.startsWith('https://'));
  return (
    <a
      href={href}
      {...rest}
      {...(openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

const markdownComponents = {
  a: MarkdownAnchor,
} satisfies Components;

export function ResourceMarkdownDescription({
  markdown,
  className,
  regionLabel = 'Asset description',
}: {
  markdown: string;
  className?: string;
  /** Accessible name for the surrounding region (e.g. for tests or reuse). */
  regionLabel?: string;
}): ReactElement {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const measure = () => {
      const node = viewportRef.current;
      if (!node) return;
      if (expanded) {
        setOverflowing(false);
        return;
      }
      setOverflowing(node.scrollHeight > node.clientHeight + 1);
    };

    measure();
    const RO = globalThis.ResizeObserver;
    if (typeof RO === 'undefined') {
      return undefined;
    }
    const ro = new RO(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [markdown, expanded]);

  const rootClass = ['resource-description-md', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} role="region" aria-label={regionLabel}>
      <div
        ref={viewportRef}
        className={
          expanded
            ? 'resource-description-md__viewport resource-description-md__viewport--expanded'
            : 'resource-description-md__viewport resource-description-md__viewport--collapsed'
        }
      >
        <div className="resource-description-md__prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
      <div className="resource-description-md__toolbar">
        {!expanded && overflowing ? (
          <button
            type="button"
            className="resource-description-md__toggle workspace-pill"
            onClick={() => setExpanded(true)}
          >
            Expand description
          </button>
        ) : null}
        {expanded ? (
          <button
            type="button"
            className="resource-description-md__toggle workspace-pill"
            onClick={() => setExpanded(false)}
          >
            Collapse description
          </button>
        ) : null}
      </div>
    </div>
  );
}
