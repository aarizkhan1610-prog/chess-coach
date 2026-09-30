import { useMemo, useState } from 'react';
import { Pill, navigate } from '../components/ui';
import { recommend, ratingFromGames, type Recommendation } from '../coach/recommend';
import { bandFor } from '../coach/report';
import { buildProfile } from '../coach/weaknesses';
import { useGames, useStore } from '../state/store';

/*
 * Home.
 *
 * It used to be a chooser: four pathways, all equal, none of them about the
 * person reading. That is a reasonable page for a product with nothing to go
 * on, and a poor one for a coach — a coach's first question is who you are.
 *
 * So the first visit asks for a rating and nothing else, because that single
 * number is enough to say something specific, and everything after it is
 * built from what the app actually knows: the rating until there are games,
 * and the games from then on.
 */

const SOURCE_LABEL: Record<Recommendation['source'], string> = {
  'your-games': 'From your games',
  'your-rating': 'For your rating',
  'starting-out': 'To begin with',
};

/* ------------------------------------------------------------------ *
 * The question
 * ------------------------------------------------------------------ */

function RatingPrompt({ current, onAnswer }: { current: number | null; onAnswer: (rating: number | null) => void }) {
  const [value, setValue] = useState(current === null ? '' : String(current));
  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed >= 100 && parsed <= 3200;

  return (
    <div className="greeting">
      <div className="greeting-mark" aria-hidden>{'♚'}</div>
      <h1>{current === null ? 'What is your rating?' : 'Change your rating'}</h1>
      <p className="greeting-lede">
        It is the one thing that lets the coach say something specific before it has seen you play.
        A rough number is fine, and you can change it later.
      </p>

      <form
        className="row wrap greeting-form"
        onSubmit={(e) => { e.preventDefault(); if (valid) onAnswer(Math.round(parsed)); }}
      >
        <input
          className="greeting-input"
          type="number"
          inputMode="numeric"
          min={100}
          max={3200}
          placeholder="1200"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Your rating"
          autoFocus
        />
        <button className="btn primary" type="submit" disabled={!valid}>
          {valid ? `Continue at ${Math.round(parsed)}` : 'Continue'}
        </button>
      </form>

      {value !== '' && !valid && (
        <p className="tiny" style={{ color: 'var(--bad)' }}>Ratings run from about 100 to 3200.</p>
      )}

      <button className="btn ghost sm greeting-skip" onClick={() => onAnswer(null)}>
        I do not have one, or I am new to chess →
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Everything after it
 * ------------------------------------------------------------------ */

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <button className="rec-card" onClick={() => navigate(rec.href)}>
      <span className="rec-source">{SOURCE_LABEL[rec.source]}</span>
      <span className="rec-title">{rec.title}</span>
      <span className="rec-why">{rec.why}</span>
      <span className="rec-cta">{rec.cta} →</span>
    </button>
  );
}

export function LandingPage() {
  const games = useGames();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);

  /*
   * Never ask for something the imported games already state — but "change"
   * has to work even then, so asking again is a decision rather than a
   * consequence of the stored value happening to be empty.
   */
  const [editing, setEditing] = useState(false);
  const known = useMemo(() => settings.rating ?? ratingFromGames(games), [settings.rating, games]);
  const asked = settings.ratingAsked || known !== null;

  const recs = useMemo(() => recommend(games, known), [games, known]);
  const profile = useMemo(() => (games.length ? buildProfile(games) : null), [games]);

  if (!asked || editing) {
    return (
      <RatingPrompt
        current={editing ? known : null}
        onAnswer={(rating) => {
          setSettings({ rating, ratingAsked: true });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="home">
      <div className="page-head">
        <h1>{games.length ? 'Where you are' : 'Where to start'}</h1>
        <div className="row wrap home-facts">
          {known !== null && <Pill>{`Rated ${known} · ${bandFor(known).label}`}</Pill>}
          {games.length > 0 && <Pill>{`${games.length} game${games.length === 1 ? '' : 's'} analysed`}</Pill>}
          {profile && profile.weaknesses.length > 0 && (
            <Pill>{`${profile.weaknesses.length} habit${profile.weaknesses.length === 1 ? '' : 's'} found`}</Pill>
          )}
          <button className="btn ghost sm" onClick={() => setEditing(true)}>
            {known === null ? 'Set a rating' : 'Change'}
          </button>
        </div>
        <p className="sub">
          {games.length
            ? 'Built from your own games — what they say you keep doing, and what to do about it.'
            : known !== null
              ? 'Measured from real games at your rating. Import your own and this becomes about you rather than about players like you.'
              : 'No rating and no games yet, so start at the beginning.'}
        </p>
      </div>

      <section className="rec-grid">
        {recs.map((rec) => <RecommendationCard key={rec.id} rec={rec} />)}
      </section>

      <section className="home-next">
        <h2>The two things this does</h2>
        <div className="home-pair">
          <button className="home-major" onClick={() => navigate('/coach')}>
            <span className="home-major-title">Coach me</span>
            <span className="home-major-body">
              {games.length
                ? 'Replay the moments your games turned on, and find out what the alternatives actually do.'
                : 'Play a game with every move explained as you make it.'}
            </span>
          </button>
          <button className="home-major" onClick={() => navigate(games.length ? '/games' : '/import')}>
            <span className="home-major-title">{games.length ? 'Read my games' : 'Import my games'}</span>
            <span className="home-major-body">
              {games.length
                ? 'Every move checked, a report per game, and the habits behind the mistakes.'
                : 'From Lichess, Chess.com, or a PGN. Everything is analysed on this machine.'}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
