/**
 * Regenerates src/coach/starterPuzzles.ts from scripts/miniatures.ts.
 *
 *   npm run build:puzzles
 *
 * The puzzles go through exactly the same analysis and generation code as the
 * user's own games, so anything that lands in the pack is engine-verified.
 */
import { writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { bootNodeEngine, search, type NodeEngine } from '../tests/engine-node';
import { parsePgn } from '../src/chess/pgn';
import { analyseGame, type Analyser } from '../src/engine/analyze';
import { findOpening } from '../src/openings';
import { puzzlesFromGame, ratingBand } from '../src/coach/puzzles';
import { MOTIF_META, type MotifTag, type Puzzle, type PositionAnalysis } from '../src/types';
import { MINIATURES } from './miniatures';
import { ALL_OPENINGS } from '../src/openings';
import { seeMove } from '../src/chess/board';

const DEPTH = 16;
const MULTIPV = 3;

function asAnalyser(e: NodeEngine): Analyser {
  return {
    async analyse(fen, opts): Promise<PositionAnalysis> {
      const r = await search(e, fen, opts.depth ?? DEPTH, opts.multipv ?? 1);
      const sign = fen.split(' ')[1] === 'w' ? 1 : -1;
      let stable = 0;
      let lastTop: string | null = null;
      for (const line of r.raw) {
        const m = /^info .*?\bdepth (\d+)\b.*?\bmultipv 1\b.*? pv (\S+)/.exec(line);
        if (m && m[2] !== lastTop) { lastTop = m[2]; stable = Number(m[1]); }
      }
      return {
        fen,
        depth: r.lines[0]?.depth ?? 0,
        stableFromDepth: stable,
        lines: r.lines.map((l) => ({
          multipv: l!.multipv,
          depth: l!.depth,
          evaluation: { cp: l!.cp === null ? null : l!.cp * sign, mate: l!.mate === null ? null : l!.mate * sign },
          pv: l!.pv,
        })),
      };
    },
  };
}

/** Starter puzzles must not refer to "your game". */
function rewriteForStarter(p: Puzzle, source: string): Puzzle {
  const side = p.solverColor === 'w' ? 'White' : 'Black';
  const tactic = p.tags
    .filter((t) => MOTIF_META[t].family === 'tactics')
    .map((t) => MOTIF_META[t].short.toLowerCase())
    .join(' / ');
  return {
    ...p,
    id: `starter:${p.id.replace(/[^a-z0-9]+/gi, '-')}`,
    origin: 'starter',
    gameId: null,
    ply: null,
    prompt: `${side} to play and win.`,
    explanation: `${p.solution.join(' ')}${tactic ? ` — ${tactic}` : ''}. From ${source}.`,
  };
}

/**
 * Build extra source games from the verified opening book: replay a theory line,
 * then append the worst material-losing move available. Because the position
 * was balanced up to that point, the analyser rates the move as a genuine
 * blunder (rather than softening it as it does in already-decided positions),
 * and mines a clean "punish it" puzzle from real opening theory.
 */
function syntheticBlunderGames(): { name: string; pgn: string }[] {
  const out: { name: string; pgn: string }[] = [];
  const seenFen = new Set<string>();

  for (const o of ALL_OPENINGS) {
    const lines: { label: string; moves: string[] }[] = [
      { label: o.name, moves: o.moves },
      ...o.branches.map((b) => ({ label: `${o.name}: ${b.name}`, moves: b.moves })),
    ];
    let made = 0;
    for (const line of lines) {
      if (made >= 2) break;
      const board = new Chess();
      let legal = true;
      for (const san of line.moves) {
        try { board.move(san); } catch { legal = false; break; }
      }
      if (!legal) continue;
      if (seenFen.has(board.fen())) continue;

      // The most material-losing quiet move is the most instructive blunder.
      let worst: { san: string; see: number } | null = null;
      for (const mv of board.moves({ verbose: true })) {
        if (mv.san.includes('+') || mv.san.includes('#')) continue;
        if (mv.piece === 'p' || mv.piece === 'k') continue;
        const see = seeMove(board, { from: mv.from, to: mv.to, promotion: mv.promotion });
        if (see <= -2 && (!worst || see < worst.see)) worst = { san: mv.san, see };
      }
      if (!worst) continue;

      seenFen.add(board.fen());
      made++;
      // Start the game AT the theory position rather than replaying the whole
      // line: only the blunder and its refutation need engine time, so this is
      // ~10x cheaper. It also means bookPlies is 0, so the blunder is graded on
      // its merits instead of being excused as theory.
      const fen = board.fen();
      out.push({
        name: line.label,
        pgn:
          `[Event "${line.label}"]\n[White "White"]\n[Black "Black"]\n[Result "*"]\n` +
          `[SetUp "1"]\n[FEN "${fen}"]\n\n` +
          `${board.turn() === 'w' ? '1. ' : '1... '}${worst.san} *`,
      });
    }
  }
  return out;
}

const SOURCES = [...MINIATURES, ...syntheticBlunderGames()];
console.log(`${MINIATURES.length} miniatures + ${SOURCES.length - MINIATURES.length} opening-book blunders\n`);

const engine = await bootNodeEngine();
const analyser = asAnalyser(engine);

const collected: Puzzle[] = [];
const skipped: string[] = [];

for (const m of SOURCES) {
  const { games, errors } = parsePgn(m.pgn);
  if (!games.length) {
    const why = errors.map((e) => e.message).join('; ') || 'no games parsed';
    skipped.push(`${m.name}: ${why}`);
    console.log(`${m.name.padEnd(32)} SKIPPED (${why})`);
    continue;
  }
  const parsed = games[0];
  // Reject anything with an illegal move rather than shipping a broken puzzle.
  const replay = new Chess(parsed.startingFen);
  let legal = true;
  for (const mv of parsed.moves) {
    try { replay.move(mv.san); } catch { legal = false; break; }
  }
  if (!legal) { skipped.push(`${m.name}: illegal move in line`); continue; }

  const analysed = await analyseGame(analyser, parsed, 'w', { depth: DEPTH, multipv: MULTIPV, book: findOpening });
  const puzzles = puzzlesFromGame(analysed, { heroOnly: false, missFromBothSides: true, includePunish: true, maxSolverMoves: 3 });
  const good = puzzles
    // A starter puzzle must have an unambiguous, fully playable solution.
    .filter((p) => p.solution.length >= 1 && p.rating >= 650 && p.rating <= 2400)
    .map((p) => rewriteForStarter(p, m.name));
  collected.push(...good);
  if (good.length) console.log(`${m.name.slice(0, 44).padEnd(46)} ${String(analysed.moves.length).padStart(3)} plies -> ${good.length}`);
}

/* Deduplicate by position + key move, then cap per motif so the pack is varied. */
const seen = new Set<string>();
const perTag = new Map<MotifTag, number>();
const MAX_PER_TAG = 14;
const final: Puzzle[] = [];
for (const p of collected.sort((a, b) => a.rating - b.rating)) {
  const key = `${p.fen}|${p.solution[0]}`;
  if (seen.has(key)) continue;
  const primary = p.tags[0];
  if (primary && (perTag.get(primary) ?? 0) >= MAX_PER_TAG) continue;
  seen.add(key);
  if (primary) perTag.set(primary, (perTag.get(primary) ?? 0) + 1);
  final.push(p);
}

const banner = `/**
 * Bundled starter puzzles — GENERATED FILE, do not edit by hand.
 * Regenerate with: npm run build:puzzles
 *
 * Built from scripts/miniatures.ts by running each game through the same
 * analysis and puzzle-generation pipeline the app uses on your own games,
 * at depth ${DEPTH} with MultiPV ${MULTIPV}. They exist so the puzzle modes
 * have content before you have imported anything.
 */
import type { Puzzle } from '../types';

export const STARTER_PUZZLES: Puzzle[] = ${JSON.stringify(final, null, 2)};
`;

writeFileSync(new URL('../src/coach/starterPuzzles.ts', import.meta.url), banner);

console.log(`\nwrote ${final.length} starter puzzles`);
const counts = new Map<string, number>();
for (const p of final) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
console.log('motif coverage:', [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}=${n}`).join(' '));
console.log('rating bands  :', [...new Set(final.map((p) => ratingBand(p.rating)))].join(', '));
if (skipped.length) console.log('\nSKIPPED:\n  ' + skipped.join('\n  '));
engine.quit();
process.exit(0);
