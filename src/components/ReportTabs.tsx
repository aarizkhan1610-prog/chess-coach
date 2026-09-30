import { navigate } from './ui';

/**
 * The analysis half of the app, as one destination.
 *
 * The overview, the game list and the opening record were three sibling
 * navigation items describing the same body of work. They are tabs of one
 * report now, so "read my games" is a single place rather than a choice
 * between three that sound alike.
 */
const TABS = [
  { id: 'overview', label: 'Overview', href: '/report' },
  { id: 'games', label: 'Games', href: '/games' },
] as const;

export type ReportTab = (typeof TABS)[number]['id'];

export function ReportTabs({ active, count }: { active: ReportTab; count?: number }) {
  return (
    <div className="panel-tabs report-tabs" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          className={`panel-tab ${active === tab.id ? 'active' : ''}`}
          onClick={() => navigate(tab.href)}
        >
          {tab.label}
          {tab.id === 'games' && count !== undefined && count > 0 && (
            <span className="tiny faint">{` ${count}`}</span>
          )}
        </button>
      ))}
    </div>
  );
}
