import type { SidebarNavigationTarget } from './appNavigation';

type NavIconId = SidebarNavigationTarget['id'] | 'settings';

export function NavIcon({ id }: { id: NavIconId }) {
  const svgProps = {
    viewBox: '0 0 24 24' as const,
    fill: 'none' as const,
    stroke: 'currentColor' as const,
    strokeWidth: '1.8' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    width: 20,
    height: 20,
    'aria-hidden': true as const,
  };

  // Health — pulse / heartbeat signal
  if (id === 'health') {
    return (
      <svg {...svgProps}>
        <polyline points="2,12 6,12 8,5 10,19 13,12 15,12 17,8 19,12 22,12" />
      </svg>
    );
  }

  // Runs — evidence rows
  if (id === 'runs') {
    return (
      <svg {...svgProps}>
        <rect x="3" y="4" width="3" height="16" rx="1" />
        <rect x="9" y="8" width="3" height="12" rx="1" />
        <rect x="15" y="6" width="3" height="14" rx="1" />
        <rect x="21" y="10" width="0" height="0" />
        <line x1="3" y1="20" x2="21" y2="20" />
      </svg>
    );
  }

  // Timeline
  if (id === 'timeline') {
    return (
      <svg {...svgProps}>
        <path d="M4 18V7" />
        <path d="M10 18V11" />
        <path d="M16 18V5" />
        <path d="M2 18h20" />
        <path d="M4 9h3M10 13h3M16 7h3" />
      </svg>
    );
  }

  // Inventory — layered catalog / stack
  if (id === 'inventory') {
    return (
      <svg {...svgProps}>
        <path d="M2 7l10-4 10 4-10 4-10-4z" />
        <path d="M2 12l10 4 10-4" />
        <path d="M2 17l10 4 10-4" />
      </svg>
    );
  }

  if (id === 'settings') {
    return (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.75v2.5" />
        <path d="M12 18.75v2.5" />
        <path d="M21.25 12h-2.5" />
        <path d="M5.25 12h-2.5" />
        <path d="M18.54 5.46l-1.77 1.77" />
        <path d="M7.23 16.77l-1.77 1.77" />
        <path d="M18.54 18.54l-1.77-1.77" />
        <path d="M7.23 7.23L5.46 5.46" />
      </svg>
    );
  }

  // Fallback — generic bars
  return (
    <svg {...svgProps}>
      <path d="M4 7h16" />
      <path d="M4 12h9" />
      <path d="M4 17h13" />
    </svg>
  );
}
