import { useEffect, useMemo } from 'react';
import { useGames, useHydrated, useStore } from './state/store';
import { useRoute, Spinner } from './components/ui';
import { DashboardPage } from './pages/Dashboard';
import { ImportPage } from './pages/Import';
import { GamesPage } from './pages/Games';
import { GameReviewPage } from './pages/GameReview';
import { ProfilePage } from './pages/Profile';
import { LessonsPage, LessonPage } from './pages/Lessons';
import { PuzzlesPage, PuzzleSessionPage } from './pages/Puzzles';
import { OpeningsPage, OpeningPage } from './pages/Openings';
import { SettingsPage } from './pages/Settings';
import { LandingPage } from './pages/Landing';
import { buildProfile } from './coach/weaknesses';
import type { MotifTag } from './types';

const NAV = [
  { path: '/', icon: '⌂', label: 'Dashboard' },
  { path: '/import', icon: '↓', label: 'Import' },
  { path: '/games', icon: '♜', label: 'Games' },
  { path: '/profile', icon: '◔', label: 'Weaknesses' },
];
const TRAIN = [
  { path: '/lessons', icon: '⚑', label: 'Lessons' },
  { path: '/puzzles', icon: '✦', label: 'Puzzles' },
  { path: '/openings', icon: '♞', label: 'Openings' },
];

export default function App() {
  const [parts] = useRoute();
  const settings = useStore((s) => s.settings);
  const hydrated = useHydrated();
  const games = useGames();

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const weaknessCount = useMemo(() => buildProfile(games).weaknesses.length, [games]);
  const route = `/${parts.join('/')}`;
  const section = parts[0] ?? '';

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <span className="brand-mark">{'♚'}</span>
          <span>Chess Coach</span>
        </div>

        {NAV.map((item) => (
          <a
            key={item.path}
            href={`#${item.path}`}
            className={`nav-item ${route === item.path || (item.path === '/games' && section === 'game') ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.path === '/games' && games.length > 0 && <span className="nav-badge">{games.length}</span>}
            {item.path === '/profile' && weaknessCount > 0 && <span className="nav-badge">{weaknessCount}</span>}
          </a>
        ))}

        <div className="nav-section">Train</div>
        {TRAIN.map((item) => (
          <a
            key={item.path}
            href={`#${item.path}`}
            className={`nav-item ${section === item.path.slice(1) ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}

        <div className="sidebar-foot">
          <a href="#/settings" className={`nav-item ${section === 'settings' ? 'active' : ''}`}>
            <span className="nav-icon">{'⚙'}</span>
            <span>Settings</span>
          </a>
          <div className="tiny faint" style={{ padding: '6px 10px 0' }}>
            Runs locally · Stockfish 19
          </div>
        </div>
      </nav>

      <main className="main">
        {!hydrated ? (
          <div className="row" style={{ padding: 40, justifyContent: 'center' }}>
            <Spinner /> <span className="dim">Loading your data…</span>
          </div>
        ) : (
          <Routes parts={parts} />
        )}
      </main>
    </div>
  );
}

function Routes({ parts }: { parts: string[] }) {
  const [section, arg] = parts;
  const hasGames = useStore((s) => s.gameOrder.length > 0);

  switch (section) {
    case undefined:
      // New users get the pathway chooser; the dashboard only means something
      // once there are games to summarise.
      return hasGames ? <DashboardPage /> : <LandingPage hasGames={false} />;
    case 'start':
      return <LandingPage hasGames={hasGames} />;
    case 'import':
      return <ImportPage />;
    case 'games':
      return <GamesPage />;
    case 'game':
      return arg ? <GameReviewPage gameId={arg} /> : <GamesPage />;
    case 'profile':
      return <ProfilePage />;
    case 'lessons':
      return arg ? <LessonPage tag={arg as MotifTag} /> : <LessonsPage />;
    case 'puzzles':
      return arg ? <PuzzleSessionPage modeId={arg} /> : <PuzzlesPage />;
    case 'openings':
      return arg ? <OpeningPage id={arg} /> : <OpeningsPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <DashboardPage />;
  }
}
