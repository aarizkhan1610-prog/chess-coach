/**
 * The explanation layer is the one part of the coach that talks to a complete
 * beginner in sentences, so it is checked against the real engine rather than
 * fixtures: an explanation is only worth anything if the position it describes
 * is the position on the board.
 *
 * Two kinds of check. Named cases assert that a known beginner situation
 * produces the right kind of answer, and a sweep runs every move of two whole
 * games through the explainer looking for the failures that only show up in
 * the long tail — empty text, unnamed pieces, or a coach that calls everything
 * a blunder.
 */
import { Chess, type Move } from 'chess.js';
import { bootNodeEngine, search, type NodeEngine } from './engine-node';
import { toWhitePov } from '../src/engine/uci';
import { explainMove, type Explanation } from '../src/coach/explain';
import type { PositionAnalysis } from '../src/types';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };

const engine = await bootNodeEngine();
const DEPTH = 12;

async function analyse(e: NodeEngine, fen: string): Promise<PositionAnalysis> {
  const turn = fen.split(' ')[1] ?? 'w';
  const r = await search(e, fen, DEPTH, 2);
  return {
    fen,
    depth: DEPTH,
    stableFromDepth: DEPTH,
    lines: r.lines.filter(Boolean).map((l) => ({
      multipv: l!.multipv,
      depth: l!.depth,
      evaluation: toWhitePov(l!.cp, l!.mate, turn),
      pv: l!.pv,
    })),
  };
}

const OPERA = ['e4','e5','Nf3','d6','d4','Bg4','dxe5','Bxf3','Qxf3','dxe5','Bc4','Nf6','Qb3','Qe7','Nc3','c6','Bg5','b5','Nxb5','cxb5','Bxb5+','Nbd7','O-O-O','Rd8','Rxd7','Rxd7','Rd1','Qe6','Bxd7+','Nxd7','Qb8+','Nxb8','Rd8#'];
// A game of the kind a beginner actually plays: edge pawns, no development.
const BEGINNER = ['e4','h6','d4','a6','Nf3','g5','Bc4','b5','Bxb5','axb5','Nxg5','hxg5','Bxg5','Nf6','e5','Rxh2','Rxh2','Nc6'];

/** Explain `move` (SAN) in the position reached by playing `line` from the start. */
async function explainAt(line: string[], move: string, fen?: string): Promise<Explanation> {
  const c = fen ? new Chess(fen) : new Chess();
  let last: Move | null = null;
  for (const san of line) last = c.move(san);
  const fenBefore = c.fen();
  const played = c.move(move);
  const uci = `${played.from}${played.to}${played.promotion ?? ''}`;
  const over = c.isCheckmate() || c.isStalemate() || c.isDraw();
  return explainMove({
    fenBefore,
    playedUci: uci,
    before: await analyse(engine, fenBefore),
    after: over ? null : await analyse(engine, c.fen()),
    lastMove: last ? { to: last.to, captured: last.captured } : null,
  });
}

/* ------------------------------------------------------------------ *
 * Sentences must be usable as sentences
 * ------------------------------------------------------------------ */

const JUNK = /undefined|NaN|\[object|null|\bpiece on\b\s*$/i;

function wellFormed(name: string, e: Explanation) {
  const all = [e.headline, ...e.points.map((p) => p.text), e.concession ?? ''].filter(Boolean);
  for (const t of all) {
    if (!t.trim()) return bad(`${name}: empty sentence`);
    if (JUNK.test(t)) return bad(`${name}: placeholder text`, JSON.stringify(t));
    if (!/[.!?]$/.test(t.trim())) return bad(`${name}: unpunctuated`, JSON.stringify(t));
    if (t.length > 260) return bad(`${name}: too long for a beginner`, `${t.length} chars`);
  }
  for (const p of e.points) {
    for (const sq of p.squares ?? []) {
      if (!/^[a-h][1-8]$/.test(sq)) return bad(`${name}: bad square`, sq);
    }
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * Named cases
 * ------------------------------------------------------------------ */

interface Case {
  name: string;
  line: string[];
  move: string;
  fen?: string;
  /** Codes that must appear among the points. */
  wants?: string[];
  tone?: Explanation['tone'];
  /** Tones that would be wrong — used to check the coach is not nagging. */
  notTone?: Explanation['tone'][];
  contains?: string[];
  /** Material the mover should be shown as losing, in pawns. */
  swingAtMost?: number;
}

const CASES: Case[] = [
  {
    name: 'takes the centre',
    line: [], move: 'e4',
    wants: ['takes-centre'],
    notTone: ['dubious', 'bad', 'losing'],
    contains: ['e4'],
  },
  {
    name: 'develops a knight',
    line: ['e4', 'e5'], move: 'Nf3',
    wants: ['develops'],
    notTone: ['dubious', 'bad', 'losing'],
    contains: ['knight'],
  },
  {
    name: 'castling',
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], move: 'O-O',
    wants: ['castles'],
    notTone: ['dubious', 'bad', 'losing'],
    contains: ['king'],
  },
  {
    name: 'moves a knight where a pawn takes it',
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], move: 'Nxe5',
    tone: 'bad',
    contains: ['e5'],
    swingAtMost: -1.5,
  },
  {
    name: 'takes the free knight back',
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'Nxe5'], move: 'Nxe5',
    wants: ['wins-material'],
    notTone: ['dubious', 'bad', 'losing'],
    contains: ['knight'],
  },
  {
    name: 'walks into Scholar’s mate',
    line: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5'], move: 'Nf6',
    wants: ['allowed-mate'],
    tone: 'losing',
    contains: ['checkmate'],
  },
  {
    name: 'delivers Scholar’s mate',
    line: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'], move: 'Qxf7#',
    tone: 'excellent',
    contains: ['Checkmate'],
  },
  {
    name: 'the early queen is not a blunder',
    line: ['e4', 'e5'], move: 'Qh5',
    notTone: ['bad', 'losing'],
  },
  {
    name: 'stalemate when winning',
    fen: 'k7/8/2Q5/8/8/8/8/7K w - - 0 1',
    line: [], move: 'Qb6',
    tone: 'bad',
    contains: ['Stalemate'],
  },
  {
    name: 'forcing mate is announced',
    line: OPERA.slice(0, 30), move: 'Qb8+',
    wants: ['forces-mate'],
    tone: 'excellent',
    contains: ['checkmate'],
  },
  {
    name: 'leaves a bishop hanging elsewhere',
    line: ['e4', 'e5', 'Bc4', 'Nf6', 'Nc3', 'd5'], move: 'h3',
    wants: ['hanging-piece'],
    tone: 'losing',
    contains: ['c4'],
  },
  {
    name: 'walks into a knight fork',
    fen: '4k3/8/r7/1N6/8/8/8/4K3 b - - 0 1',
    line: [], move: 'Ra8',
    wants: ['allowed-fork'],
    contains: ['Nc7'],
  },
  {
    name: 'ignores a free rook',
    fen: '4k3/8/8/8/8/8/3r4/3RK3 w - - 0 1',
    line: [], move: 'Kf1',
    contains: ['rook'],
  },
  {
    name: 'an even recapture is not a win',
    line: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'Bg4', 'dxe5', 'Bxf3'], move: 'Qxf3',
    wants: ['even-trade'],
    contains: ['back'],
  },
];

console.log(`Explaining ${CASES.length} named positions at depth ${DEPTH}\n`);

for (const c of CASES) {
  let e: Explanation;
  try {
    e = await explainAt(c.line, c.move, c.fen);
  } catch (err) {
    bad(`${c.name}: threw`, String(err));
    continue;
  }
  if (!wellFormed(c.name, e)) continue;

  const codes = [...e.points.map((p) => p.code), ...e.virtues, ...e.motifs];
  let good = true;
  for (const want of c.wants ?? []) {
    if (!codes.includes(want as never)) { bad(`${c.name}: expected ${want}`, `got ${codes.join(',')}`); good = false; }
  }
  if (c.tone && e.tone !== c.tone) { bad(`${c.name}: tone`, `expected ${c.tone}, got ${e.tone}`); good = false; }
  for (const t of c.notTone ?? []) {
    if (e.tone === t) { bad(`${c.name}: tone ${t} is too harsh`, e.headline); good = false; }
  }
  if (c.swingAtMost !== undefined && e.materialSwing > c.swingAtMost) {
    bad(`${c.name}: material swing`, `expected <= ${c.swingAtMost}, got ${e.materialSwing}`); good = false;
  }
  for (const s of c.contains ?? []) {
    if (!e.headline.includes(s) && !e.points.some((p) => p.text.includes(s))) {
      bad(`${c.name}: never mentions "${s}"`, e.headline); good = false;
    }
  }
  if (good) ok(`${c.name}`, `[${e.tone}] ${e.headline}`);
}

/* ------------------------------------------------------------------ *
 * The long tail
 * ------------------------------------------------------------------ */

console.log('\nSweeping whole games for long-tail failures\n');

const tones: Record<string, number> = {};
let sweepOk = 0, threw = 0, malformed = 0;
const samples: string[] = [];
const worst: string[] = [];
const covered = new Set<string>();

for (const [label, game] of [['opera', OPERA], ['beginner', BEGINNER]] as const) {
  const c = new Chess();
  const played: string[] = [];
  for (const san of game) {
    let e: Explanation;
    try {
      e = await explainAt(played, san);
    } catch (err) {
      threw++; bad(`${label} ${san}: threw`, String(err)); c.move(san); played.push(san); continue;
    }
    if (wellFormed(`${label} ${san}`, e) !== true) { malformed++; } else { sweepOk++; }
    tones[e.tone] = (tones[e.tone] ?? 0) + 1;
    for (const pt of e.points) covered.add(pt.code);
    if (label === 'opera' && played.length < 12) samples.push(`  ${played.length % 2 === 0 ? `${played.length / 2 + 1}.` : '   ...'}${san.padEnd(6)} [${e.tone}] ${e.headline}`);
    if (label === 'beginner' && e.tone === 'losing') samples.push(`  (beginner) ${san.padEnd(6)} [${e.tone}] ${e.headline}`);
    c.move(san); played.push(san);
  }
}

/*
 * Good moves are easy to explain; the templates that matter are the ones that
 * only fire on bad moves, and a game between decent players barely touches
 * them. So every few positions the engine's least favourite legal move is
 * explained too, which is both a fair model of a beginner and the quickest way
 * to find a sentence that reads badly.
 */
console.log('\nExplaining deliberately bad moves\n');

const seen = new Set<string>();
for (const e of [...covered]) seen.add(e);

for (const [label, game] of [['opera', OPERA], ['beginner', BEGINNER]] as const) {
  const played: string[] = [];
  for (let n = 0; n < game.length; n++) {
    if (n % 3 === 0) {
      const c = new Chess();
      for (const san of played) c.move(san);
      const legal = c.moves();
      // Deterministic and spread across the move list, so the corpus is stable.
      const pick = legal[(n * 7 + legal.length) % legal.length];
      try {
        const e = await explainAt(played, pick);
        if (wellFormed(`${label} bad ${pick}`, e) === true) sweepOk++; else malformed++;
        for (const p of e.points) seen.add(p.code);
        if (e.tone === 'losing' || e.tone === 'bad') worst.push(`  ${label} ${pick.padEnd(7)} [${e.tone}] ${e.headline}`);
      } catch (err) {
        threw++; bad(`${label} bad ${pick}: threw`, String(err));
      }
    }
    played.push(game[n]);
  }
}

console.log(worst.slice(0, 14).join('\n'));
console.log(`\ncodes exercised: ${[...seen].sort().join(', ')}`);

console.log(samples.join('\n'));
console.log(`\ntone spread: ${Object.entries(tones).map(([k, v]) => `${k} ${v}`).join(', ')}`);

if (threw === 0) ok('no explanation threw', `${sweepOk + malformed} moves`);
else bad('explanations threw', `${threw}`);
if (malformed === 0) ok('every sentence is well formed');

// A coach that calls everything a blunder is useless, and so is one that
// praises everything. Both games contain real mistakes and real good moves.
const total = Object.values(tones).reduce((a, b) => a + b, 0);
const harsh = (tones.bad ?? 0) + (tones.losing ?? 0);
if (harsh / total < 0.5) ok('not everything is a mistake', `${harsh}/${total} flagged`);
else bad('too harsh', `${harsh}/${total} flagged`);
if (harsh > 0) ok('real mistakes are still flagged', `${harsh}`);
else bad('nothing was flagged at all');

console.log(`\n${pass} passed, ${fail} failed`);
engine.quit();
process.exit(fail ? 1 : 0);
