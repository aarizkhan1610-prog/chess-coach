import { bootNodeEngine, search, type NodeEngine } from './engine-node';
import { parsePgn } from '../src/chess/pgn';
import { analyseGame, type Analyser } from '../src/engine/analyze';
import { findOpening } from '../src/openings';
import type { PositionAnalysis } from '../src/types';

let pass = 0, fail = 0;
const ok = (n: string, d = '') => { pass++; console.log(`  ok   ${n} ${d}`); };
const bad = (n: string, d = '') => { fail++; console.log(`  FAIL ${n} ${d}`); };
const chk = (n: string, cond: boolean, d = '') => (cond ? ok(n, d) : bad(n, d));

/** Wrap the Node engine in the same interface the browser worker exposes. */
function asAnalyser(e: NodeEngine): Analyser {
  return {
    async analyse(fen, opts): Promise<PositionAnalysis> {
      const r = await search(e, fen, opts.depth ?? 12, opts.multipv ?? 1);
      const turn = fen.split(' ')[1];
      const sign = turn === 'w' ? 1 : -1;
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

const engine = await bootNodeEngine();
const analyser = asAnalyser(engine);
const DEPTH = 12;

/* ------------------------------------------------------------------ *
 * Game 1: White drops a knight on move 4 with 4.Nxe5??
 * ------------------------------------------------------------------ */
{
  const pgn = `[Event "Test"]
[White "hero"]
[Black "rival"]
[Result "0-1"]
[TimeControl "300+0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Nxe5 Nxe5 5. d4 Bxd4 6. Qxd4 Qf6 0-1`;
  const { games } = parsePgn(pgn);
  chk('game parsed', games.length === 1, JSON.stringify(parsePgn(pgn).errors));
  const t0 = Date.now();
  const g = await analyseGame(analyser, games[0], 'w', { depth: DEPTH, multipv: 3, book: findOpening });
  console.log(`       analysed ${g.moves.length} moves in ${Date.now() - t0}ms at depth ${DEPTH}`);

  chk('opening detected', g.openingName === 'Italian Game', String(g.openingName));
  chk('book plies counted', g.bookPlies === 6, String(g.bookPlies));
  chk('early moves marked as book', g.moves.slice(0, 6).every((m) => m.verdict === 'book'));

  const nxe5 = g.moves.find((m) => m.san === 'Nxe5' && m.color === 'w');
  chk('4.Nxe5 found', !!nxe5);
  chk('4.Nxe5 is a blunder', nxe5!.verdict === 'blunder', `verdict=${nxe5!.verdict} winLoss=${nxe5!.winLoss}`);
  chk('4.Nxe5 loses real evaluation', nxe5!.winLoss > 25, `winLoss=${nxe5!.winLoss}`);
  chk('4.Nxe5 is tagged', nxe5!.motifs.length > 0, JSON.stringify(nxe5!.motifs));
  chk(
    '4.Nxe5 tagged as a material giveaway',
    nxe5!.motifs.some((t) => ['unsound-sacrifice', 'moved-into-attack', 'hanging-piece'].includes(t)),
    JSON.stringify(nxe5!.motifs),
  );
  chk('refutation is Nxe5', nxe5!.refutationSan[0] === 'Nxe5', nxe5!.refutationSan.join(' '));
  chk('engine suggests something better', !!nxe5!.bestSan && nxe5!.bestSan !== 'Nxe5', String(nxe5!.bestSan));

  // Both sides blunder a piece in this game (5...Bxd4?? hands it straight back
  // to 6.Qxd4), so the useful assertion is that the metric notices at all.
  const bxd4 = g.moves.find((m) => m.san === 'Bxd4' && m.color === 'b');
  chk('black\'s 5...Bxd4 is also caught', bxd4?.verdict === 'blunder', `verdict=${bxd4?.verdict} winLoss=${bxd4?.winLoss}`);
  chk('6.Qxd4 recognised as the only move', g.moves.find((m) => m.san === 'Qxd4')?.verdict === 'great');
  chk('a blunder drags accuracy well below 100', g.accuracy.w < 80 && g.accuracy.b < 80, `w=${g.accuracy.w} b=${g.accuracy.b}`);
  chk('every move has a verdict', g.moves.every((m) => !!m.verdict));
  chk('every move has an accuracy 0-100', g.moves.every((m) => m.accuracy >= 0 && m.accuracy <= 100));
  chk('blunder counted once for white', g.counts.w.blunder >= 1, JSON.stringify(g.counts.w));
  chk('phases assigned', g.moves.every((m) => ['opening', 'middlegame', 'endgame'].includes(m.phase)));
}

/* ------------------------------------------------------------------ *
 * Game 2: the back-rank rook wanders off and allows mate.
 * ------------------------------------------------------------------ */
{
  const pgn = `[Event "Back rank"]
[White "rival"]
[Black "hero"]
[Result "1-0"]
[SetUp "1"]
[FEN "r5k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1"]

1... Ra5 2. Rd8# 1-0`;
  const { games, errors } = parsePgn(pgn);
  chk('fen game parsed', games.length === 1, JSON.stringify(errors));
  const g = await analyseGame(analyser, games[0], 'b', { depth: DEPTH, multipv: 3, book: findOpening });

  const ra5 = g.moves[0];
  chk('...Ra5 is black', ra5.color === 'b' && ra5.san === 'Ra5', `${ra5.color} ${ra5.san}`);
  chk('...Ra5 is a blunder', ra5.verdict === 'blunder', `verdict=${ra5.verdict} winLoss=${ra5.winLoss}`);
  chk(
    '...Ra5 tagged back-rank or allowed-mate',
    ra5.motifs.some((t) => t === 'back-rank' || t === 'allowed-mate'),
    JSON.stringify(ra5.motifs),
  );
  chk('refutation is the mate', ra5.refutationSan[0] === 'Rd8#', ra5.refutationSan.join(' '));
  chk('final position evaluates as decided', g.moves[1].evalAfter.cp !== null || g.moves[1].evalAfter.mate !== null);
  chk('mating move is not punished', g.moves[1].winLoss === 0, `winLoss=${g.moves[1].winLoss}`);
}

/* ------------------------------------------------------------------ *
 * Game 3: a clean game should produce no blunders and high accuracy.
 * ------------------------------------------------------------------ */
{
  const pgn = `[Event "Clean"]
[White "hero"]
[Black "rival"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O *`;
  const { games } = parsePgn(pgn);
  const g = await analyseGame(analyser, games[0], 'w', { depth: DEPTH, multipv: 3, book: findOpening });
  chk('Ruy Lopez detected', g.openingName?.startsWith('Ruy López') === true, String(g.openingName));
  chk('all 16 plies are book', g.bookPlies === 16, String(g.bookPlies));
  chk('no blunders in a book line', g.counts.w.blunder === 0 && g.counts.b.blunder === 0);
  chk('book moves carry no motifs', g.moves.every((m) => m.motifs.length === 0));
  chk('a clean game scores high', g.accuracy.w > 90 && g.accuracy.b > 90, `w=${g.accuracy.w} b=${g.accuracy.b}`);
}

engine.quit();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
