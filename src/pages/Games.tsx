import { useStore, useGames } from '../state/store';
import { Card, Empty, Pill, accuracyColor, formatDate, navigate, resultBadge } from '../components/ui';
import { VERDICT_META } from '../chess/evaluation';

export function GamesPage() {
  const games = useGames();
  const removeGame = useStore((s) => s.removeGame);
  const clearGames = useStore((s) => s.clearGames);

  if (!games.length) {
    return (
      <div>
        <div className="page-head"><h1>Games</h1></div>
        <Empty
          title="No games yet"
          action={<button className="btn primary" onClick={() => navigate('/import')}>Import a game</button>}
        >
          Import a PGN and every move gets an evaluation, a verdict, and — where it went wrong — a reason.
        </Empty>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div className="row">
          <div>
            <h1>Games</h1>
            <div className="sub">{games.length} analysed</div>
          </div>
          <div className="spacer" />
          <button className="btn sm" onClick={() => navigate('/import')}>Import more</button>
          <button
            className="btn sm danger"
            onClick={() => { if (confirm(`Delete all ${games.length} analysed games? This cannot be undone.`)) clearGames(); }}
          >
            Delete all
          </button>
        </div>
      </div>

      <Card className="pad-0">
        <table>
          <thead>
            <tr>
              <th>Opponent</th>
              <th>Opening</th>
              <th style={{ width: 70 }}>Result</th>
              <th style={{ width: 90 }}>Accuracy</th>
              <th style={{ width: 150 }}>Your mistakes</th>
              <th style={{ width: 90 }}>Date</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {games.map((g) => {
              const opp = g.hero === 'w' ? g.meta.black : g.meta.white;
              const res = resultBadge(g.meta.result, g.hero);
              const acc = g.accuracy[g.hero];
              const c = g.counts[g.hero];
              return (
                <tr key={g.id} className="clickable" onClick={() => navigate(`/game/${g.id}`)}>
                  <td>
                    <div className="bold">{opp}</div>
                    <div className="tiny faint">
                      you played {g.hero === 'w' ? 'White' : 'Black'}
                      {g.meta.timeControl ? ` · ${g.meta.timeControl}` : ''}
                    </div>
                  </td>
                  <td className="small dim">{g.openingName ?? '—'}</td>
                  <td><Pill color={res.color}>{res.text}</Pill></td>
                  <td className="mono bold" style={{ color: accuracyColor(acc) }}>{acc}%</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {(['blunder', 'mistake', 'inaccuracy'] as const).map((v) =>
                        c[v] ? (
                          <span key={v} className="mono tiny bold" style={{ color: VERDICT_META[v].color }} title={VERDICT_META[v].label}>
                            {c[v]}{VERDICT_META[v].symbol}
                          </span>
                        ) : null,
                      )}
                      {!c.blunder && !c.mistake && !c.inaccuracy && <span className="tiny faint">clean</span>}
                    </div>
                  </td>
                  <td className="small dim mono">{formatDate(g.meta.date)}</td>
                  <td>
                    <button
                      className="btn sm ghost"
                      title="Remove this game"
                      onClick={(e) => { e.stopPropagation(); removeGame(g.id); }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
