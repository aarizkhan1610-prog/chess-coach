import { PathCards, usePaths } from '../components/paths';
import { HeroPuzzle } from '../components/HeroPuzzle';
import { navigate } from '../components/ui';
import { ALL_OPENINGS } from '../openings';
import { ALL_LESSONS } from '../coach/lessons';
import { STARTER_PUZZLES } from '../coach/starterPuzzles';
import { MOTIF_TAGS } from '../types';

/** What the coach actually does, stated once. Counts come from the real data. */
const FEATURES: { title: string; body: string }[] = [
  {
    title: 'Real engine analysis, on your machine',
    body: 'Stockfish 19 runs in this tab. Every position in a game is evaluated, and every move gets a verdict and a cost in win probability.',
  },
  {
    title: `${MOTIF_TAGS.length} reasons a move can be wrong`,
    body: 'Not just that you dropped 30% — that you left a piece undefended, walked into a fork, or wrecked your own king safety.',
  },
  {
    title: 'A profile built from your own games',
    body: 'Mistakes are grouped and ranked by what each habit actually costs you per game, so you work on the expensive ones first.',
  },
  {
    title: `${ALL_LESSONS.length} lessons that follow that profile`,
    body: 'Ordered by your own weaknesses, each with a checklist you can use at the board and positions from your games.',
  },
  {
    title: 'Puzzles made from your blunders',
    body: `The position you got wrong, plus ${STARTER_PUZZLES.length} to warm up on, across seven modes from untimed practice to a three-minute rush.`,
  },
  {
    title: `${ALL_OPENINGS.length} opening courses`,
    body: 'Both colours, taught move by move with the ideas behind them, then played back from memory to check they stuck.',
  },
];

export function LandingPage() {
  const paths = usePaths();

  return (
    <div className="landing">
      <header className="landing-hero">
        <div className="landing-copy">
          <div className="landing-mark">{'♚'}</div>
          <h1>What would you like to work on?</h1>
          <p className="landing-lede">
            A chess coach that reads your games, works out what you keep getting wrong, and then
            trains that specifically. Pick a path — none of them need setting up first.
          </p>
          <div className="row wrap landing-actions">
            <button className="btn primary" onClick={() => navigate('/import')}>
              Import your games
            </button>
            <span className="tiny faint">Lichess, Chess.com, or a PGN</span>
          </div>
          <div className="landing-trust">
            <span>{'✓'} Runs entirely in your browser</span>
            <span>{'✓'} No account</span>
            <span>{'✓'} Your games never leave this machine</span>
          </div>
        </div>

        <HeroPuzzle />
      </header>

      <PathCards paths={paths} />

      <section className="features">
        <h2>What it does</h2>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <div className="feature-title">{f.title}</div>
              <div className="feature-body">{f.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
