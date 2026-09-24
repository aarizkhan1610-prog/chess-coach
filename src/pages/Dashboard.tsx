import { useMemo } from 'react';
import { useGames, useStore } from '../state/store';
import { buildProfile, coachSummary } from '../coach/weaknesses';
import { buildPlan } from '../coach/lessons';
import { puzzlesFromGames } from '../coach/puzzles';
import { STARTER_PUZZLES } from '../coach/starterPuzzles';
import { Card, Empty, Meter, Pill, Stat, accuracyColor, formatDate, navigate, resultBadge } from '../components/ui';
import { MOTIF_META } from '../types';

export function DashboardPage() {
  const games = useGames();
  const settings = useStore((s) => s.settings);
  const solverRating = useStore((s) => s.solverRating);
  const totals = useStore((s) => s.totals);

  const profile = useMemo(() => buildProfile(games), [games]);
  const plan = useMemo(() => buildPlan(profile, 3), [profile]);
  const myPuzzles = useMemo(
    () => puzzlesFromGames(games, { includePunish: settings.includePunishPuzzles }),
    [games, settings.includePunishPuzzles],
  );
  const summary = useMemo(() => coachSummary(profile), [profile]);

  if (!games.length) {
    return (
      <div>
        <div className="page-head">
          <h1>Chess Coach</h1>
          <div className="sub">Analyse your games, find out what you actually get wrong, then train exactly that.</div>
        </div>
        <Empty
          title="Start by importing a game"
          action={<button className="btn primary" onClick={() => navigate('/import')}>Import a PGN</button>}
        >
          Everything runs locally in your browser with Stockfish 19. Nothing is uploaded.
          In the meantime there are {STARTER_PUZZLES.length} puzzles and {' '}
          <a href="#/openings">27 opening courses</a> ready to go.
        </Empty>

        <div className="cards-grid" style={{ marginTop: 18 }}>
          <Card title="1. Import">Paste a PGN from Lichess, Chess.com or a real board. Every position is evaluated.</Card>
          <Card title="2. See the pattern">The same mistakes repeat. Your profile ranks them by how much each one costs you.</Card>
          <Card title="3. Train it">Lessons target your weaknesses, and puzzles come from your own blunders.</Card>
        </div>
      </div>
    );
  }

  const blundersPerGame = profile.games ? profile.verdicts.blunder / profile.games : 0;

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="sub">
          {profile.games} game{profile.games === 1 ? '' : 's'} · {profile.moves} of your moves analysed
        </div>
      </div>

      <div className="grid" style={{ gap: 16 }}>
        <Card>
          <div className="stats-row">
            <Stat value={`${profile.accuracy}%`} label="Accuracy" tone={accuracyColor(profile.accuracy)} />
            <Stat value={blundersPerGame.toFixed(1)} label="Blunders / game" tone={blundersPerGame > 1 ? 'var(--v-blunder)' : undefined} />
            <Stat value={solverRating} label="Puzzle rating" />
            <Stat
              value={totals.attempted ? `${Math.round((totals.solved / totals.attempted) * 100)}%` : '—'}
              label="Puzzles solved"
            />
            <Stat
              value={profile.momentum === null ? '—' : `${profile.momentum > 0 ? '+' : ''}${profile.momentum}`}
              label="Recent trend"
              tone={profile.momentum === null ? undefined : profile.momentum >= 0 ? 'var(--good)' : 'var(--bad)'}
            />
          </div>
        </Card>

        {summary.length > 0 && (
          <Card title="What your games say">
            <ul style={{ margin: 0 }}>
              {summary.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </Card>
        )}

        <div className="split">
          <Card
            title="Work on these"
            actions={<button className="btn sm ghost" onClick={() => navigate('/profile')}>Full profile</button>}
          >
            {plan.length === 0 ? (
              <div className="small dim">No repeating weaknesses found yet — import a few more games.</div>
            ) : (
              plan.map((item, i) => (
                <div className="weakness-row" key={item.lesson.tag}>
                  <div className="weakness-rank">{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={`#/lessons/${item.lesson.tag}`} className="bold" style={{ textDecoration: 'none', color: 'var(--text)' }}>
                      {MOTIF_META[item.lesson.tag].label}
                    </a>
                    <div className="tiny faint">{item.reason}</div>
                    <div style={{ marginTop: 5 }}>
                      <Meter value={item.severity} color="var(--accent)" />
                    </div>
                  </div>
                  <a className="btn sm" href={`#/lessons/${item.lesson.tag}`}>Lesson</a>
                </div>
              ))
            )}
          </Card>

          <div className="grid">
            <Card title="Train now">
              <div className="grid" style={{ gap: 8 }}>
                <button className="btn primary" onClick={() => navigate('/puzzles/weakness')} style={{ justifyContent: 'space-between' }}>
                  <span>Weakness drill</span>
                  <span className="tiny">targets your top 3</span>
                </button>
                <button className="btn" onClick={() => navigate('/puzzles/rewind')} style={{ justifyContent: 'space-between' }}>
                  <span>Blunder rewind</span>
                  <span className="tiny">{myPuzzles.length} from your games</span>
                </button>
                <button className="btn" onClick={() => navigate('/puzzles/daily')} style={{ justifyContent: 'space-between' }}>
                  <span>Daily set</span>
                  <span className="tiny">10 puzzles</span>
                </button>
                <button className="btn ghost" onClick={() => navigate('/puzzles')}>All modes →</button>
              </div>
            </Card>

            <Card title="Recent games" actions={<button className="btn sm ghost" onClick={() => navigate('/games')}>All</button>}>
              <div className="grid" style={{ gap: 7 }}>
                {games.slice(0, 5).map((g) => {
                  const res = resultBadge(g.meta.result, g.hero);
                  const acc = g.accuracy[g.hero];
                  return (
                    <button
                      key={g.id}
                      className="btn sm"
                      style={{ justifyContent: 'flex-start', gap: 8 }}
                      onClick={() => navigate(`/game/${g.id}`)}
                    >
                      <Pill color={res.color}>{res.text}</Pill>
                      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }} className="nowrap">
                        {g.hero === 'w' ? g.meta.black : g.meta.white}
                      </span>
                      <span className="mono tiny" style={{ color: accuracyColor(acc) }}>{acc}%</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>

        {profile.openingRecord.length > 0 && (
          <Card title="Your openings" actions={<button className="btn sm ghost" onClick={() => navigate('/openings')}>Courses</button>}>
            <table>
              <thead><tr><th>Opening</th><th style={{ width: 70 }}>Games</th><th style={{ width: 80 }}>Score</th><th style={{ width: 110 }}>Accuracy</th></tr></thead>
              <tbody>
                {profile.openingRecord.slice(0, 6).map((o) => (
                  <tr key={o.openingId}>
                    <td>{o.openingId.startsWith('family:') ? o.name : <a href={`#/openings/${o.openingId}`}>{o.name}</a>}</td>
                    <td className="mono">{o.games}</td>
                    <td className="mono">{o.score}%</td>
                    <td><Meter value={o.accuracy} color={accuracyColor(o.accuracy)} label={`${o.accuracy}%`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
