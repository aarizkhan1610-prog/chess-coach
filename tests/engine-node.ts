/**
 * Boots the real Stockfish build under Node and checks that our UCI parser
 * agrees with actual engine output. The browser uses the same parser.
 */
import { createRequire } from 'node:module';
import { parseInfo } from '../src/engine/uci';

const require = createRequire(import.meta.url);

export interface NodeEngine {
  send(cmd: string): void;
  onLine(cb: (line: string) => void): () => void;
  quit(): void;
}

export async function bootNodeEngine(): Promise<NodeEngine> {
  const init = require('stockfish');
  const engine = await init(require.resolve('stockfish/bin/stockfish-19-lite-single.js'));
  const subs = new Set<(l: string) => void>();
  // The Node build routes engine output through `listener`, not postMessage.
  engine.listener = (line: string) => { for (const s of subs) s(line); };
  const api: NodeEngine = {
    send: (cmd) => engine.sendCommand(cmd),
    onLine: (cb) => { subs.add(cb); return () => subs.delete(cb); },
    quit: () => { try { engine.terminate?.(); } catch { /* noop */ } },
  };
  await new Promise<void>((res) => {
    const off = api.onLine((l) => { if (l.trim() === 'uciok') { off(); res(); } });
    api.send('uci');
  });
  return api;
}

export function search(e: NodeEngine, fen: string, depth: number, multipv = 1) {
  return new Promise<{ lines: ReturnType<typeof parseInfo>[]; bestmove: string; raw: string[] }>((resolve) => {
    const raw: string[] = [];
    const best = new Map<number, NonNullable<ReturnType<typeof parseInfo>>>();
    const off = e.onLine((line) => {
      raw.push(line);
      const info = parseInfo(line);
      if (info && info.multipv <= multipv) {
        const prev = best.get(info.multipv);
        if (!prev || info.depth >= prev.depth) best.set(info.multipv, info);
      }
      if (line.startsWith('bestmove')) {
        off();
        resolve({ lines: [...best.values()].sort((a, b) => a!.multipv - b!.multipv), bestmove: line.split(/\s+/)[1], raw });
      }
    });
    e.send(`setoption name MultiPV value ${multipv}`);
    e.send('ucinewgame');
    e.send(`position fen ${fen}`);
    e.send(`go depth ${depth}`);
  });
}

if (process.env.RUN_ENGINE_TEST === "1") {
  const t0 = Date.now();
  const e = await bootNodeEngine();
  console.log(`engine booted in ${Date.now() - t0}ms`);
  let pass = 0, fail = 0;
  const chk = (n: string, ok: boolean, detail = '') => {
    if (ok) { pass++; console.log(`  ok   ${n} ${detail}`); } else { fail++; console.log(`  FAIL ${n} ${detail}`); }
  };

  // 1. Start position: roughly balanced, sensible first move.
  {
    const t = Date.now();
    const r = await search(e, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 14);
    const l = r.lines[0]!;
    chk('start position parses', l !== undefined);
    chk('start eval is near equal', Math.abs(l.cp ?? 999) < 80, `cp=${l.cp}`);
    chk('reached depth 14', l.depth >= 14, `depth=${l.depth}`);
    chk('pv is non-empty', l.pv.length > 0, `pv=${l.pv.slice(0,4).join(' ')}`);
    chk('bestmove matches pv[0]', r.bestmove === l.pv[0], `${r.bestmove} vs ${l.pv[0]}`);
    console.log(`       (depth 14 took ${Date.now() - t}ms)`);
  }
  // 2. Mate in one must be reported as a mate score, not centipawns.
  {
    const r = await search(e, '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 12);
    const l = r.lines[0]!;
    chk('mate detected', l.mate !== null, `mate=${l.mate} cp=${l.cp}`);
    chk('mate in 1', l.mate === 1, `mate=${l.mate}`);
    chk('mating move is Ra8', r.bestmove === 'a1a8', r.bestmove);
  }
  // 3. Score sign is from the mover's POV: black to move and winning => positive cp.
  {
    const r = await search(e, '4k3/8/8/3q4/8/8/8/4K3 b - - 0 1', 12);
    chk('black-to-move winning reports positive cp', (r.lines[0]!.cp ?? 0) > 500, `cp=${r.lines[0]!.cp}`);
  }
  // 4. MultiPV returns distinct ranked lines.
  {
    const r = await search(e, 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1', 12, 3);
    chk('multipv returns 3 lines', r.lines.length === 3, `got ${r.lines.length}`);
    chk('multipv indices are 1..3', r.lines.map(l => l!.multipv).join(',') === '1,2,3');
    const firsts = new Set(r.lines.map(l => l!.pv[0]));
    chk('multipv first moves are distinct', firsts.size === 3, [...firsts].join(' '));
    const scores = r.lines.map(l => l!.cp ?? 0);
    chk('multipv is ranked best-first', scores[0] >= scores[1] && scores[1] >= scores[2], scores.join(' >= '));
  }
  // 5. Bound scores are skipped rather than mis-parsed.
  {
    chk('lowerbound ignored', parseInfo('info depth 5 multipv 1 score cp 30 lowerbound pv e2e4') === null);
    chk('no-pv line ignored', parseInfo('info depth 1 currmove e2e4 currmovenumber 1') === null);
    chk('mate line parsed', parseInfo('info depth 9 multipv 2 score mate -3 nodes 5 pv a1a8 g8h7')?.mate === -3);
  }
  e.quit();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
