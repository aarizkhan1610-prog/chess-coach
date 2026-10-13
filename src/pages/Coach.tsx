import { useMemo, useState } from 'react';
import { BrowseLink, Disclosure, Pill, navigate } from '../components/ui';
import { RatingPrompt } from '../components/RatingPrompt';
import { WeaknessRow } from '../components/WeaknessRow';
import { RecommendationCards } from '../components/Recommendations';
import { buildProfile, coachSummary } from '../coach/weaknesses';
import { recommend, ratingFromGames } from '../coach/recommend';
import { coachSpots } from '../coach/fromGames';
import { ALL_LESSONS } from '../coach/lessons';
import { ALL_OPENINGS } from '../openings';
import { useGames, useStore } from '../state/store';

/*
 * The coach, and the first thing the app shows.
 *
 * There is no separate home page. The owner could not tell what the app was
 * for, and a front page whose entire job was "here is what to do next" was
 * competing with the one feature whose job that is. Landing here means the
 * first thing on screen is what to work on.
 *
 * Deliberately no board and no engine on this page. It is the root route, and
 * importing `CoachedBoard` here would chain to the explanation layer and the
 * WASM engine, undoing the work that keeps first paint small. The training
 * itself lives in `CoachTrain`, loaded only when a weakness is opened.
 */
export function CoachPage() {
  const games = useGames();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [editing, setEditing] = useState(false);

  const known = useMemo(() => settings.rating ?? ratingFromGames(games), [settings.rating, games]);
  const asked = settings.ratingAsked || known !== null;

  const profile = useMemo(() => buildProfile(games), [games]);
  const summary = useMemo(() => coachSummary(profile), [profile]);
  const top = profile.weaknesses.slice(0, 3);

  /*
   * Ask for more than will be shown, because the first few are the same
   * weaknesses that already have cards above — filtering them out of a list of
   * three leaves nothing at all.
   */
  const rest = useMemo(
    () => recommend(games, known, 6)
      .filter((r) => !top.some((w) => r.id === `weakness:${w.tag}`))
      .slice(0, 3),
    [games, known, top],
  );

  const mixed = useMemo(() => coachSpots(games, 24), [games]);

  if (!asked || editing) {
    return (
      <RatingPrompt
        current={editing ? known : null}
        onAnswer={(rating) => { setSettings({ rating, ratingAsked: true }); setEditing(false); }}
      />
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>Your coach</h1>
        <div className="row wrap home-facts">
          {known !== null && <Pill>{`Rated ${known}`}</Pill>}
          {games.length > 0 && <Pill>{`${games.length} game${games.length === 1 ? '' : 's'} read`}</Pill>}
          <button className="btn ghost sm" onClick={() => setEditing(true)}>
            {known === null ? 'Set a rating' : 'Change rating'}
          </button>
        </div>
        <p className="sub">
          {top.length
            ? summary[0] ?? 'Here is what your games say to work on.'
            : known !== null
              ? `At ${known} I can tell you what players like you are weakest at. I cannot tell you about you until I have seen your games.`
              : 'Nothing to go on yet, so start at the beginning.'}
        </p>
      </div>

      {top.length > 0 && (
        <section className="coach-block">
          <h2>What to work on</h2>
          <div className="coach-weaknesses">
            {top.map((weakness, i) => (
              <WeaknessRow
                key={weakness.tag}
                weakness={weakness}
                rank={i + 1}
                actions={
                  <button className="btn primary sm" onClick={() => navigate(`/coach/${weakness.tag}`)}>
                    Train this →
                  </button>
                }
              />
            ))}
          </div>
        </section>
      )}

      {/*
        * Games imported but nothing repeating in them — clean play, or too few
        * games. It must not dead-end, so the mixed queue takes over.
        */}
      {games.length > 0 && top.length === 0 && (
        <section className="coach-block">
          <div className="card">
            <p style={{ marginTop: 0 }}>
              No habit is repeating often enough to train yet — either you are playing cleanly, or there is
              not enough here to be sure. Five or more games gives a much clearer picture.
            </p>
            <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
              {mixed.length > 0 && (
                <button className="btn primary" onClick={() => navigate('/coach/mixed')}>
                  Go through your mistakes anyway
                </button>
              )}
              <button className="btn" onClick={() => navigate('/import')}>Import more games</button>
            </div>
          </div>
        </section>
      )}

      {games.length === 0 && (
        <section className="coach-block">
          <div className="card">
            <p style={{ marginTop: 0 }}>
              Everything below this line is about players in general. Import a few games and it becomes about
              you — every move checked on this machine, nothing uploaded.
            </p>
            <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
              <button className="btn primary" onClick={() => navigate('/import')}>Import your games</button>
              <button className="btn" onClick={() => navigate('/basics/play')}>Play a coached game</button>
            </div>
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="coach-block">
          <h2>{games.length ? 'Also worth doing' : 'Until then'}</h2>
          <RecommendationCards recommendations={rest} />
        </section>
      )}

      {mixed.length > 0 && top.length > 0 && (
        <p className="small dim coach-mixed-link">
          Or work through <button className="linklike" onClick={() => navigate('/coach/mixed')}>
            all {mixed.length} of your mistakes
          </button> in order of what they cost, rather than by habit.
        </p>
      )}

      {/*
        * Everything the coach is not currently recommending.
        *
        * The libraries had no entry in the navigation at all — they were
        * reachable only if a recommendation happened to point at one — so
        * anybody who did not want to do the thing on offer had nowhere to go.
        * Putting them back in the sidebar would undo the work that made this
        * two features rather than nine, so they live behind one line that
        * answers "what else is there" and says nothing until it is asked.
        */}
      <section className="coach-block">
        <Disclosure
          summary={games.length ? 'Browse everything else' : 'Or browse on your own'}
          hint="lessons · puzzles · openings"
        >
          <BrowseLink label="Lessons" meta={`${ALL_LESSONS.length} of them`} onClick={() => navigate('/lessons')}>
            One per habit the analysis can spot, with a core track if you would rather be told the order.
          </BrowseLink>
          <BrowseLink label="Puzzles" meta="7 modes" onClick={() => navigate('/puzzles')}>
            Built from your own blunders once you have imported games, and from a starter set before that.
          </BrowseLink>
          <BrowseLink label="Openings" meta={`${ALL_OPENINGS.length} courses`} onClick={() => navigate('/openings')}>
            Full repertoires for both colours — the ideas and the plans, not just the moves.
          </BrowseLink>
          <BrowseLink label="Learn to play" meta="new to chess" onClick={() => navigate('/basics')}>
            How the pieces move, the rules people get wrong, and a game played with a coach beside you.
          </BrowseLink>
        </Disclosure>
      </section>
    </div>
  );
}
