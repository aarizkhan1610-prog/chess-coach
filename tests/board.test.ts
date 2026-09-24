import { Chess } from 'chess.js';
import {
  seeMove, loosePieces, findPins, findSkewers, forkTargets, hasBackRankRisk,
  pawnStructure, kingExposure, winningCaptures, attacksFrom, heavyMaterial,
} from '../src/chess/board';

let pass = 0, fail = 0;
function chk(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok   ${name} = ${g}`); }
  else { fail++; console.log(`  FAIL ${name}\n       got  ${g}\n       want ${w}`); }
}
const round = (n: number) => Math.round(n * 10) / 10;

/* ---- static exchange evaluation ---- */
{
  // 3.Nxe5?? drops a knight for a pawn.
  const c = new Chess(); ['e4','e5','Nf3','Nc6'].forEach(m => c.move(m));
  chk('see Nxe5 loses N for P', round(seeMove(c, { from: 'f3', to: 'e5' })), -2);
}
{
  // 1.e4 d5 2.exd5 Qxd5 — the d5 pawn is defended by the queen, so it nets zero.
  const c = new Chess(); ['e4','d5'].forEach(m => c.move(m));
  chk('see exd5 is an even trade', seeMove(c, { from: 'e4', to: 'd5' }), 0);
}
{
  // Truly undefended pawn: after 1.e4 e5 2.Nf3 Nf6 3.Nxe5 the pawn is free.
  const c = new Chess(); ['e4','e5','Nf3','Nf6'].forEach(m => c.move(m));
  chk('see Nxe5 wins a clean pawn', seeMove(c, { from: 'f3', to: 'e5' }), 1);
}
{
  const c = new Chess(); ['e4','e5','Nf3','Nc6','Bb5','a6','Ba4','b5'].forEach(m => c.move(m));
  chk('see Bxb5 loses B for P', round(seeMove(c, { from: 'a4', to: 'b5' })), -2.2);
}
{
  // Deep sequence: three captures on one square must resolve correctly.
  const c = new Chess('r2qkb1r/ppp2ppp/2n2n2/3pp3/3PP3/2N2N2/PPP2PPP/R1BQKB1R w - - 0 1');
  chk('see dxe5 wins a pawn (recapturing drops a knight)', round(seeMove(c, { from: 'd4', to: 'e5' })), 1);
}

/* ---- threats against a side that is not on move ---- */
{
  // 2...Qh4?? in the Damiano-style blunder: Nf3 just takes it.
  const c = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
  c.move('Qh4');
  chk('Nxh4 punishes Qh4', loosePieces(c, 'b').map(m => m.san).includes('Nxh4'), true);
}
{
  const c = new Chess(); ['e4','e5','Nf3','Nc6'].forEach(m => c.move(m));
  chk('no free material in the Italian start', loosePieces(c, 'b'), []);
}

/* ---- pins and skewers ---- */
{
  // Real pin: nothing between the knight and the king.
  const c = new Chess('4k3/8/2n5/1B6/8/8/8/4K3 w - - 0 1');
  chk('Bb5 pins Nc6 to Ke8', findPins(c, 'b').map(p => `${p.attacker}:${p.front}->${p.back}`), ['b5:c6->e8']);
}
{
  // Ruy Lopez Bb5 is NOT a pin: the d7 pawn blocks the line to e8.
  const c = new Chess(); ['e4','e5','Nf3','Nc6','Bb5'].forEach(m => c.move(m));
  chk('Ruy Lopez Bb5 is not a true pin', findPins(c, 'b'), []);
}
{
  // King in front of its own rook on the a-file is a textbook skewer.
  const c = new Chess('r7/8/8/k7/8/8/8/R3K3 w - - 0 1');
  const sk = findSkewers(c, 'b').map(p => `${p.attacker}:${p.front}->${p.back}`);
  chk('Ra1 skewers Ka5 onto Ra8', sk, ['a1:a5->a8']);
}
{
  // King in front, queen behind = skewer for white's rook on the e-file.
  const c = new Chess('8/8/8/8/8/4q3/4k3/4R1K1 w - - 0 1');
  chk('Re1 skewers Ke2 onto Qe3', findSkewers(c, 'b').map(p => `${p.front}->${p.back}`), ['e2->e3']);
}

/* ---- forks ---- */
{
  // Nd6 hits the king on e8 and the rook on f7.
  const c = new Chess('4k3/5r2/3N4/8/8/8/8/4K3 w - - 0 1');
  chk('Nd6 forks e8 and f7', forkTargets(c, 'd6').sort(), ['e8','f7']);
}
{
  const c = new Chess('4k3/8/5r2/3N4/8/8/8/4K3 w - - 0 1');
  chk('Nd5 only hits f6 (e8 is not a knight move away)', forkTargets(c, 'd5'), ['f6']);
}

/* ---- king safety, structure, phase ---- */
{
  chk('white back-rank risk', hasBackRankRisk(new Chess('6k1/5ppp/8/8/8/8/5PPP/r5K1 w - - 0 1'), 'w'), true);
  chk('h3 luft removes the risk', hasBackRankRisk(new Chess('6k1/5pp1/7p/8/8/7P/5PP1/R5K1 w - - 0 1'), 'w'), false);
  chk('no risk without enemy heavies', hasBackRankRisk(new Chess('6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1'), 'w'), false);
}
{
  chk('lone d-pawn is isolated', pawnStructure(new Chess('4k3/8/8/8/8/8/3P4/4K3 w - - 0 1'), 'w').isolated, 1);
  chk('d+e pawns are not isolated', pawnStructure(new Chess('4k3/8/8/8/8/8/3PP3/4K3 w - - 0 1'), 'w').isolated, 0);
  chk('doubled d-pawns', pawnStructure(new Chess('4k3/8/8/8/8/3P4/3P4/4K3 w - - 0 1'), 'w').doubled, 1);
}
{
  chk('bare king has 3 shield holes', kingExposure(new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), 'w').shieldHoles, 3);
  chk('castled king has 0 shield holes', kingExposure(new Chess('4k3/8/8/8/8/8/5PPP/5RK1 w - - 0 1'), 'w').shieldHoles, 0);
}
{
  chk('attacksFrom works for the side not on move', attacksFrom(new Chess('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'), 'e4').sort(), ['d5','f5']);
  chk('free queen is capturable', winningCaptures(new Chess('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1')).map(m => m.san), ['exd5']);
  chk('start position heavy material', heavyMaterial(new Chess()), 62.8);
  chk('bare kings heavy material', heavyMaterial(new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1')), 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
