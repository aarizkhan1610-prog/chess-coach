import { useMemo, useState } from 'react';
import { useGames, useStore } from '../state/store';
import { buildProfile, coachSummary } from '../coach/weaknesses';
import { examplesFor } from '../coach/lessons';
import { Board } from '../components/Board';
import { Card, Empty, Meter, Pill, Stat, accuracyColor, formatDate, navigate } from '../components/ui';
import { MOTIF_META, type MotifTag, type MoveVerdict } from '../types';
import { VERDICT_META } from '../chess/evaluation';

const VERDICTS: MoveVerdict[] = ['brilliant', 'great', 'best', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'];

export function ProfilePage() {
  const games = useGames();
  const profile = useMemo(() => buildProfile(games), [games]);
  const summary = useMemo(() => coachSummary(profile), [profile]);
  const solverRating = useStore((s) => s.solverRating);
  const totals = useStore((s) => s.totals);
  const [open, setOpen] = useState<MotifTag | null>(null);

  if (!games.length) {
    return (
      <div>
        <div className="page-head"><h1>Your weaknesses</h1></div>
        <Empty title="Nothing to analyse yet" action={<button className="btn primary" onClick={() => navigate('/import')}>Import your games</button>}>
          Your weaknesses are worked out from your own moves, so this page fills in once you import a game or two.
          Five or more gives a much clearer picture.
        </Empty>
      </div>
    );
  }

  const totalMoves = Object.values(profile.verdicts).reduce((a, b) => a + b, 0);
  const examples = open ? examplesFor(games, open, 4) : [];

  return (
    <div>
      <div className="page-head">
        <h1>Your weaknesses</h1>
        <div className="sub">
          Built from {profile.moves} of your own moves across {profile.games} game{profile.games === 1 ? '' : 's'}.
          {profile.games < 5 && ' Import a few more for a more reliable picture.'}
        </div>
      </div>

      <div className="grid" style={{ gap: 16 }}>
        <Card>
          <div className="stats-row">
            <Stat value={`${profile.accuracy}%`} label="Overall accuracy" tone={accuracyColor(profile.accuracy)} />
            <Stat
              value={(profile.verdicts.blunder / Math.max(1, profile.games)).toFixed(1)}
              label="Blunders / game"
              tone={profile.verdicts.blunder / Math.max(1, profile.games) > 1 ? 'var(--v-blunder)' : undefined}
            />
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
              {summary.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </Card>
        )}

        <Card title="Accuracy by phase">
          <div className="stats-row">
            {(['opening', 'middlegame', 'endgame'] as const).map((p) => (
              <Stat
                key={p}
                value={profile.accuracyByPhase[p] ? `${profile.accuracyByPhase[p]}%` : '—'}
                label={p}
                tone={profile.accuracyByPhase[p] ? accuracyColor(profile.accuracyByPhase[p]) : undefined}
              />
            ))}
          </div>
        </Card>

        <Card title="What is costing you the most">
          <div className="small dim" style={{ marginBottom: 12 }}>
            Ranked by win probability lost per game. When one move has two causes, the cost is split between them,
            so nothing is double-counted.
          </div>
          {profile.weaknesses.length === 0 ? (
            <div className="small dim">No repeating patterns found — either you are playing very cleanly, or there is not enough data yet.</div>
          ) : (
            profile.weaknesses.map((w, i) => {
              const meta = MOTIF_META[w.tag];
              const isOpen = open === w.tag;
              return (
                <div key={w.tag}>
                  <div className="weakness-row">
                    <div className="weakness-rank">{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row wrap" style={{ gap: 7 }}>
                        <span className="bold">{meta.label}</span>
                        <Pill>{meta.family}</Pill>
                        {w.trend > 0.5 && <Pill color="var(--bad)">getting worse</Pill>}
                        {w.trend < -0.5 && <Pill color="var(--good)">improving</Pill>}
                      </div>
                      <div className="tiny faint">
                        {w.occurrences}× in {w.gamesAffected} game{w.gamesAffected === 1 ? '' : 's'} ·
                        {' '}{w.perGame} win% per game · {w.share}% of all your losses
                      </div>
                      <div style={{ marginTop: 5 }}><Meter value={w.severity} /></div>
                    </div>
                    <button className="btn sm ghost" onClick={() => setOpen(isOpen ? null : w.tag)}>
                      {isOpen ? 'Hide' : 'Examples'}
                    </button>
                    <a className="btn sm" href={`#/lessons/${w.tag}`}>Lesson</a>
                  </div>
                  {isOpen && (
                    <div className="fade-in" style={{ padding: '4px 0 16px 36px' }}>
                      {examples.length === 0 ? (
                        <div className="small dim">No stored positions for this one.</div>
                      ) : (
                        <div className="cards-grid">
                          {examples.map((ex) => (
                            <Card key={`${ex.gameId}-${ex.ply}`}>
                              <div style={{ maxWidth: 200, margin: '0 auto 10px' }}>
                                <Board fen={ex.fenBefore} orientation={ex.ply % 2 === 0 ? 'w' : 'b'} coordinates={false} movable="none" />
                              </div>
                              <div className="small">
                                You played <span className="mono bold" style={{ color: 'var(--v-blunder)' }}>{ex.san}</span>
                                {ex.bestSan && <> instead of <span className="mono bold" style={{ color: 'var(--v-best)' }}>{ex.bestSan}</span></>}
                              </div>
                              <div className="tiny faint" style={{ marginTop: 3 }}>
                                vs {ex.opponent} · {formatDate(ex.date)} · −{ex.winLoss} win%
                              </div>
                              <button className="btn sm ghost" style={{ marginTop: 8, width: '100%' }} onClick={() => navigate(`/game/${ex.gameId}`)}>
                                Open in review
                              </button>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </Card>

        <div className="split">
          <Card title="Move quality">
            {VERDICTS.map((v) => {
              const n = profile.verdicts[v];
              if (!n) return null;
              const pct = totalMoves ? (n / totalMoves) * 100 : 0;
              return (
                <div key={v} style={{ marginBottom: 9 }}>
                  <div className="row small">
                    <span style={{ color: VERDICT_META[v].color }} className="bold">{VERDICT_META[v].label}</span>
                    <div className="spacer" />
                    <span className="mono dim">{n} · {pct.toFixed(0)}%</span>
                  </div>
                  <Meter value={pct} color={VERDICT_META[v].color} />
                </div>
              );
            })}
          </Card>

          <Card title="Openings you play">
            {profile.openingRecord.length === 0 ? (
              <div className="small dim">No openings recognised yet.</div>
            ) : (
              <table>
                <thead><tr><th>Opening</th><th style={{ width: 60 }}>Games</th><th style={{ width: 70 }}>Score</th><th style={{ width: 70 }}>Acc.</th></tr></thead>
                <tbody>
                  {profile.openingRecord.map((o) => (
                    <tr key={o.openingId}>
                      <td className="small">
                        {o.openingId.startsWith('family:') ? o.name : <a href={`#/openings/${o.openingId}`}>{o.name}</a>}
                      </td>
                      <td className="mono small">{o.games}</td>
                      <td className="mono small">{o.score}%</td>
                      <td className="mono small" style={{ color: accuracyColor(o.accuracy) }}>{o.accuracy}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
