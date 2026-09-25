import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { useGames, useStore, type PuzzleOutcome } from '../state/store';
import { buildProfile } from '../coach/weaknesses';
import { puzzlesFromGames, isCorrectFirstMove, ratingBand } from '../coach/puzzles';
import { STARTER_PUZZLES } from '../coach/starterPuzzles';
import { selectPuzzles } from '../coach/srs';
import { Board } from '../components/Board';
import { Card, Empty, Pill, Spinner, formatClock, navigate } from '../components/ui';
import { TrainBrowser, type TrainNode } from '../components/TrainBrowser';
import { MOTIF_META, type MotifTag, type Puzzle } from '../types';
import { getEngine } from '../engine/uci';
import { winPctFor } from '../chess/evaluation';
import { other } from '../chess/board';

/* ------------------------------------------------------------------ *
 * Modes
 * ------------------------------------------------------------------ */
export interface ModeConfig {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  count: number;
  /** Seconds; 0 means untimed. */
  timeLimit: number;
  lives: number;
  /** Stop the session at the first mistake. */
  suddenDeath: boolean;
  spaced: boolean;
  /** Difficulty climbs as you solve. */
  escalating: boolean;
  tags?: MotifTag[];
  /** Only puzzles mined from the user's own games. */
  ownGamesOnly?: boolean;
  deterministic?: boolean;
}

const MODES: ModeConfig[] = [
  { id: 'train', name: 'Practice', icon: '♟', blurb: 'Untimed, no pressure. Spaced repetition picks what you are due to see.', count: 40, timeLimit: 0, lives: 0, suddenDeath: false, spaced: true, escalating: false },
  { id: 'weakness', name: 'Weakness drill', icon: '◎', blurb: 'Only the patterns your games say you keep getting wrong.', count: 20, timeLimit: 0, lives: 0, suddenDeath: false, spaced: true, escalating: false },
  { id: 'rewind', name: 'Blunder rewind', icon: '↺', blurb: 'Your own mistakes, replayed. Find what you missed at the board.', count: 30, timeLimit: 0, lives: 0, suddenDeath: false, spaced: false, escalating: false, ownGamesOnly: true },
  { id: 'rush', name: 'Puzzle rush', icon: '⚡', blurb: 'Three minutes, three strikes. As many as you can.', count: 60, timeLimit: 180, lives: 3, suddenDeath: false, spaced: false, escalating: true },
  { id: 'streak', name: 'Streak', icon: '↗', blurb: 'One mistake ends the run. How far can you get?', count: 60, timeLimit: 0, lives: 1, suddenDeath: true, spaced: false, escalating: true },
  { id: 'survival', name: 'Survival', icon: '♥', blurb: 'Three lives, and the puzzles get harder every time you solve one.', count: 60, timeLimit: 0, lives: 3, suddenDeath: false, spaced: false, escalating: true },
  { id: 'daily', name: 'Daily set', icon: '☀', blurb: 'Ten puzzles, the same for the whole day. A solid warm-up.', count: 10, timeLimit: 0, lives: 0, suddenDeath: false, spaced: false, escalating: false, deterministic: true },
];

function modeFor(id: string, topTags: MotifTag[]): ModeConfig | null {
  if (id.startsWith('tag-')) {
    const tag = id.slice(4) as MotifTag;
    if (!MOTIF_META[tag]) return null;
    return {
      id, name: MOTIF_META[tag].label, icon: '◎',
      blurb: `Puzzles on one theme: ${MOTIF_META[tag].short.toLowerCase()}.`,
      count: 15, timeLimit: 0, lives: 0, suddenDeath: false, spaced: true, escalating: false, tags: [tag],
    };
  }
  const base = MODES.find((m) => m.id === id);
  if (!base) return null;
  if (base.id === 'weakness') return { ...base, tags: topTags.length ? topTags : undefined };
  return base;
}

/* ------------------------------------------------------------------ *
 * Mode picker
 * ------------------------------------------------------------------ */
const MODE_GROUPS: { id: string; label: string; detail: string; modes: string[] }[] = [
  {
    id: 'practice',
    label: 'Practice, at your own pace',
    detail: 'No clock, no lives. Best place to start and the best way to actually learn.',
    modes: ['train', 'weakness', 'rewind'],
  },
  {
    id: 'challenge',
    label: 'Timed and challenge modes',
    detail: 'A clock, lives, or both. More fun once the patterns are familiar.',
    modes: ['rush', 'streak', 'survival'],
  },
];

export function PuzzlesPage() {
  const games = useGames();
  const settings = useStore((s) => s.settings);
  const solverRating = useStore((s) => s.solverRating);
  const totals = useStore((s) => s.totals);
  const progress = useStore((s) => s.progress);

  const profile = useMemo(() => buildProfile(games), [games]);
  const mine = useMemo(
    () => puzzlesFromGames(games, { includePunish: settings.includePunishPuzzles }),
    [games, settings.includePunishPuzzles],
  );
  const pool = useMemo(() => [...mine, ...STARTER_PUZZLES], [mine]);

  /** A real position from the pool, so choosing a mode is not abstract. */
  const sampleFor = useMemo(() => {
    return (tags?: MotifTag[]): Puzzle | undefined => {
      const candidates = tags?.length ? pool.filter((p) => p.tags.some((t) => tags.includes(t))) : pool;
      return candidates[0];
    };
  }, [pool]);

  function modeNode(m: ModeConfig): TrainNode {
    const sample = sampleFor(m.tags);
    const disabled = Boolean(m.ownGamesOnly) && mine.length === 0;
    return {
      id: m.id,
      label: m.name,
      detail: disabled ? 'Import a game first — these come from your own blunders.' : m.blurb,
      meta: m.timeLimit ? `${m.timeLimit / 60} min` : m.lives ? `${m.lives} ${m.lives === 1 ? 'life' : 'lives'}` : 'untimed',
      fen: sample?.fen,
      orientation: sample?.solverColor,
      caption: sample ? 'A puzzle you might get' : undefined,
      href: disabled ? undefined : `/puzzles/${m.id}`,
      cta: 'Start',
      summary: (
        <div className="row wrap" style={{ gap: 6 }}>
          {m.timeLimit > 0 && <Pill>{m.timeLimit / 60} minutes</Pill>}
          {m.lives > 0 && <Pill>{m.lives} {m.lives === 1 ? 'life' : 'lives'}</Pill>}
          {m.suddenDeath && <Pill color="var(--bad)">one mistake ends it</Pill>}
          {m.spaced && <Pill>spaced repetition</Pill>}
          {m.escalating && <Pill>gets harder</Pill>}
        </div>
      ),
    };
  }

  const roots = useMemo<TrainNode[]>(() => {
    const nodes: TrainNode[] = [];

    if (mine.length) {
      const weakness = MODES.find((m) => m.id === 'weakness')!;
      const top = profile.weaknesses.slice(0, 3).map((w) => w.tag);
      nodes.push({
        ...modeNode({ ...weakness, tags: top.length ? top : undefined }),
        id: 'your-weaknesses',
        label: 'Drill my weaknesses',
        detail: profile.weaknesses.length
          ? `Your top problems right now: ${profile.weaknesses.slice(0, 2).map((w) => MOTIF_META[w.tag].short.toLowerCase()).join(', ')}`
          : 'Puzzles built from the mistakes in your own games',
        meta: `${mine.length}`,
      });
    }

    for (const g of MODE_GROUPS) {
      nodes.push({
        id: g.id,
        label: g.label,
        detail: g.detail,
        meta: `${g.modes.length}`,
        children: g.modes.flatMap((id) => {
          const m = MODES.find((x) => x.id === id);
          return m ? [modeNode(m)] : [];
        }),
      });
    }

    const daily = MODES.find((m) => m.id === 'daily');
    if (daily) nodes.push({ ...modeNode(daily), label: 'Today’s ten', detail: 'The same ten puzzles for everyone, all day. A solid warm-up.' });

    // Themes, so a specific weakness can be drilled directly.
    const byTag = new Map<MotifTag, number>();
    for (const p of pool) for (const t of p.tags) byTag.set(t, (byTag.get(t) ?? 0) + 1);
    const themes = [...byTag.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
    if (themes.length) {
      nodes.push({
        id: 'themes',
        label: 'Work on one theme',
        detail: 'Pick a single pattern and drill only that',
        meta: `${themes.length}`,
        children: themes.map(([tag, n]) => {
          const sample = sampleFor([tag]);
          return {
            id: tag,
            label: MOTIF_META[tag].label,
            detail: MOTIF_META[tag].short,
            meta: `${n}`,
            fen: sample?.fen,
            orientation: sample?.solverColor,
            caption: 'A puzzle on this theme',
            href: `/puzzles/tag-${tag}`,
            cta: 'Drill this theme',
          };
        }),
      });
    }
    return nodes;
  }, [mine, pool, profile, sampleFor]);

  return (
    <div>
      <div className="page-head">
        <h1>Puzzles</h1>
        <div className="sub">
          {mine.length
            ? `${mine.length} from your own games, plus ${STARTER_PUZZLES.length} to warm up on.`
            : `${STARTER_PUZZLES.length} puzzles ready. Import games and your own blunders join them.`}
        </div>
      </div>

      <TrainBrowser
        rootLabel="All puzzles"
        roots={roots}
        intro={
          <div className="hud puzzle-hud">
            <div className="hud-item"><span className="v">{solverRating}</span><span className="k">Rating</span></div>
            <div className="hud-item"><span className="v">{totals.solved}/{totals.attempted}</span><span className="k">Solved</span></div>
            <div className="hud-item"><span className="v">{totals.bestStreak}</span><span className="k">Best run</span></div>
          </div>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Trainer
 * ------------------------------------------------------------------ */
type Status = 'solving' | 'correct' | 'wrong' | 'checking' | 'done';

export function PuzzleSessionPage({ modeId }: { modeId: string }) {
  const games = useGames();
  const settings = useStore((s) => s.settings);
  const progress = useStore((s) => s.progress);
  const solverRating = useStore((s) => s.solverRating);
  const recordPuzzle = useStore((s) => s.recordPuzzle);
  const addSession = useStore((s) => s.addSession);

  const profile = useMemo(() => buildProfile(games), [games]);
  const topTags = useMemo(() => profile.weaknesses.slice(0, 3).map((w) => w.tag), [profile]);
  const mode = useMemo(() => modeFor(modeId, topTags), [modeId, topTags]);

  const pool = useMemo(() => {
    const mine = puzzlesFromGames(games, { includePunish: settings.includePunishPuzzles });
    if (mode?.ownGamesOnly) return mine;
    // The user's own puzzles come first so they dominate once there are some.
    return [...mine, ...STARTER_PUZZLES];
  }, [games, settings.includePunishPuzzles, mode]);

  const [queue, setQueue] = useState<Puzzle[]>([]);
  const [index, setIndex] = useState(0);
  const [sessionKey, setSessionKey] = useState(0);

  // Build the queue once per session.
  useEffect(() => {
    if (!mode) return;
    const seed = mode.deterministic ? Number(new Date().toISOString().slice(0, 10).replace(/-/g, '')) : undefined;
    const picked = selectPuzzles(pool, progress, {
      tags: mode.tags,
      count: mode.count,
      spaced: mode.spaced,
      seed,
      targetRating: mode.escalating ? Math.max(700, solverRating - 200) : undefined,
    });
    const ordered = mode.escalating ? [...picked].sort((a, b) => a.rating - b.rating) : picked;
    setQueue(ordered);
    setIndex(0);
    // Deliberately keyed on `modeId` rather than the `mode` object, and not on
    // `progress`: re-picking mid-session would shuffle the queue under the
    // solver's feet after every answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeId, pool, sessionKey]);

  const [solved, setSolved] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [livesLeft, setLivesLeft] = useState(mode?.lives ?? 0);
  const [timeLeft, setTimeLeft] = useState(mode?.timeLimit ?? 0);
  const [finished, setFinished] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setLivesLeft(mode?.lives ?? 0);
    setTimeLeft(mode?.timeLimit ?? 0);
    setSolved(0); setAttempted(0); setStreak(0); setBestStreak(0); setFinished(false);
    startedAt.current = Date.now();
  }, [mode, sessionKey]);

  // Countdown for timed modes.
  useEffect(() => {
    if (!mode?.timeLimit || finished) return;
    const t = setInterval(() => {
      setTimeLeft((v) => {
        if (v <= 1) { setFinished(true); return 0; }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [mode, finished]);

  const endSession = useCallback(() => {
    if (!mode) return;
    setFinished(true);
    addSession({ mode: mode.name, at: Date.now(), solved, attempted, best: bestStreak });
  }, [mode, solved, attempted, bestStreak, addSession]);

  const onResult = useCallback(
    (puzzle: Puzzle, outcome: PuzzleOutcome) => {
      recordPuzzle(puzzle, outcome);
      setAttempted((a) => a + 1);
      if (outcome === 'first-try') {
        setSolved((s) => s + 1);
        setStreak((s) => { const n = s + 1; setBestStreak((b) => Math.max(b, n)); return n; });
      } else {
        setStreak(0);
        if (mode?.suddenDeath) { setLivesLeft(0); return; }
        if (mode?.lives) setLivesLeft((l) => Math.max(0, l - 1));
      }
    },
    [recordPuzzle, mode],
  );

  const advance = useCallback(() => {
    setIndex((i) => {
      const next = i + 1;
      if (next >= queue.length) { endSession(); return i; }
      return next;
    });
  }, [queue.length, endSession]);

  useEffect(() => {
    if (mode?.lives && livesLeft === 0 && !finished && attempted > 0) endSession();
  }, [livesLeft, mode, finished, attempted, endSession]);

  if (!mode) {
    return <Empty title="Unknown puzzle mode" action={<button className="btn" onClick={() => navigate('/puzzles')}>Back</button>} />;
  }
  if (!queue.length) {
    return (
      <div>
        <div className="page-head"><h1>{mode.name}</h1></div>
        <Empty
          title="No puzzles match this mode yet"
          action={<button className="btn primary" onClick={() => navigate(games.length ? '/puzzles' : '/import')}>
            {games.length ? 'Other modes' : 'Import games'}
          </button>}
        >
          {mode.tags
            ? 'This theme has not shown up in your games yet, and no starter puzzle covers it.'
            : 'Import a game to generate puzzles from your own mistakes.'}
        </Empty>
      </div>
    );
  }

  if (finished) {
    const pct = attempted ? Math.round((solved / attempted) * 100) : 0;
    return (
      <div>
        <div className="page-head"><h1>{mode.name} — done</h1></div>
        <Card>
          <div className="hud" style={{ marginBottom: 16 }}>
            <div className="hud-item"><span className="v">{solved}</span><span className="k">Solved</span></div>
            <div className="hud-item"><span className="v">{attempted}</span><span className="k">Attempted</span></div>
            <div className="hud-item"><span className="v">{pct}%</span><span className="k">Accuracy</span></div>
            <div className="hud-item"><span className="v">{bestStreak}</span><span className="k">Best run</span></div>
            <div className="hud-item"><span className="v">{solverRating}</span><span className="k">New rating</span></div>
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => setSessionKey((k) => k + 1)}>Go again</button>
            <button className="btn" onClick={() => navigate('/puzzles')}>Other modes</button>
            {games.length > 0 && <button className="btn ghost" onClick={() => navigate('/profile')}>See your profile</button>}
          </div>
        </Card>
      </div>
    );
  }

  const puzzle = queue[index];

  return (
    <div>
      <div className="page-head">
        <div className="row wrap">
          <div>
            <button className="btn sm ghost" style={{ marginBottom: 6 }} onClick={() => navigate('/puzzles')}>← Puzzles</button>
            <h1>{mode.name}</h1>
          </div>
          <div className="spacer" />
          <div className="hud">
            {mode.timeLimit > 0 && (
              <div className="hud-item">
                <span className="v mono" style={{ color: timeLeft <= 20 ? 'var(--bad)' : undefined }}>{formatClock(timeLeft)}</span>
                <span className="k">Time</span>
              </div>
            )}
            <div className="hud-item"><span className="v">{solved}</span><span className="k">Solved</span></div>
            <div className="hud-item"><span className="v">{streak}</span><span className="k">Streak</span></div>
            {mode.lives > 0 && (
              <div className="hud-item">
                <span className="v lives">
                  {Array.from({ length: mode.lives }, (_, i) => (
                    <span key={i} className={i < livesLeft ? '' : 'lost'}>{'♥'}</span>
                  ))}
                </span>
                <span className="k">Lives</span>
              </div>
            )}
            <div className="hud-item"><span className="v">{index + 1}/{queue.length}</span><span className="k">Puzzle</span></div>
          </div>
        </div>
      </div>

      <PuzzleView
        key={puzzle.id}
        puzzle={puzzle}
        onResult={(o) => onResult(puzzle, o)}
        onNext={advance}
        allowRetry={!mode.suddenDeath && mode.timeLimit === 0}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * One puzzle
 * ------------------------------------------------------------------ */
export function PuzzleView({ puzzle, onResult, onNext, allowRetry = true }: {
  puzzle: Puzzle;
  onResult: (outcome: PuzzleOutcome) => void;
  onNext: () => void;
  allowRetry?: boolean;
}) {
  const [fen, setFen] = useState(puzzle.fen);
  const [moveIdx, setMoveIdx] = useState(0);
  const [status, setStatus] = useState<Status>('solving');
  const [wrongSan, setWrongSan] = useState<string | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const [engineNote, setEngineNote] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const reported = useRef(false);

  const solverColor = puzzle.solverColor;
  const total = Math.ceil(puzzle.solution.length / 2);

  const report = useCallback((outcome: PuzzleOutcome) => {
    if (reported.current) return;
    reported.current = true;
    onResult(outcome);
  }, [onResult]);

  function playReply(afterFen: string, nextIdx: number) {
    const reply = puzzle.solution[nextIdx * 2 - 1];
    if (!reply) return;
    setTimeout(() => {
      const c = new Chess(afterFen);
      try {
        const m = c.move(reply);
        setFen(c.fen());
        setLastMove({ from: m.from, to: m.to });
      } catch {
        /* The stored line should always be legal; if not, just stop here. */
      }
    }, 340);
  }

  async function handleMove(san: string, fenAfter: string, from: string, to: string) {
    if (status !== 'solving') return;
    const expected = puzzle.solution[moveIdx * 2];
    const norm = (s: string) => s.replace(/[+#!?]/g, '');

    const matches = moveIdx === 0
      ? isCorrectFirstMove(puzzle, san)
      : norm(san) === norm(expected ?? '');

    if (matches) {
      setLastMove({ from, to });
      const nextIdx = moveIdx + 1;
      setFen(fenAfter);
      if (nextIdx >= total) {
        setStatus('correct');
        report(usedHint ? 'hinted' : 'first-try');
      } else {
        setMoveIdx(nextIdx);
        playReply(fenAfter, nextIdx);
      }
      return;
    }

    // Not the stored answer — ask the engine whether it is just as good before
    // calling it wrong. Puzzles mined from real games often have more than one
    // winning move, and marking those wrong is the fastest way to lose trust.
    if (moveIdx === 0) {
      setStatus('checking');
      const accepted = await engineAcceptsAlternative(puzzle, fenAfter);
      if (accepted) {
        setLastMove({ from, to });
        setFen(fenAfter);
        setStatus('correct');
        setEngineNote(`${san} is not the move from the game, but the engine rates it just as good.`);
        report(usedHint ? 'hinted' : 'first-try');
        return;
      }
    }

    setWrongSan(san);
    setStatus('wrong');
    report('failed');
  }

  function reveal() {
    setGaveUp(true);
    const c = new Chess(puzzle.fen);
    let last: { from: string; to: string } | null = null;
    for (const san of puzzle.solution) {
      try {
        const m = c.move(san);
        last = { from: m.from, to: m.to };
      } catch { break; }
    }
    setFen(c.fen());
    setLastMove(last);
    setStatus('correct');
    report('failed');
  }

  function retry() {
    setFen(puzzle.fen);
    setMoveIdx(0);
    setStatus('solving');
    setWrongSan(null);
    setLastMove(null);
    setGaveUp(false);
  }

  function hint() {
    setUsedHint(true);
    const c = new Chess(fen);
    const expected = puzzle.solution[moveIdx * 2];
    try {
      const m = c.move(expected);
      setHintSquare(m.from);
    } catch { /* ignore */ }
  }

  const isSolverTurn = new Chess(fen).turn() === solverColor;

  return (
    <div className="split wide">
      <div>
        <Board
          fen={fen}
          orientation={solverColor}
          movable={status === 'solving' && isSolverTurn ? solverColor : 'none'}
          onMove={(m) => handleMove(m.san, m.fenAfter, m.from, m.to)}
          lastMove={lastMove}
          highlights={hintSquare && status === 'solving' ? [{ square: hintSquare, color: 'var(--accent)' }] : []}
        />
      </div>

      <div className="grid">
        <Card>
          <div className="row wrap" style={{ marginBottom: 10 }}>
            <Pill solid>{solverColor === 'w' ? 'White to play' : 'Black to play'}</Pill>
            <Pill>{puzzle.rating} · {ratingBand(puzzle.rating)}</Pill>
            {total > 1 && <Pill>{total} moves</Pill>}
            {puzzle.origin === 'your-miss' && <Pill color="var(--v-blunder)">your mistake</Pill>}
            {puzzle.origin === 'punish' && <Pill color="var(--v-best)">punish it</Pill>}
          </div>

          <p>{puzzle.prompt}</p>

          {status === 'solving' && (
            <div className="small dim">
              {moveIdx > 0 ? `Good — ${total - moveIdx} move${total - moveIdx === 1 ? '' : 's'} to go.` : 'Find the move.'}
            </div>
          )}
          {status === 'checking' && (
            <div className="row small dim"><Spinner /> <span>Checking with the engine…</span></div>
          )}
          {status === 'wrong' && (
            <div className="banner error">
              <div>
                <div><span className="mono bold">{wrongSan}</span> loses the thread here.</div>
                <div className="row" style={{ marginTop: 8, gap: 6 }}>
                  {allowRetry && <button className="btn sm" onClick={retry}>Try again</button>}
                  <button className="btn sm ghost" onClick={reveal}>Show the answer</button>
                  <button className="btn sm primary" onClick={onNext}>Next →</button>
                </div>
              </div>
            </div>
          )}
          {status === 'correct' && (
            <div className="fade-in">
              <div className={`banner ${gaveUp ? '' : 'ok'}`} style={{ marginBottom: 10 }}>
                <div>
                  <div className="bold">{gaveUp ? 'The answer' : engineNote ? 'Also winning' : 'Solved'}</div>
                  <div className="small mono">{puzzle.solution.join(' ')}</div>
                </div>
              </div>
              {engineNote && <p className="small dim">{engineNote}</p>}
              <p className="small">{puzzle.explanation}</p>
              <button className="btn primary" style={{ width: '100%' }} onClick={onNext}>Next puzzle →</button>
            </div>
          )}

          {status === 'solving' && (
            <div className="row" style={{ marginTop: 12, gap: 6 }}>
              <button className="btn sm ghost" onClick={hint} disabled={Boolean(hintSquare)}>Hint</button>
              <button className="btn sm ghost" onClick={reveal}>Give up</button>
              <div className="spacer" />
              <button className="btn sm ghost" onClick={onNext}>Skip</button>
            </div>
          )}
        </Card>

        {puzzle.tags.length > 0 && (
          <Card title="Theme">
            <div className="row wrap" style={{ gap: 6 }}>
              {puzzle.tags.map((t) => (
                <a key={t} href={`#/lessons/${t}`} style={{ textDecoration: 'none' }}>
                  <Pill color="var(--accent)">{MOTIF_META[t].label} →</Pill>
                </a>
              ))}
            </div>
            {puzzle.gameId && (
              <button className="btn sm ghost" style={{ marginTop: 10, width: '100%' }} onClick={() => navigate(`/game/${puzzle.gameId}`)}>
                Open the game this came from
              </button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * Real positions often have more than one winning move. Rather than rejecting
 * anything that is not the stored line, compare the position the solver
 * reached with the one the stored solution reaches, and accept it if the
 * engine thinks they are equivalent.
 */
async function engineAcceptsAlternative(puzzle: Puzzle, fenAfterPlayed: string): Promise<boolean> {
  const engine = getEngine();
  if (engine.status === 'error') return false;

  const intended = new Chess(puzzle.fen);
  try {
    intended.move(puzzle.solution[0]);
  } catch {
    return false;
  }

  try {
    const [played, best] = await Promise.all([
      engine.analyse(fenAfterPlayed, { depth: 12, multipv: 1 }),
      engine.analyse(intended.fen(), { depth: 12, multipv: 1 }),
    ]);
    const playedEval = played.lines[0]?.evaluation;
    const bestEval = best.lines[0]?.evaluation;
    if (!playedEval || !bestEval) return false;
    // Both positions are with the opponent to move, so score them for the solver.
    const solver = puzzle.solverColor;
    const gap = winPctFor(bestEval, solver) - winPctFor(playedEval, solver);
    return gap <= 8;
  } catch {
    return false;
  }
}
