/**
 * The guided game makes three promises to the learner, and every one of them
 * is a claim about chess rather than about code, so every one is checked here
 * against the real engine: that the whole game is legal and ends in mate, that
 * the moves it recommends are genuinely good, and — the promise the design
 * depends on — that from `freeFrom` there is a forced mate, so the finish
 * cannot break no matter what the learner plays.
 */
import { Chess } from 'chess.js';
import { bootNodeEngine, search } from './engine-node';
import { GUIDED_GAMES, sameMove, type GuidedGame } from '../src/coach/guidedGame';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };

const engine = await bootNodeEngine();
const DEPTH = 14;

/**
 * Morphy's 8.Nc3 is not the engine's first choice — it prefers grabbing b7.
 * That disagreement is taught in the move's own text rather than hidden, so
 * the tolerance exists to keep it honest: any *other* move drifting this far
 * from best should fail the build.
 */
const ALLOWED_GAP = 1.0;

function sanOf(fen: string, uci: string): string {
  const c = new Chess(fen);
  try {
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined }).san;
  } catch {
    return '?';
  }
}

async function checkGame(game: GuidedGame) {
  const board = new Chess();
  const heroIsWhite = game.hero === 'w';

  /* ---- the game is legal and ends the way it says ---- */
  const positions: string[] = [];
  for (const move of game.moves) {
    positions.push(board.fen());
    try {
      board.move(move.san);
    } catch {
      bad(`${game.id}: "${move.san}" is not legal`, board.fen());
      return;
    }
    if (move.reply) {
      try {
        board.move(move.reply);
      } catch {
        bad(`${game.id}: reply "${move.reply}" is not legal`, board.fen());
        return;
      }
    }
  }
  if (!board.isCheckmate()) { bad(`${game.id}: the game does not end in checkmate`); return; }
  ok(`${game.id}: legal from start to mate`, `${game.moves.length} moves`);

  // The last scripted move must be the mate itself, or the ending is a lie.
  if (game.moves[game.moves.length - 1].reply !== null) bad(`${game.id}: the final move has a reply after it`);
  else ok(`${game.id}: the script ends on the mate`);

  /* ---- the free phase is genuinely forced ---- */
  {
    const fen = positions[game.freeFrom];
    const r = await search(engine, fen, 18, 1);
    const line = r.lines[0];
    const mate = line?.mate ?? null;
    if (mate === null || mate <= 0) {
      bad(`${game.id}: no forced mate where the suggestions stop`, `${fen}`);
    } else if (mate > 2) {
      bad(`${game.id}: mate in ${mate} is too long to hand over`);
    } else {
      ok(`${game.id}: forced mate in ${mate} from move ${game.freeFrom + 1}`, sanOf(fen, line!.pv[0]));
    }

    // Every reply being mated is what makes the ending unbreakable, and here
    // the opponent has only one legal move at all.
    const after = new Chess(fen);
    after.move(game.moves[game.freeFrom].san);
    const replies = after.moves().length;
    if (replies === 1) ok(`${game.id}: the opponent has exactly one legal reply`, after.moves()[0]);
    else bad(`${game.id}: ${replies} replies available where the script expects one`);

    if (game.freeFrom >= game.moves.length - 1) bad(`${game.id}: nothing is left for the learner to find`);
    else ok(`${game.id}: ${game.moves.length - game.freeFrom} moves left to the learner`);
  }

  /* ---- the recommended moves really are good ---- */
  let topChoice = 0;
  for (let i = 0; i < game.moves.length; i++) {
    const fen = positions[i];
    const played = game.moves[i].san;
    const r = await search(engine, fen, DEPTH, 3);
    const lines = r.lines.filter(Boolean);
    if (!lines.length) { bad(`${game.id} ${played}: no engine lines`); continue; }

    const sign = heroIsWhite ? 1 : -1;
    const scoreOf = (l: NonNullable<(typeof lines)[number]>) =>
      (l.mate !== null ? (l.mate > 0 ? 10000 : -10000) : l.cp) * (fen.split(' ')[1] === game.hero ? 1 : sign);

    const best = lines[0]!;
    const mine = lines.find((l) => sameMove(sanOf(fen, l!.pv[0]), played));
    if (!mine) {
      // Outside the top three: measure it directly rather than guessing.
      const probe = new Chess(fen);
      probe.move(played);
      const after = await search(engine, probe.fen(), DEPTH, 1);
      const theirs = after.lines[0];
      const gap = theirs ? Math.abs(scoreOf(best) + (theirs.cp ?? 0)) / 100 : Infinity;
      if (gap > ALLOWED_GAP) bad(`${game.id} ${played}: ${gap.toFixed(2)} worse than ${sanOf(fen, best.pv[0])}`);
      else ok(`${game.id} ${played}`, `outside top 3 but only ${gap.toFixed(2)} behind`);
      continue;
    }

    const gap = (scoreOf(best) - scoreOf(mine!)) / 100;
    if (gap <= 0.01) { topChoice++; ok(`${game.id} ${played}`, 'engine agrees'); }
    else if (gap <= ALLOWED_GAP) ok(`${game.id} ${played}`, `${gap.toFixed(2)} behind ${sanOf(fen, best.pv[0])}`);
    else bad(`${game.id} ${played}: ${gap.toFixed(2)} behind ${sanOf(fen, best.pv[0])}`);
  }
  ok(`${game.id}: ${topChoice} of ${game.moves.length} moves are the engine's first choice`);

  /* ---- the coaching text ---- */
  for (let i = 0; i < game.moves.length; i++) {
    const m = game.moves[i];
    const free = i >= game.freeFrom;
    const texts = [m.why, ...(m.principle ? [m.principle] : []), ...(m.replyNote ? [m.replyNote] : [])];
    if (!free) texts.push(m.idea);

    if (free && m.idea) { bad(`${game.id} ${m.san}: a move after freeFrom still suggests an idea`); continue; }
    const broken = texts.find((t) => !t.trim() || !/[.!?]$/.test(t.trim()) || /\\u[0-9a-f]{4}/i.test(t));
    if (broken !== undefined) { bad(`${game.id} ${m.san}: prose`, JSON.stringify(broken)); continue; }
    // The prompt must not give the move away before they have thought about it.
    if (!free && m.idea.includes(m.san)) { bad(`${game.id} ${m.san}: the idea names the move`); continue; }
    ok(`${game.id} ${m.san}: text`, free ? 'free phase' : `${texts.length} lines`);
  }
}

for (const game of GUIDED_GAMES) await checkGame(game);

console.log(`\n${pass} passed, ${fail} failed`);
engine.quit();
process.exit(fail ? 1 : 0);
