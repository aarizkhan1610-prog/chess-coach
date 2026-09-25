import { PathCards, usePaths } from '../components/paths';

export function LandingPage({ hasGames }: { hasGames: boolean }) {
  const paths = usePaths();

  return (
    <div className="landing">
      <header className="landing-hero">
        <div className="landing-mark">{'♚'}</div>
        <h1>What would you like to work on?</h1>
        <p className="landing-lede">
          {hasGames
            ? 'Pick up wherever you left off, or start something new. Everything here works on its own — there is no order you have to follow.'
            : 'Pick whichever fits how you want to spend the next twenty minutes. Nothing here needs setting up first, and you can move between them freely.'}
        </p>
        <div className="landing-trust">
          <span>{'✓'} Runs entirely in your browser</span>
          <span>{'✓'} No account</span>
          <span>{'✓'} Your games never leave this machine</span>
        </div>
      </header>

      <PathCards paths={paths} />

      <div className="landing-note">
        {hasGames ? (
          <>
            <span className="dim">Want the numbers instead?</span> <a href="#/">Open your dashboard</a>
          </>
        ) : (
          <>
            <span className="dim">Not sure where to start?</span>{' '}
            <a href="#/lessons">Begin with the fundamentals</a>
            <span className="dim"> — it is the fastest way to stop losing games you were winning.</span>
          </>
        )}
      </div>
    </div>
  );
}
