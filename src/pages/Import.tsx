import { useMemo, useRef, useState } from 'react';
import { parsePgn, heroFor, type ParsedGame } from '../chess/pgn';
import { DEPTH_PRESETS, type AnalysisDepthPreset, type Color } from '../types';
import { useStore } from '../state/store';
import { useBatchAnalysis, useEngineStatus } from '../engine/useEngine';
import { Banner, Card, Empty, Progress, Spinner, navigate, formatDate } from '../components/ui';
import { findOpening } from '../openings';

const SAMPLE = `[Event "Rated Blitz game"]
[Site "https://lichess.org/example"]
[Date "2026.03.14"]
[White "you"]
[Black "opponent"]
[Result "0-1"]
[WhiteElo "1480"]
[BlackElo "1495"]
[TimeControl "300+3"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Nxe5 Nxe5 5. d4 Bxd4 6. Qxd4 Qf6 7. Qxe5+ Qxe5
8. Nc3 d6 9. O-O Nf6 10. f4 Qe7 11. e5 dxe5 12. fxe5 Ng4 13. Bf4 O-O 14. h3 Nh6
15. Nd5 Qd7 16. Bxh6 gxh6 17. Nf6+ Kg7 18. Nxd7 Bxd7 0-1`;

export function ImportPage() {
  const [text, setText] = useState('');
  const [heroes, setHeroes] = useState<Record<string, Color>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const addGames = useStore((s) => s.addGames);
  const existing = useStore((s) => s.games);

  const engine = useEngineStatus();
  const { progress, run, cancel, reset } = useBatchAnalysis();

  const parsed = useMemo(() => (text.trim() ? parsePgn(text) : { games: [], errors: [] }), [text]);

  function heroOf(g: ParsedGame): Color {
    return heroes[g.id] ?? heroFor(g.meta, settings.playerName) ?? 'w';
  }

  async function analyse() {
    reset();
    const jobs = parsed.games.map((parsedGame) => ({ parsed: parsedGame, hero: heroOf(parsedGame) }));
    const done = await run(jobs, DEPTH_PRESETS[settings.depth].depth);
    if (done.length) {
      addGames(done);
      if (done.length === 1) navigate(`/game/${done[0].id}`);
      else navigate('/games');
    }
  }

  async function readFiles(files: FileList | null) {
    if (!files?.length) return;
    const parts: string[] = [];
    for (const f of Array.from(files)) parts.push(await f.text());
    setText((prev) => [prev, ...parts].filter(Boolean).join('\n\n'));
  }

  const pct = progress.positionsTotal
    ? Math.round((progress.positionsDone / progress.positionsTotal) * 100)
    : 0;

  return (
    <div>
      <div className="page-head">
        <h1>Import games</h1>
        <div className="sub">
          Paste a PGN from Lichess, Chess.com, or anywhere else. Everything is analysed in your browser —
          no game ever leaves this machine.
        </div>
      </div>

      <div className="split">
        <div className="grid">
          <Card
            title="Paste or drop a PGN"
            actions={
              <div className="row">
                <button className="btn sm ghost" onClick={() => setText(SAMPLE)}>Use a sample game</button>
                <button className="btn sm ghost" onClick={() => fileRef.current?.click()}>Choose file</button>
              </div>
            }
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pgn,.txt,text/plain"
              multiple
              hidden
              onChange={(e) => readFiles(e.target.files)}
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'[Event "..."]\n[White "you"]\n[Black "opponent"]\n\n1. e4 e5 2. Nf3 ...'}
              spellCheck={false}
              style={{ minHeight: 230, borderColor: dragOver ? 'var(--accent)' : undefined }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); readFiles(e.dataTransfer.files); }}
            />
            {text && (
              <div className="row small dim" style={{ marginTop: 8 }}>
                <span>
                  {parsed.games.length} game{parsed.games.length === 1 ? '' : 's'} found
                  {parsed.errors.length ? `, ${parsed.errors.length} could not be read` : ''}
                </span>
                <div className="spacer" />
                <button className="btn sm ghost" onClick={() => { setText(''); reset(); }}>Clear</button>
              </div>
            )}
          </Card>

          {parsed.errors.length > 0 && (
            <Banner kind="warn">
              <div className="bold">{parsed.errors.length} game{parsed.errors.length === 1 ? '' : 's'} could not be read</div>
              <ul className="small" style={{ marginTop: 6, marginBottom: 0 }}>
                {parsed.errors.slice(0, 4).map((e) => (
                  <li key={e.index}><span className="mono">{e.message}</span> — {e.excerpt}…</li>
                ))}
              </ul>
            </Banner>
          )}

          {parsed.games.length > 0 && (
            <Card title={`Which side were you?`}>
              <div className="small dim" style={{ marginBottom: 10 }}>
                Analysis is two-sided, but your weakness profile and lessons only use your own moves.
                {settings.playerName && ' Detected automatically from your player name where possible.'}
              </div>
              <table>
                <thead>
                  <tr><th>Game</th><th>Opening</th><th>Result</th><th style={{ width: 130 }}>You played</th></tr>
                </thead>
                <tbody>
                  {parsed.games.slice(0, 40).map((g) => {
                    const hero = heroOf(g);
                    const opening = findOpening(g.moves.map((m) => m.san));
                    return (
                      <tr key={g.id}>
                        <td>
                          <div>{g.meta.white} vs {g.meta.black}</div>
                          <div className="tiny faint">
                            {formatDate(g.meta.date)} · {g.moves.length} plies
                            {existing[g.id] ? ' · already analysed' : ''}
                          </div>
                        </td>
                        <td className="small dim">{opening?.name ?? '—'}</td>
                        <td className="small mono">{g.meta.result}</td>
                        <td>
                          <div className="row" style={{ gap: 4 }}>
                            {(['w', 'b'] as Color[]).map((c) => (
                              <button
                                key={c}
                                className={`btn sm ${hero === c ? 'primary' : 'ghost'}`}
                                onClick={() => setHeroes((h) => ({ ...h, [g.id]: c }))}
                              >
                                {c === 'w' ? 'White' : 'Black'}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {parsed.games.length > 40 && (
                <div className="tiny faint" style={{ marginTop: 8 }}>
                  Showing the first 40 of {parsed.games.length}. All of them will be analysed.
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="grid">
          <Card title="Your name in the PGN">
            <label className="field">
              <span>Used to work out which side you played</span>
              <input
                type="text"
                value={settings.playerName}
                placeholder="e.g. your Lichess username"
                onChange={(e) => setSettings({ playerName: e.target.value })}
              />
            </label>
          </Card>

          <Card title="Analysis depth">
            <div className="grid" style={{ gap: 8 }}>
              {(Object.keys(DEPTH_PRESETS) as AnalysisDepthPreset[]).map((k) => (
                <button
                  key={k}
                  className={`btn ${settings.depth === k ? 'primary' : ''}`}
                  style={{ justifyContent: 'flex-start', textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}
                  onClick={() => setSettings({ depth: k })}
                >
                  <span>{DEPTH_PRESETS[k].label} — depth {DEPTH_PRESETS[k].depth}</span>
                  <span className="tiny" style={{ fontWeight: 400, opacity: 0.8 }}>{DEPTH_PRESETS[k].note}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Engine">
            {engine.status === 'error' ? (
              <Banner kind="error">
                <div className="bold">Stockfish could not start</div>
                <div className="small">{engine.error}</div>
                <button className="btn sm" style={{ marginTop: 8 }} onClick={engine.boot}>Try again</button>
              </Banner>
            ) : (
              <div className="row small">
                <span
                  style={{
                    width: 8, height: 8, borderRadius: 99, flex: 'none',
                    background: engine.status === 'ready' || engine.status === 'searching' ? 'var(--good)' : 'var(--text-faint)',
                  }}
                />
                <span className="dim">
                  {engine.status === 'idle' && 'Stockfish 19 (loads on first use)'}
                  {engine.status === 'loading' && 'Loading Stockfish…'}
                  {engine.status === 'ready' && 'Stockfish 19 ready'}
                  {engine.status === 'searching' && 'Analysing…'}
                </span>
              </div>
            )}
          </Card>

          {progress.running || progress.finished.length > 0 || progress.failures.length > 0 ? (
            <Card title={progress.running ? 'Analysing' : 'Done'}>
              <Progress value={pct} />
              <div className="row small dim" style={{ marginTop: 8 }}>
                {progress.running && <Spinner />}
                <span>
                  Game {Math.min(progress.gameIndex + 1, progress.gameCount)} of {progress.gameCount} · {pct}%
                </span>
              </div>
              {progress.gameLabel && <div className="tiny faint" style={{ marginTop: 3 }}>{progress.gameLabel}</div>}
              {progress.running && (
                <button className="btn sm danger" style={{ marginTop: 10 }} onClick={cancel}>Stop</button>
              )}
              {progress.failures.length > 0 && (
                <div className="tiny" style={{ marginTop: 10, color: 'var(--bad)' }}>
                  {progress.failures.length} game{progress.failures.length === 1 ? '' : 's'} failed to analyse
                </div>
              )}
            </Card>
          ) : null}

          <button
            className="btn primary"
            disabled={!parsed.games.length || progress.running}
            onClick={analyse}
            style={{ width: '100%', padding: '11px' }}
          >
            {progress.running
              ? 'Analysing…'
              : `Analyse ${parsed.games.length || ''} game${parsed.games.length === 1 ? '' : 's'}`}
          </button>
          {parsed.games.length > 6 && !progress.running && (
            <div className="tiny faint center">
              {parsed.games.length} games at depth {DEPTH_PRESETS[settings.depth].depth} will take a while — you can keep using the app in another tab.
            </div>
          )}
        </div>
      </div>

      {!text && (
        <div style={{ marginTop: 20 }}>
          <Empty icon={'↓'} title="Where to find your games">
            <div style={{ textAlign: 'left' }}>
              <p><span className="bold">Lichess:</span> open your profile, then Export games — or download a single game from the analysis board.</p>
              <p><span className="bold">Chess.com:</span> open a game, then Download, or use the Games archive.</p>
              <p><span className="bold">Over the board:</span> paste the moves in any standard PGN form. Headers are optional.</p>
            </div>
          </Empty>
        </div>
      )}
    </div>
  );
}
