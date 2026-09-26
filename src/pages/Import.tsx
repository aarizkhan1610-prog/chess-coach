import { useMemo, useRef, useState } from 'react';
import { parsePgn, heroFor, type ParsedGame } from '../chess/pgn';
import {
  DEPTH_PRESETS, MOTIF_META, estimateSeconds, formatDuration,
  type AnalysedGame, type AnalysisDepthPreset, type Color,
} from '../types';
import { useStore } from '../state/store';
import { useBatchAnalysis, useEngineStatus } from '../engine/useEngine';
import { buildProfile } from '../coach/weaknesses';
import { PROVIDERS, fetchGames, ImportError, type Provider } from '../import/providers';
import { Banner, Card, Spinner, accuracyColor, formatDate, navigate } from '../components/ui';
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

type Step = 'games' | 'depth' | 'running' | 'done';

const STEPS: { id: Step; label: string }[] = [
  { id: 'games', label: 'Your games' },
  { id: 'depth', label: 'How deep' },
  { id: 'running', label: 'Analysing' },
  { id: 'done', label: 'Results' },
];

export function ImportPage() {
  const [step, setStep] = useState<Step>('games');
  const [source, setSource] = useState<'account' | 'paste'>('account');
  const [text, setText] = useState('');
  const [heroes, setHeroes] = useState<Record<string, Color>>({});
  const [results, setResults] = useState<AnalysedGame[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const addGames = useStore((s) => s.addGames);

  const engine = useEngineStatus();
  const { progress, run, cancel, reset } = useBatchAnalysis();

  const [provider, setProvider] = useState<Provider>('lichess');
  const [username, setUsername] = useState('');
  const [count, setCount] = useState(10);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<{ message: string; hint?: string } | null>(null);

  const parsed = useMemo(() => (text.trim() ? parsePgn(text) : { games: [], errors: [] }), [text]);
  const positions = useMemo(
    () => parsed.games.reduce((n, g) => n + g.moves.length + 1, 0),
    [parsed.games],
  );

  function heroOf(g: ParsedGame): Color {
    return heroes[g.id] ?? heroFor(g.meta, settings.playerName) ?? 'w';
  }

  async function fetchFromProfile() {
    setFetching(true);
    setFetchError(null);
    try {
      const result = await fetchGames(provider, username, count);
      setText(result.pgn);
      if (!settings.playerName) setSettings({ playerName: result.username });
    } catch (err) {
      if (err instanceof ImportError) {
        if (err.kind !== 'cancelled') setFetchError({ message: err.message, hint: err.hint });
      } else {
        setFetchError({ message: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      setFetching(false);
    }
  }

  async function readFiles(files: FileList | null) {
    if (!files?.length) return;
    const parts: string[] = [];
    for (const f of Array.from(files)) parts.push(await f.text());
    setText((prev) => [prev, ...parts].filter(Boolean).join('\n\n'));
  }

  async function startAnalysis() {
    reset();
    setStep('running');
    const jobs = parsed.games.map((g) => ({ parsed: g, hero: heroOf(g) }));
    const done = await run(jobs, DEPTH_PRESETS[settings.depth].depth);
    if (done.length) addGames(done);
    setResults(done);
    // Nothing finished means it was stopped straight away; go back rather than
    // showing an empty results screen.
    setStep(done.length ? 'done' : 'depth');
  }

  function startOver() {
    setText('');
    setHeroes({});
    setResults([]);
    setFetchError(null);
    reset();
    setStep('games');
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="wizard">
      <div className="page-head">
        <h1>Import games</h1>
        <div className="sub">
          Everything is analysed in your browser. Games never leave this machine.
        </div>
      </div>

      <ol className="wizard-steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className={`wizard-step ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}>
            <span className="wizard-dot">{i < stepIndex ? '✓' : i + 1}</span>
            <span className="wizard-label">{s.label}</span>
          </li>
        ))}
      </ol>

      {step === 'games' && (
        <StepGames
          source={source} setSource={setSource}
          provider={provider} setProvider={setProvider}
          username={username} setUsername={setUsername}
          count={count} setCount={setCount}
          fetching={fetching} fetchError={fetchError} onFetch={fetchFromProfile}
          text={text} setText={setText}
          dragOver={dragOver} setDragOver={setDragOver}
          fileRef={fileRef} readFiles={readFiles}
          parsed={parsed} heroOf={heroOf} setHeroes={setHeroes}
          onSample={() => { setSource('paste'); setText(SAMPLE); }}
          onNext={() => setStep('depth')}
        />
      )}

      {step === 'depth' && (
        <StepDepth
          gameCount={parsed.games.length}
          positions={positions}
          depth={settings.depth}
          setDepth={(d) => setSettings({ depth: d })}
          engine={engine}
          onBack={() => setStep('games')}
          onStart={startAnalysis}
        />
      )}

      {step === 'running' && <StepRunning progress={progress} onCancel={cancel} />}

      {step === 'done' && (
        <StepDone results={results} failures={progress.failures} onAgain={startOver} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 1. Where the games come from
 * ------------------------------------------------------------------ */
function StepGames(p: {
  source: 'account' | 'paste'; setSource: (s: 'account' | 'paste') => void;
  provider: Provider; setProvider: (v: Provider) => void;
  username: string; setUsername: (v: string) => void;
  count: number; setCount: (v: number) => void;
  fetching: boolean; fetchError: { message: string; hint?: string } | null; onFetch: () => void;
  text: string; setText: (v: string) => void;
  dragOver: boolean; setDragOver: (v: boolean) => void;
  fileRef: React.RefObject<HTMLInputElement | null>; readFiles: (f: FileList | null) => void;
  parsed: ReturnType<typeof parsePgn>; heroOf: (g: ParsedGame) => Color;
  setHeroes: React.Dispatch<React.SetStateAction<Record<string, Color>>>;
  onSample: () => void; onNext: () => void;
}) {
  const found = p.parsed.games.length;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card title="Where are your games?">
        <div className="seg" role="group" aria-label="Where the games come from" style={{ marginBottom: 'var(--space-4)' }}>
          <button className={`seg-item ${p.source === 'account' ? 'on' : ''}`} aria-pressed={p.source === 'account'} onClick={() => p.setSource('account')}>
            From my account
          </button>
          <button className={`seg-item ${p.source === 'paste' ? 'on' : ''}`} aria-pressed={p.source === 'paste'} onClick={() => p.setSource('paste')}>
            Paste a PGN
          </button>
        </div>

        {p.source === 'account' ? (
          <>
            <div className="seg" role="group" aria-label="Service" style={{ marginBottom: 'var(--space-3)' }}>
              {PROVIDERS.map((x) => (
                <button key={x.id} className={`seg-item ${p.provider === x.id ? 'on' : ''}`}
                  aria-pressed={p.provider === x.id} onClick={() => p.setProvider(x.id)}>
                  {x.name}
                </button>
              ))}
            </div>
            <div className="fetch-row">
              <input
                type="text" value={p.username}
                placeholder={PROVIDERS.find((x) => x.id === p.provider)!.placeholder}
                onChange={(e) => p.setUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && p.username.trim() && !p.fetching) p.onFetch(); }}
              />
              <select value={p.count} onChange={(e) => p.setCount(Number(e.target.value))} style={{ width: 'auto' }}>
                {[5, 10, 20].map((n) => <option key={n} value={n}>last {n}</option>)}
              </select>
              <button className="btn primary" disabled={!p.username.trim() || p.fetching} onClick={p.onFetch}>
                {p.fetching ? <><Spinner /> Fetching…</> : 'Fetch'}
              </button>
            </div>
            {p.fetchError && (
              <div style={{ marginTop: 10 }}>
                <Banner kind="error">
                  <div className="bold">{p.fetchError.message}</div>
                  {p.fetchError.hint && <div className="small" style={{ marginTop: 3 }}>{p.fetchError.hint}</div>}
                </Banner>
              </div>
            )}
            <div className="tiny faint" style={{ marginTop: 10 }}>
              Only your username is sent, to {p.provider === 'lichess' ? 'Lichess' : 'Chess.com'}. The games come back
              here and are analysed on this machine.
            </div>
          </>
        ) : (
          <>
            <input ref={p.fileRef} type="file" accept=".pgn,.txt,text/plain" multiple hidden
              onChange={(e) => p.readFiles(e.target.files)} />
            <textarea
              value={p.text}
              onChange={(e) => p.setText(e.target.value)}
              placeholder={'[Event "..."]\n[White "you"]\n\n1. e4 e5 2. Nf3 ...'}
              spellCheck={false}
              style={{ minHeight: 170, borderColor: p.dragOver ? 'var(--accent)' : undefined }}
              onDragOver={(e) => { e.preventDefault(); p.setDragOver(true); }}
              onDragLeave={() => p.setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); p.setDragOver(false); p.readFiles(e.dataTransfer.files); }}
            />
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              <button className="btn sm ghost" onClick={() => p.fileRef.current?.click()}>Choose a file</button>
              <button className="btn sm ghost" onClick={p.onSample}>Use a sample game</button>
              {p.text && <><div className="spacer" /><button className="btn sm ghost" onClick={() => p.setText('')}>Clear</button></>}
            </div>
          </>
        )}
      </Card>

      {p.parsed.errors.length > 0 && (
        <Banner kind="warn">
          <div className="bold">{p.parsed.errors.length} game{p.parsed.errors.length === 1 ? '' : 's'} could not be read</div>
          <ul className="small" style={{ marginTop: 6, marginBottom: 0 }}>
            {p.parsed.errors.slice(0, 3).map((e) => (
              <li key={e.index}><span className="mono">{e.message}</span> — {e.excerpt}…</li>
            ))}
          </ul>
        </Banner>
      )}

      {found > 0 && (
        <Card title={`${found} game${found === 1 ? '' : 's'} ready`}>
          <div className="small dim" style={{ marginBottom: 10 }}>
            Check which side you played — your weakness profile only uses your own moves.
          </div>
          <div className="import-list">
            {p.parsed.games.slice(0, 30).map((g) => {
              const hero = p.heroOf(g);
              const opening = findOpening(g.moves.map((m) => m.san));
              return (
                <div className="import-row" key={g.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="bold small">{g.meta.white} vs {g.meta.black}</div>
                    <div className="tiny faint">
                      {opening?.name ?? 'Unrecognised opening'} · {formatDate(g.meta.date)} · {g.moves.length} plies
                    </div>
                  </div>
                  <div className="seg" role="group" aria-label="Which side you played">
                    {(['w', 'b'] as Color[]).map((c) => (
                      <button key={c} className={`seg-item ${hero === c ? 'on' : ''}`} aria-pressed={hero === c}
                        onClick={() => p.setHeroes((h) => ({ ...h, [g.id]: c }))}>
                        {c === 'w' ? 'White' : 'Black'}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {found > 30 && <div className="tiny faint" style={{ marginTop: 8 }}>Showing 30 of {found}. All will be analysed.</div>}
        </Card>
      )}

      <div className="row">
        <div className="spacer" />
        <button className="btn primary" disabled={!found} onClick={p.onNext}>
          {found ? `Continue with ${found} game${found === 1 ? '' : 's'} →` : 'Add some games to continue'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 2. How deep
 * ------------------------------------------------------------------ */
function StepDepth(p: {
  gameCount: number; positions: number;
  depth: AnalysisDepthPreset; setDepth: (d: AnalysisDepthPreset) => void;
  engine: ReturnType<typeof useEngineStatus>;
  onBack: () => void; onStart: () => void;
}) {
  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card title="How carefully should I look?">
        <div className="small dim" style={{ marginBottom: 14 }}>
          Deeper analysis finds subtler mistakes but takes longer. Estimates are for your
          {' '}{p.gameCount} game{p.gameCount === 1 ? '' : 's'}.
        </div>
        <div className="depth-grid">
          {(Object.keys(DEPTH_PRESETS) as AnalysisDepthPreset[]).map((k) => {
            const preset = DEPTH_PRESETS[k];
            const secs = estimateSeconds(k, p.positions);
            return (
              <button key={k} className={`depth-card ${p.depth === k ? 'selected' : ''}`} onClick={() => p.setDepth(k)}>
                <span className="depth-name">{preset.label}</span>
                <span className="depth-time">about {formatDuration(secs)}</span>
                <span className="depth-note">{preset.note}</span>
                <span className="tiny faint">search depth {preset.depth}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {p.engine.status === 'error' && (
        <Banner kind="error">
          <div className="bold">Stockfish could not start</div>
          <div className="small">{p.engine.error}</div>
          <button className="btn sm" style={{ marginTop: 8 }} onClick={p.engine.boot}>Try again</button>
        </Banner>
      )}

      <div className="row">
        <button className="btn" onClick={p.onBack}>← Back</button>
        <div className="spacer" />
        <button className="btn primary" disabled={p.engine.status === 'error'} onClick={p.onStart}>
          Analyse {p.gameCount} game{p.gameCount === 1 ? '' : 's'} →
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 3. Working
 * ------------------------------------------------------------------ */
function StepRunning({ progress, onCancel }: {
  progress: ReturnType<typeof useBatchAnalysis>['progress'];
  onCancel: () => void;
}) {
  const pct = progress.positionsTotal
    ? Math.min(100, Math.round((progress.positionsDone / progress.positionsTotal) * 100))
    : 0;
  const R = 62;
  const circumference = 2 * Math.PI * R;

  return (
    <div className="analysing">
      <svg className="analysing-ring" viewBox="0 0 150 150" width="150" height="150" aria-hidden>
        <circle cx="75" cy="75" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
        <circle
          cx="75" cy="75" r={R} fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          transform="rotate(-90 75 75)"
          style={{ transition: 'stroke-dashoffset 0.25s linear' }}
        />
        <text x="75" y="80" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--text)">{pct}%</text>
      </svg>

      <h2 style={{ marginTop: 18 }}>Analysing your games</h2>
      <div className="dim small" style={{ marginTop: 5 }}>
        Game {Math.min(progress.gameIndex + 1, progress.gameCount)} of {progress.gameCount}
        {progress.gameLabel && <> · {progress.gameLabel}</>}
      </div>
      <div className="tiny faint" style={{ marginTop: 4 }}>
        {progress.positionsDone.toLocaleString()} of {progress.positionsTotal.toLocaleString()} positions ·
        Stockfish is running in this tab, so leaving it open keeps things moving.
      </div>

      {progress.finished.length > 0 && (
        <div className="tiny" style={{ marginTop: 10, color: 'var(--good)' }}>
          {progress.finished.length} done so far
        </div>
      )}

      <button className="btn danger sm" style={{ marginTop: 20 }} onClick={onCancel}>Stop</button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 4. What came out
 * ------------------------------------------------------------------ */
function StepDone({ results, failures, onAgain }: {
  results: AnalysedGame[];
  failures: { label: string; message: string }[];
  onAgain: () => void;
}) {
  const profile = useMemo(() => buildProfile(results), [results]);
  const blunders = profile.verdicts.blunder;
  const mistakes = profile.verdicts.mistake + profile.verdicts.inaccuracy;
  const top = profile.weaknesses[0];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="done-head">
        <div className="done-tick" aria-hidden>{'✓'}</div>
        <h2>Analysed {results.length} game{results.length === 1 ? '' : 's'}</h2>
        <div className="dim">Here is what came out of them.</div>
      </div>

      <Card>
        <div className="stats-row">
          <div className="stat">
            <div className="value" style={{ color: accuracyColor(profile.accuracy) }}>{profile.accuracy}%</div>
            <div className="label">Your accuracy</div>
          </div>
          <div className="stat">
            <div className="value" style={{ color: blunders ? 'var(--v-blunder)' : undefined }}>{blunders}</div>
            <div className="label">Blunders</div>
          </div>
          <div className="stat">
            <div className="value">{mistakes}</div>
            <div className="label">Smaller errors</div>
          </div>
          <div className="stat">
            <div className="value">{profile.moves}</div>
            <div className="label">Moves checked</div>
          </div>
        </div>
      </Card>

      {top && (
        <Card title="Your biggest weakness in these games">
          <div className="row wrap" style={{ gap: 10 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="bold">{MOTIF_META[top.tag].label}</div>
              <div className="small dim">
                {top.occurrences} time{top.occurrences === 1 ? '' : 's'}, costing about {top.perGame} win-probability
                points per game.
              </div>
            </div>
            <a className="btn primary sm" href={`#/lessons/${top.tag}`}>Open the lesson</a>
          </div>
        </Card>
      )}

      {failures.length > 0 && (
        <Banner kind="warn">
          {failures.length} game{failures.length === 1 ? '' : 's'} could not be analysed.
        </Banner>
      )}

      <div className="row wrap" style={{ gap: 8 }}>
        <button className="btn primary" onClick={() => navigate(results.length === 1 ? `/game/${results[0].id}` : '/games')}>
          {results.length === 1 ? 'Review the game' : 'Review the games'} →
        </button>
        <button className="btn" onClick={() => navigate('/profile')}>See your weaknesses</button>
        <button className="btn" onClick={() => navigate('/puzzles/rewind')}>Train on these mistakes</button>
        <div className="spacer" />
        <button className="btn ghost" onClick={onAgain}>Import more</button>
      </div>
    </div>
  );
}
