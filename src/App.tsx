import { Suspense, lazy, useCallback, useEffect, useMemo } from 'react';
import { useGames, useHydrated, useStore } from './state/store';
import { useRoute, Spinner } from './components/ui';
import { LandingPage } from './pages/Landing';

/*
 * Routes load on demand.
 *
 * Everything shipped as one 518KB chunk, so opening the home page also
 * downloaded 27 opening courses, 26 lessons and the puzzle pack — none of
 * which that page uses. The landing route is imported eagerly because it is
 * what most visits start on; the rest arrive when asked for.
 */
const ImportPage = lazy(() => import('./pages/Import').then((m) => ({ default: m.ImportPage })));
const GamesPage = lazy(() => import('./pages/Games').then((m) => ({ default: m.GamesPage })));
const GameReviewPage = lazy(() => import('./pages/GameReview').then((m) => ({ default: m.GameReviewPage })));
const ProfilePage = lazy(() => import('./pages/Profile').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));
const LessonsPage = lazy(() => import('./pages/Lessons').then((m) => ({ default: m.LessonsPage })));
const LessonPage = lazy(() => import('./pages/Lessons').then((m) => ({ default: m.LessonPage })));
const PuzzlesPage = lazy(() => import('./pages/Puzzles').then((m) => ({ default: m.PuzzlesPage })));
const PuzzleSessionPage = lazy(() => import('./pages/Puzzles').then((m) => ({ default: m.PuzzleSessionPage })));
const OpeningsPage = lazy(() => import('./pages/Openings').then((m) => ({ default: m.OpeningsPage })));
const OpeningPage = lazy(() => import('./pages/Openings').then((m) => ({ default: m.OpeningPage })));

import { buildProfile } from './coach/weaknesses';
import type { MotifTag } from './types';

const NAV = [
  { path: '/', icon: '⌂', label: 'Home' },
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

  const setSettings = useStore((st) => st.setSettings);
  const collapsed = settings.sidebarCollapsed;
  const toggleNav = useCallback(() => {
    // Below the breakpoint the panel is a top bar and cannot collapse. Flipping
    // the flag there does nothing visible but silently decides what the user
    // finds when the window widens again, so the shortcut is a no-op instead.
    if (window.matchMedia('(max-width: 700px)').matches) return;
    setSettings({ sidebarCollapsed: !collapsed });
  }, [setSettings, collapsed]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  // Cmd/Ctrl+B, as in most editors. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleNav();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleNav]);

  const weaknessCount = useMemo(() => buildProfile(games).weaknesses.length, [games]);
  const route = `/${parts.join('/')}`;
  const section = parts[0] ?? '';

  return (
    <div className={`app ${collapsed ? 'nav-collapsed' : ''}`}>
      <nav className="sidebar">
        <div className="brand">
          <span className="brand-mark">{'♚'}</span>
          <span>Chess Coach</span>
          <button
            className="nav-toggle"
            onClick={toggleNav}
            title="Hide the menu (⌘B)"
            aria-label="Hide the menu"
          >
            {'«'}
          </button>
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

      {collapsed && (
        <button
          className="nav-restore"
          onClick={toggleNav}
          title="Show the menu (\u2318B)"
          aria-label="Show the menu"
        >
          {'\u2630'}
        </button>
      )}

      <main className="main">
        {!hydrated ? (
          <div className="row" style={{ padding: 40, justifyContent: 'center' }}>
            <Spinner /> <span className="dim">Loading your data…</span>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="row" style={{ padding: 'var(--space-6)', justifyContent: 'center' }}>
                <Spinner />
              </div>
            }
          >
            <Routes parts={parts} />
          </Suspense>
        )}
      </main>
    </div>
  );
}

function Routes({ parts }: { parts: string[] }) {
  const [section, arg] = parts;

  switch (section) {
    case undefined:
    case 'start':
      return <LandingPage />;
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
      return <LandingPage />;
  }
}
