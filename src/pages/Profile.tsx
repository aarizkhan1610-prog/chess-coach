import { useMemo, useState } from 'react';
import { useGames, useStore } from '../state/store';
import { buildProfile, coachSummary } from '../coach/weaknesses';
import { examplesFor } from '../coach/lessons';
import { ReportTabs } from '../components/ReportTabs';
import { RadarChart } from '../components/RadarChart';
import { TrendChart } from '../components/TrendChart';
import { accuracyOverTime, aggregateScores, comparableAxes, lossBreakdown, pickBand, scoreOpenings } from '../coach/report';
import { ratingFromGames } from '../coach/recommend';
import { progressFor } from '../coach/progress';
import { WeaknessRow } from '../components/WeaknessRow';
import { BENCHMARK, BENCHMARK_BUILT } from '../coach/benchmark';
import { Board } from '../components/Board';
import { Card, Empty, Meter, Stat, accuracyColor, formatDate, navigate } from '../components/ui';
import { MOTIF_META, type MotifTag, type MoveVerdict } from '../types';
import { VERDICT_META } from '../chess/evaluation';

const VERDICTS: MoveVerdict[] = ['brilliant', 'great', 'best', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'];

/**
 * One slice of the win probability given away.
 *
 * Bars are drawn against the same total throughout, so a phase bar and a cause
 * bar of equal length mean equal damage. Scaling each column to its own biggest
 * value would make the smallest category look as serious as the largest.
 */
function LossBar({ label, points, of, accuracy, muted, onOpen }: {
  label: string;
  points: number;
  of: number;
  accuracy?: number;
  muted?: boolean;
  onOpen?: () => void;
}) {
  const share = of > 0 ? Math.round((points / of) * 100) : 0;
  const body = (
    <>
      <div className="loss-row-head">
        <span className="loss-label">{label}</span>
        <span className="loss-points mono">{points}</span>
        <span className="loss-share tiny faint">{share}%</span>
      </div>
      <div className="loss-track">
        <div className={`loss-fill ${muted ? 'muted' : ''}`} style={{ width: `${Math.min(100, share)}%` }} />
      </div>
      {accuracy !== undefined && accuracy > 0 && (
        <div className="tiny faint">{accuracy}% accurate here</div>
      )}
    </>
  );

  return onOpen
    ? <button className="loss-row is-link" onClick={onOpen}>{body}</button>
    : <div className="loss-row">{body}</div>;
}

export function ProfilePage() {
  const games = useGames();
  const profile = useMemo(() => buildProfile(games), [games]);
  const summary = useMemo(() => coachSummary(profile), [profile]);
  const solverRating = useStore((s) => s.solverRating);
  const ownRating = useStore((s) => s.settings.rating);
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
  const training = useStore((s) => s.training);
  const progress = useMemo(
    () => Object.fromEntries(profile.weaknesses.map((w) => [w.tag, progressFor(games, w.tag, training[w.tag])])),
    [games, profile, training],
  );

  /* The shape of all your games, against players at the same rating. */
  const shape = aggregateScores(games);
  const rating = ownRating ?? ratingFromGames(games);
  const band = pickBand(BENCHMARK, rating);
  const openings = useMemo(() => scoreOpenings(games, band?.band ?? null), [games, band]);
  const drawn = band ? comparableAxes(shape, band.band) : [];
  const trend = accuracyOverTime(games);

  /* Where the win probability went: every phase, then every named cause. */
  const attributed = profile.weaknesses.reduce((n, w) => n + w.winLoss, 0);
  const loss = lossBreakdown(games, attributed);
  /*
   * The named causes are the head of a long tail, so a top-few list leaves most
   * of the loss unaccounted for and the percentages summing to something like
   * forty. The remainder — smaller habits plus everything no motif could
   * explain — is shown as its own bar, so the column adds up to the whole.
   */
  const named = profile.weaknesses
    .map((w) => ({ key: w.tag as string, label: MOTIF_META[w.tag].label, points: Math.round(w.winLoss) }))
    .filter((c) => c.points > 0)
    .slice(0, 6);
  const rest = Math.max(0, loss.total - named.reduce((n, c) => n + c.points, 0));
  const causes = rest > 0
    ? [...named, { key: 'rest', label: 'Smaller habits, and moves with no single cause', points: rest }]
    : named;

  return (
    <div>
      <div className="page-head">
        <h1>Your report</h1>
        <div className="sub">
          Built from {profile.moves} of your own moves across {profile.games} game{profile.games === 1 ? '' : 's'}.
          {profile.games < 5 && ' Import a few more for a more reliable picture.'}
        </div>
      </div>

      <ReportTabs active="overview" count={games.length} />

      <div className="grid" style={{ gap: 16 }}>
        {band && drawn.length >= 3 && (
          <Card title="Your game, in shape">
            <div className="report-shape">
              <RadarChart scores={shape} band={band.band} label={`Your ${profile.games} games`} />
              <div className="report-shape-read">
                <p>
                  Each axis is the median across your games, scored exactly as the {band.band.games} real
                  games at {band.band.label} were scored — so the two shapes are directly comparable rather
                  than merely drawn together.
                </p>
                <p className="small dim">
                  There is no endgame axis. Only about a fifth of games reach an endgame that is still a
                  contest, and across two samples of several hundred games the figure moved too much to order
                  the rating bands correctly. Your endgame accuracy is below, where it is a fact about
                  these games rather than a comparison.
                </p>
                <ul className="report-gaps">
                  {[...drawn]
                    .map((a) => ({ axis: a, gap: (shape[a.id] as number) - (band.band.median[a.id] as number) }))
                    .sort((x, y) => x.gap - y.gap)
                    .map(({ axis, gap }) => (
                      <li key={axis.id}>
                        <span className="report-gap-axis">{axis.label}</span>
                        <span
                          className="report-gap-value mono"
                          style={{ color: gap >= 0 ? 'var(--good)' : 'var(--bad)' }}
                        >
                          {gap >= 0 ? '+' : '−'}{Math.abs(Math.round(gap))}
                        </span>
                        <span className="report-gap-note tiny faint">
                          {shape[axis.id]} against {band.band.median[axis.id]} typical
                        </span>
                      </li>
                    ))}
                </ul>
                {!band.exact && (
                  <p className="tiny faint">
                    Compared against {band.band.label}, the nearest band with enough games to be a fair
                    yardstick.
                  </p>
                )}
                <p className="tiny faint">Typical figures measured from real rated games on {BENCHMARK_BUILT}.</p>
              </div>
            </div>
          </Card>
        )}

        <Card title={`Accuracy across your ${profile.games} games`}>
          <TrendChart points={trend} onSelect={(id) => navigate(`/game/${id}`)} />
        </Card>

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
            {/*
              * A number here reads as a finding, so it only appears when it is
              * one. "+11" coloured green on two noisy halves of ten games was
              * as likely to be chance as not.
              */}
            <Stat
              value={profile.momentumVerdict === 'improving' || profile.momentumVerdict === 'worse'
                ? `${(profile.momentum ?? 0) > 0 ? '+' : ''}${profile.momentum}`
                : '—'}
              label={profile.momentumVerdict === 'too-few'
                ? 'Recent trend · needs 10 games'
                : profile.momentumVerdict === 'unclear' ? 'Recent trend · no clear change' : 'Recent trend'}
              tone={profile.momentumVerdict === 'improving' ? 'var(--good)' : profile.momentumVerdict === 'worse' ? 'var(--bad)' : undefined}
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

        <Card title="Where your win probability goes">
          <div className="small dim" style={{ marginBottom: 12 }}>
            You have given away <b>{loss.total}</b> win-probability points across {profile.games}{' '}
            game{profile.games === 1 ? '' : 's'} — about {Math.round(loss.total / Math.max(1, profile.games))}{' '}
            a game. Here is where it went.
          </div>

          <div className="loss-split">
            <div>
              <div className="tiny faint loss-head">BY PHASE</div>
              {(['opening', 'middlegame', 'endgame'] as const).map((ph) => (
                <LossBar
                  key={ph}
                  label={ph}
                  points={loss.byPhase[ph]}
                  of={loss.total}
                  accuracy={profile.accuracyByPhase[ph]}
                />
              ))}
            </div>

            <div>
              <div className="tiny faint loss-head">BY CAUSE</div>
              {causes.length === 0 ? (
                <div className="small dim">Nothing repeating enough to name yet.</div>
              ) : (
                causes.map((c) => (
                  <LossBar
                    key={c.key}
                    label={c.label}
                    points={c.points}
                    of={loss.total}
                    muted={c.key === 'rest'}
                    onOpen={c.key === 'rest' ? undefined : () => navigate(`/coach/${c.key}`)}
                  />
                ))
              )}
            </div>
          </div>
        </Card>

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
              const isOpen = open === w.tag;
              return (
                <div key={w.tag}>
                  {/*
                    * The same row the coach uses. The report had its own copy
                    * with its own labels, which is how it came to call a habit
                    * "improving" while the coach called the same habit, from
                    * the same games, "no clear change yet".
                    */}
                  <WeaknessRow
                    weakness={w}
                    rank={i + 1}
                    progress={progress[w.tag]}
                    actions={
                      <>
                        <button className="btn sm ghost" onClick={() => setOpen(isOpen ? null : w.tag)}>
                          {isOpen ? 'Hide' : 'Examples'}
                        </button>
                        <a className="btn sm primary" href={`#/coach/${w.tag}`}>Train this</a>
                      </>
                    }
                  />
                  {isOpen && (
                    <div className="fade-in" style={{ padding: '4px 0 16px 36px' }}>
                      {examples.length === 0 ? (
                        <div className="small dim">No stored positions for this one.</div>
                      ) : (
                        <div className="cards-grid">
                          {examples.map((ex) => (
                            <Card key={`${ex.gameId}-${ex.ply}`}>
                              <div style={{ maxWidth: 200, margin: '0 auto 10px' }}>
                                <Board fen={ex.fenBefore} orientation={ex.ply % 2 === 0 ? 'w' : 'b'} movable="none" />
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

          <Card title="Openings, against your rating">
            {openings.length === 0 ? (
              <div className="small dim">No openings recognised yet.</div>
            ) : (
              <>
                <table className="table-tight">
                  <thead>
                    <tr>
                      <th>Opening</th>
                      <th style={{ width: 52 }}>Games</th>
                      <th style={{ width: 58 }}>Score</th>
                      <th style={{ width: 96 }}>Opening play</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openings.map((o) => (
                      <tr key={o.openingId}>
                        <td className="small">
                          {o.openingId.startsWith('family:') ? o.name : <a href={`#/openings/${o.openingId}`}>{o.name}</a>}
                        </td>
                        <td className="mono small">{o.games}</td>
                        <td className="mono small">{o.score}%</td>
                        <td className="mono small">
                          {o.gap === null ? (
                            <span className="faint" title={`${o.games} game${o.games === 1 ? '' : 's'} is too few to score`}>—</span>
                          ) : (
                            <>
                              <span style={{ color: accuracyColor(o.opening as number) }}>{o.opening}</span>
                              <span
                                className="tiny"
                                style={{ color: o.gap >= 0 ? 'var(--good)' : 'var(--bad)', marginLeft: 6 }}
                              >
                                {o.gap >= 0 ? '+' : '−'}{Math.abs(Math.round(o.gap))}
                              </span>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="tiny faint" style={{ marginTop: 10 }}>
                  {band
                    ? <>Opening-phase score against {band.band.median.opening} typical at {band.band.label} — how
                      players at your rating handle the opening in general, not this opening in particular.
                      No public sample is deep enough for that: the commonest opening in the benchmark appears
                      19 times across 300 games.</>
                    : <>Set a rating and these get a baseline to sit against.</>}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
