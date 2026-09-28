/**
 * Every position in the beginner track is hand-written, so every claim it
 * makes is checked here: that the FEN is legal chess, that the task can be
 * completed at all, and that the stated solution completes it — replayed
 * through `advance`, the same function the drill board uses, so this cannot
 * pass while the real thing behaves differently.
 *
 * No engine. None of these questions need a search, and a first lesson should
 * not wait on a 1.7 MB download.
 */
import { Chess } from 'chess.js';
import { ALL_BASICS, advance, goalMet, type Drill } from '../src/coach/basics';
import type { Color } from '../src/types';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };

const drills = ALL_BASICS.flatMap((t) => t.drills.map((d) => ({ tour: t.id, drill: d })));
console.log(`Checking ${ALL_BASICS.length} sections and ${drills.length} drills\n`);

/* ---- the positions shown for reading ---- */
for (const tour of ALL_BASICS) {
  if (!tour.showFen) continue;
  let board: Chess;
  try {
    board = new Chess(tour.showFen);
  } catch (e) {
    bad(`${tour.id}: showFen`, String(e));
    continue;
  }
  if (tour.showFrom) {
    const piece = board.get(tour.showFrom as never);
    if (!piece) bad(`${tour.id}: nothing on ${tour.showFrom}`);
    else if (tour.piece && piece.type !== tour.piece) bad(`${tour.id}: ${tour.showFrom} holds a ${piece.type}, not a ${tour.piece}`);
    else if (board.moves({ square: tour.showFrom as never }).length === 0) bad(`${tour.id}: the piece on ${tour.showFrom} cannot move`);
    else ok(`${tour.id}: reach diagram`, `${board.moves({ square: tour.showFrom as never }).length} squares`);
  } else {
    ok(`${tour.id}: diagram is legal`);
  }
}

/* ---- the drills ---- */
function check(tourId: string, d: Drill) {
  const name = `${tourId}/${d.id}`;

  let start: Chess;
  try {
    start = new Chess(d.fen);
  } catch (e) {
    bad(`${name}: FEN`, String(e));
    return;
  }
  const mover = start.turn() as Color;

  // chess.js refuses a position without both kings, and so does every helper
  // that reasons about one. Assert it rather than discovering it at runtime.
  const kings = start.board().flat().filter((s) => s && s.type === 'k').length;
  if (kings !== 2) { bad(`${name}: ${kings} kings on the board`); return; }

  for (const sq of d.mark ?? []) {
    if (!/^[a-h][1-8]$/.test(sq)) { bad(`${name}: bad marked square`, sq); return; }
  }
  if (!d.solution.length) { bad(`${name}: no solution given`); return; }

  // The goal must not already be satisfied, or the drill is a no-op.
  if (goalMet(d.fen, d.fen, d.goal, mover)) { bad(`${name}: already finished before a move is made`); return; }

  // Replay the stated solution exactly as the drill board would.
  let fen = d.fen;
  const replies: string[] = [];
  for (const san of d.solution) {
    const probe = new Chess(fen);
    let uci: { from: string; to: string; promotion?: string };
    try {
      const m = probe.move(san);
      uci = { from: m.from, to: m.to, promotion: m.promotion };
    } catch {
      bad(`${name}: "${san}" is not legal`, fen);
      return;
    }
    const next = advance(fen, uci);
    if (!next) { bad(`${name}: advance rejected ${san}`); return; }
    if (next.reply) replies.push(next.reply);
    fen = next.fen;
  }

  if (!goalMet(d.fen, fen, d.goal, mover)) {
    bad(`${name}: "${d.solution.join(' ')}" does not finish the task`, `goal ${d.goal.kind}`);
    return;
  }
  ok(name, `${d.solution.join(' ')}${replies.length ? ` (king answered: ${replies.join(' ')})` : ''}`);
}

for (const { tour, drill } of drills) check(tour, drill);

/* ---- claims made in prose ---- */
{
  const stalemate = ALL_BASICS.find((t) => t.id === 'stalemate');
  const board = stalemate?.showFen ? new Chess(stalemate.showFen) : null;
  if (!board) bad('stalemate: no position shown');
  else if (!board.isStalemate()) bad('stalemate: the position shown is not stalemate');
  else ok('stalemate: the position shown really is stalemate');

  const mate = ALL_BASICS.flatMap((t) => t.drills).find((d) => d.goal.kind === 'mate');
  if (!mate) bad('checkmate: no mating drill');
  else {
    const board2 = new Chess(mate.fen);
    board2.move(mate.solution[0]);
    if (board2.isCheckmate()) ok('checkmate: the stated move really is mate', mate.solution[0]);
    else bad('checkmate: the stated move is not mate', mate.solution[0]);
  }
}

/* ---- prose hygiene ---- */
for (const tour of ALL_BASICS) {
  const texts = [tour.lede, ...tour.read, ...tour.drills.flatMap((d) => [d.task, d.hint, d.done])];
  const broken = texts.filter((t) => !t.trim() || !/[.!?]$/.test(t.trim()) || /\\u[0-9a-f]{4}/i.test(t));
  if (broken.length) bad(`${tour.id}: prose`, JSON.stringify(broken[0]));
  else ok(`${tour.id}: prose`, `${texts.length} lines`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
