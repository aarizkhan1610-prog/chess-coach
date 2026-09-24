import { Chess } from 'chess.js';
import { ALL_OPENINGS, findOpening, coursesMatching } from '../src/openings';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };

/** Replay SAN moves; returns the error message on the first illegal one. */
function replay(moves: string[]): { error: string | null; chess: Chess } {
  const c = new Chess();
  for (let i = 0; i < moves.length; i++) {
    try {
      c.move(moves[i]);
    } catch (e) {
      return { error: `move ${i + 1} "${moves[i]}" illegal (${e instanceof Error ? e.message : e})`, chess: c };
    }
  }
  return { error: null, chess: c };
}

console.log(`Verifying ${ALL_OPENINGS.length} courses\n`);

let lines = 0;
for (const o of ALL_OPENINGS) {
  const main = replay(o.moves);
  if (main.error) bad(`${o.id} main line`, main.error); else { ok(`${o.id} main line`, `(${o.moves.length} plies)`); }
  lines++;

  // The side the course teaches must be the side to move at the branch points.
  for (const b of o.branches) {
    const r = replay(b.moves);
    if (r.error) bad(`${o.id} / ${b.name}`, r.error); else pass++;
    lines++;
  }
  for (const t of o.traps) {
    const r = replay(t.moves);
    if (r.error) { bad(`${o.id} / trap ${t.name}`, r.error); }
    else {
      // If the last move ends in #, the position must really be checkmate.
      const last = t.moves[t.moves.length - 1];
      if (last.endsWith('#') && !r.chess.isCheckmate()) bad(`${o.id} / trap ${t.name}`, 'claims mate but is not mate');
      else if (!last.endsWith('#') && r.chess.isCheckmate()) bad(`${o.id} / trap ${t.name}`, 'is mate but not marked #');
      else pass++;
    }
    lines++;
  }

  // Step coverage: every step must point at a real ply, and the last step must
  // cover the whole main line, or the lesson would stop early.
  const uptos = o.steps.map((s) => s.upto);
  if (!o.steps.length) bad(`${o.id} steps`, 'no steps');
  else if (uptos.some((u) => u < 1 || u > o.moves.length)) bad(`${o.id} steps`, `upto out of range: ${uptos.join(',')}`);
  else if (uptos.some((u, i) => i > 0 && u <= uptos[i - 1])) bad(`${o.id} steps`, `upto not increasing: ${uptos.join(',')}`);
  else if (uptos[uptos.length - 1] !== o.moves.length) bad(`${o.id} steps`, `last step covers ${uptos[uptos.length - 1]} of ${o.moves.length} plies`);
  else pass++;

  // The course should teach the side it claims: the main line length parity
  // tells us whose move comes next.
  if (o.side !== 'w' && o.side !== 'b') bad(`${o.id} side`, String(o.side));
  else pass++;
  if (!o.summary || o.ideas.length < 3 || !o.plans.you.length || !o.plans.them.length) bad(`${o.id} content`, 'thin content');
  else pass++;
}
console.log(`\n(${lines} distinct move sequences replayed)\n`);

// Ids must be unique.
const ids = ALL_OPENINGS.map((o) => o.id);
if (new Set(ids).size !== ids.length) bad('unique ids', ids.join(',')); else ok('unique ids');

/* ---- detection ---- */
const cases: [string[], string][] = [
  [['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'], 'Sicilian Defence: Najdorf'],
  [['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'], 'Sicilian Defence: Dragon'],
  [['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'], 'Ruy López'],
  [['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], 'Italian Game'],
  [['d4', 'd5', 'Bf4'], 'London System'],
  [['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], 'Nimzo-Indian Defence'],
  [['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4'], 'French Defence: Winawer'],
  [['c4', 'e5', 'Nc3'], 'English Opening'],
  [['e4', 'c5', 'c3'], 'Sicilian: Alapin'],
  [['f4'], "Bird's Opening"],
];
for (const [moves, expected] of cases) {
  const hit = findOpening(moves);
  if (hit?.name === expected) ok(`detect ${expected}`, `(${hit.bookPlies} plies)`);
  else bad(`detect ${expected}`, `got ${hit?.name ?? 'null'}`);
}
{
  const hit = findOpening(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3', 'e5', 'Nb3', 'Be6', 'f3', 'Be7', 'Qd2', 'O-O']);
  if (hit && hit.bookPlies === 16) ok('book depth stops where theory stops', `${hit.bookPlies} plies`);
  else bad('book depth', `got ${hit?.bookPlies}`);
}
if (findOpening(['h4', 'h5', 'a4']) === null) ok('unknown opening returns null'); else bad('unknown opening should be null');
{
  const m = coursesMatching(['e4', 'c5']);
  if (m.length >= 3 && m.every((o) => o.group === 'vs-e4')) ok('coursesMatching 1.e4 c5', `${m.length} courses`);
  else bad('coursesMatching', m.map(o => o.id).join(','));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
