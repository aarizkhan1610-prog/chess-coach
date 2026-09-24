import { parsePgn, moveTimes, heroFor, parseTimeControl, pvToSan, splitGames } from '../src/chess/pgn';

let pass = 0, fail = 0;
function chk(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok   ${name} = ${g}`); }
  else { fail++; console.log(`  FAIL ${name}\n       got  ${g}\n       want ${w}`); }
}

// Lichess-style export: clocks in comments, eval annotations, two games in one file.
const LICHESS = `[Event "Rated Blitz game"]
[Site "https://lichess.org/abcd1234"]
[Date "2026.03.01"]
[White "alice"]
[Black "bob"]
[Result "0-1"]
[UTCDate "2026.03.01"]
[WhiteElo "1520"]
[BlackElo "1547"]
[TimeControl "300+3"]
[ECO "C50"]
[Termination "Normal"]

1. e4 { [%clk 0:05:00] } e5 { [%clk 0:04:58] } 2. Nf3 { [%clk 0:04:59] } Nc6 { [%clk 0:04:55] } 3. Bc4 { [%clk 0:04:52] } Nf6 { [%clk 0:04:40] } 4. Ng5?? { [%clk 0:04:30] } Nxe4 { [%clk 0:04:35] } 0-1

[Event "Rated Rapid game"]
[Site "https://lichess.org/efgh5678"]
[Date "2026.03.02"]
[White "bob"]
[Black "alice"]
[Result "1-0"]
[TimeControl "600+0"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 1-0
`;

// Chess.com-style: variations and NAGs that must be stripped, no clocks.
const WITH_VARIATIONS = `[Event "Live Chess"]
[White "carol"]
[Black "dave"]
[Result "1-0"]

1. e4 e5 2. Nf3 (2. Bc4 Nf6 (2... Bc5 3. Qh5) 3. d3) Nc6 $1 3. Bb5 {the Ruy} a6 1-0
`;

// A game that does not start from the initial position.
const FROM_FEN = `[Event "Endgame study"]
[White "you"]
[Black "engine"]
[Result "1-0"]
[SetUp "1"]
[FEN "6k1/5pp1/7p/8/8/8/5PPP/R5K1 w - - 0 1"]

1. Ra8+ Kh7 2. Ra7 1-0
`;

{
  chk('splitGames finds 2 games', splitGames(LICHESS).length, 2);
  const { games, errors } = parsePgn(LICHESS);
  chk('parse errors', errors, []);
  chk('game count', games.length, 2);
  const g = games[0];
  chk('white', g.meta.white, 'alice');
  chk('elo', [g.meta.whiteElo, g.meta.blackElo], [1520, 1547]);
  chk('eco', g.meta.eco, 'C50');
  chk('move count', g.moves.length, 8);
  chk('sans', g.moves.map(m => m.san).join(' '), 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Nxe4');
  chk('annotation stripped from san', g.moves[6].san, 'Ng5');
  chk('uci of first move', g.moves[0].uci, 'e2e4');
  chk('time control', g.timeControl, { base: 300, increment: 3 });
  chk('clock after 1.e4', g.moves[0].clockSeconds, 300);
  // White: 300 -> 300 means 3s spent, offset by the 3s increment.
  const times = moveTimes(g);
  chk('white move 1 time', times[0], 3);
  chk('black move 1 time (298 from 300, +3 inc)', times[1], 5);
  chk('white move 4 took longer', times[6], 25);
  chk('second game id differs', games[0].id !== games[1].id, true);
}
{
  const { games, errors } = parsePgn(WITH_VARIATIONS);
  chk('variations: no errors', errors, []);
  chk('variations stripped', games[0].moves.map(m => m.san).join(' '), 'e4 e5 Nf3 Nc6 Bb5 a6');
  chk('no clock data', games[0].moves[0].clockSeconds, null);
  chk('moveTimes all null', moveTimes(games[0]).every(t => t === null), true);
}
{
  const { games, errors } = parsePgn(FROM_FEN);
  chk('fen game: no errors', errors, []);
  chk('starting fen respected', games[0].startingFen, '6k1/5pp1/7p/8/8/8/5PPP/R5K1 w - - 0 1');
  chk('fen game moves', games[0].moves.map(m => m.san).join(' '), 'Ra8+ Kh7 Ra7');
  chk('first move number is 1', games[0].moves[0].moveNumber, 1);
}
{
  chk('dedupe identical games', parsePgn(LICHESS + LICHESS).games.length, 2);
  chk('bad input is reported not thrown', parsePgn('[Event "x"]\n\n1. zz9 qq8 *').errors.length, 1);
  chk('empty input', parsePgn('').games, []);
}
{
  const { games } = parsePgn(LICHESS);
  chk('heroFor white', heroFor(games[0].meta, 'alice'), 'w');
  chk('heroFor black case-insensitive', heroFor(games[0].meta, 'BOB'), 'b');
  chk('heroFor unknown', heroFor(games[0].meta, 'zoe'), null);
  chk('parseTimeControl unlimited', parseTimeControl('-'), null);
  chk('parseTimeControl no increment', parseTimeControl('180'), { base: 180, increment: 0 });
}
{
  chk('pvToSan', pvToSan('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e2e4','e7e5','g1f3']), ['e4','e5','Nf3']);
  chk('pvToSan stops at illegal', pvToSan('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e2e4','e7e5','e2e4']), ['e4','e5']);
  chk('pvToSan promotion', pvToSan('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', ['a7a8q']), ['a8=Q+']);
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
