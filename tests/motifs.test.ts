import { Chess } from 'chess.js';
import { detectMotifs, phaseOf, type MotifInput } from '../src/chess/motifs';
import type { Color, Evaluation } from '../src/types';
import { winPctFor } from '../src/chess/evaluation';

let pass = 0, fail = 0;
function has(name: string, tags: string[], want: string) {
  if (tags.includes(want)) { pass++; console.log(`  ok   ${name} -> ${JSON.stringify(tags)}`); }
  else { fail++; console.log(`  FAIL ${name}\n       got  ${JSON.stringify(tags)}\n       want to contain ${want}`); }
}
function chk(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok   ${name} = ${g}`); }
  else { fail++; console.log(`  FAIL ${name}\n       got  ${g}\n       want ${w}`); }
}

const cp = (n: number): Evaluation => ({ cp: n, mate: null });
const mate = (n: number): Evaluation => ({ cp: null, mate: n });

/** Build a MotifInput, deriving fenAfter and winLoss so the cases stay short. */
function mk(o: {
  fen: string; played: string; best?: string[]; ref?: string[];
  before: Evaluation; after: Evaluation; phase?: 'opening' | 'middlegame' | 'endgame';
  seconds?: number | null; clock?: number | null; base?: number | null;
}): MotifInput {
  const c = new Chess(o.fen);
  const mover = c.turn() as Color;
  const m = c.move({ from: o.played.slice(0, 2), to: o.played.slice(2, 4), promotion: o.played.slice(4, 5) || undefined });
  return {
    fenBefore: o.fen,
    fenAfter: m.after,
    playedUci: o.played,
    mover,
    bestPv: o.best ?? [],
    refutationPv: o.ref ?? [],
    evalBefore: o.before,
    evalAfter: o.after,
    winLoss: Math.max(0, winPctFor(o.before, mover) - winPctFor(o.after, mover)),
    phase: o.phase ?? 'middlegame',
    secondsSpent: o.seconds ?? null,
    clockRemaining: o.clock ?? null,
    timeControlBase: o.base ?? null,
  };
}

/* 2...Qh4?? — the queen walks onto a square the knight covers. */
has('Qh4 into Nxh4', detectMotifs(mk({
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
  played: 'd8h4', ref: ['f3h4'], before: cp(30), after: cp(-800), phase: 'opening',
})), 'moved-into-attack');

/* A bishop is attacked; the mover plays elsewhere and loses it. */
{
  const tags = detectMotifs(mk({
    fen: '4k3/8/8/1p6/2B5/8/8/4K3 w - - 0 1',
    played: 'e1e2', ref: ['b5c4'], before: cp(250), after: cp(-80),
  }));
  has('ignoring an attacked bishop', tags, 'hanging-piece');
  has('...and it was already threatened', tags, 'ignored-threat');
}

/* King steps onto the square that completes a knight fork. */
has('Ke8 allows Nc7+ fork', detectMotifs(mk({
  fen: 'r2k4/8/8/3N4/8/8/8/4K3 b - - 0 1',
  played: 'd8e8', ref: ['d5c7'], before: cp(0), after: cp(450),
})), 'allowed-fork');

/* The rook that guarded the back rank wanders off. */
has('Ra5 allows Rd8#', detectMotifs(mk({
  fen: 'r5k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1',
  played: 'a8a5', ref: ['d1d8'], before: cp(0), after: mate(1),
})), 'back-rank');

/* Free queen on offer, mover shuffles the king. */
has('missing exd5', detectMotifs(mk({
  fen: '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1',
  played: 'e1e2', best: ['e4d5'], before: cp(120), after: cp(-500),
})), 'missed-material');

/* 2.Qh5 in the opening with nothing developed. */
has('premature queen', detectMotifs(mk({
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  played: 'd1h5', best: ['g1f3'], before: cp(30), after: cp(-160), phase: 'opening',
})), 'premature-queen');

/* Mate was there and got thrown away. */
has('missed mate', detectMotifs(mk({
  fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
  played: 'g1h1', best: ['a1a8'], before: mate(1), after: cp(0),
})), 'missed-mate');

/* Walking into mate. */
has('allowed mate', detectMotifs(mk({
  fen: '3r2k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
  played: 'e1e8', ref: ['d8e8'], before: cp(0), after: mate(-2),
})), 'allowed-mate');

/* Giving up a piece for nothing. */
has('unsound sacrifice', detectMotifs(mk({
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
  played: 'c4f7', ref: ['e8f7'], before: cp(20), after: cp(-260),
})), 'unsound-sacrifice');

/* Context tags ride along with the cause. */
{
  const tags = detectMotifs(mk({
    fen: '4k3/8/8/1p6/2B5/8/8/4K3 w - - 0 1',
    played: 'e1e2', ref: ['b5c4'], before: cp(700), after: cp(50),
  }));
  has('dropping a won game', tags, 'converting-advantage');
}
{
  const tags = detectMotifs(mk({
    fen: '4k3/8/8/1p6/2B5/8/8/4K3 w - - 0 1',
    played: 'e1e2', ref: ['b5c4'], before: cp(250), after: cp(-300), seconds: 1.2,
  }));
  has('blitzed-out blunder', tags, 'time-trouble');
}

/* Every real mistake gets at least one actionable tag. */
{
  const tags = detectMotifs(mk({
    fen: '4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1',
    played: 'e1d1', best: ['a2a4'], before: cp(150), after: cp(-60),
  }));
  chk('fallback produces a tag', tags.length > 0, true);
}
/* Good moves stay untagged. */
chk('a fine move earns no tags', detectMotifs(mk({
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  played: 'e2e4', best: ['e2e4'], before: cp(25), after: cp(25), phase: 'opening',
})), []);
chk('tag list is capped', detectMotifs(mk({
  fen: 'r5k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1',
  played: 'a8a5', ref: ['d1d8'], before: cp(600), after: mate(1), seconds: 0.5,
})).length <= 4, true);

/* Phase detection. */
chk('start is opening', phaseOf('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 0), 'opening');
chk('bare kings + pawns is endgame', phaseOf('4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1', 40), 'endgame');
chk('full board late is middlegame', phaseOf('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1', 30), 'middlegame');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
