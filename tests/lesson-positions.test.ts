/**
 * Every position used in a lesson is hand-written, so each one is checked
 * against the engine: the FEN must be legal, the whole line must be playable,
 * and the first move must actually be the best move in the position.
 */
import { Chess } from 'chess.js';
import { bootNodeEngine, search } from './engine-node';
import { ALL_LESSONS } from '../src/coach/lessons';
import { winPctFor } from '../src/chess/evaluation';
import type { Color } from '../src/types';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };

const engine = await bootNodeEngine();
const DEPTH = 16;

const positions = ALL_LESSONS.flatMap((l) =>
  l.steps.filter((s) => s.kind === 'position').map((s) => ({ lesson: l.tag, step: s as Extract<typeof s, { kind: 'position' }> })),
);
console.log(`Checking ${positions.length} lesson positions at depth ${DEPTH}\n`);

for (const { lesson, step } of positions) {
  let board: Chess;
  try {
    board = new Chess(step.fen);
  } catch (e) {
    bad(`${lesson}: FEN`, String(e));
    continue;
  }
  const mover = board.turn() as Color;

  // The whole line must be playable.
  const probe = new Chess(step.fen);
  let playable = true;
  for (const san of step.solution) {
    try { probe.move(san); } catch { playable = false; break; }
  }
  if (!playable) { bad(`${lesson}: solution "${step.solution.join(' ')}" is not legal`); continue; }

  // The stated answer must be the engine's choice, or equal to it.
  const r = await search(engine, step.fen, DEPTH, 3);
  const best = r.lines[0]!;
  const bestSan = (() => {
    const c = new Chess(step.fen);
    try { return c.move({ from: best.pv[0].slice(0, 2), to: best.pv[0].slice(2, 4), promotion: best.pv[0].slice(4, 5) || undefined }).san; }
    catch { return '?'; }
  })();

  const norm = (s: string) => s.replace(/[+#!?]/g, '');
  if (norm(bestSan) === norm(step.solution[0])) {
    ok(`${lesson}: ${step.solution[0]}`, `(engine agrees${best.mate !== null ? `, mate in ${best.mate}` : `, ${best.cp}cp`})`);
    continue;
  }

  // Not the top choice — accept only if it is within a whisker of it.
  const sign = mover === 'w' ? 1 : -1;
  const alt = r.lines.find((l) => {
    const c = new Chess(step.fen);
    try { return norm(c.move({ from: l!.pv[0].slice(0, 2), to: l!.pv[0].slice(2, 4), promotion: l!.pv[0].slice(4, 5) || undefined }).san) === norm(step.solution[0]); }
    catch { return false; }
  });
  if (alt) {
    const gap =
      winPctFor({ cp: best.cp === null ? null : best.cp * sign, mate: best.mate === null ? null : best.mate * sign }, mover) -
      winPctFor({ cp: alt.cp === null ? null : alt.cp * sign, mate: alt.mate === null ? null : alt.mate * sign }, mover);
    if (gap <= 3) { ok(`${lesson}: ${step.solution[0]}`, `(equal to ${bestSan}, ${gap.toFixed(1)} win% apart)`); continue; }
    bad(`${lesson}: ${step.solution[0]} is ${gap.toFixed(1)} win% worse than ${bestSan}`);
    continue;
  }
  bad(`${lesson}: stated answer ${step.solution[0]}, engine plays ${bestSan}`);
}

engine.quit();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
