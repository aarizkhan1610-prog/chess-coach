import type { EngineLine, Evaluation, PositionAnalysis } from '../types';

const ENGINE_FILE = 'engine/stockfish-19-lite-single.js';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'searching' | 'error';

export interface AnalyseOptions {
  depth?: number;
  movetime?: number;
  multipv?: number;
}

/** Parse one `info ...` line into a partial engine line, or null if unusable. */
export function parseInfo(line: string): { multipv: number; depth: number; cp: number | null; mate: number | null; pv: string[] } | null {
  if (!line.startsWith('info ')) return null;
  // Bound scores are provisional and would produce flickering evaluations.
  if (line.includes('lowerbound') || line.includes('upperbound')) return null;
  const pvAt = line.indexOf(' pv ');
  if (pvAt === -1) return null;

  const tokens = line.slice(0, pvAt).split(/\s+/);
  let depth = 0;
  let multipv = 1;
  let cp: number | null = null;
  let mate: number | null = null;

  for (let i = 0; i < tokens.length; i++) {
    switch (tokens[i]) {
      case 'depth':
        depth = Number(tokens[++i]);
        break;
      case 'multipv':
        multipv = Number(tokens[++i]);
        break;
      case 'score':
        if (tokens[i + 1] === 'cp') { cp = Number(tokens[i + 2]); i += 2; }
        else if (tokens[i + 1] === 'mate') { mate = Number(tokens[i + 2]); i += 2; }
        break;
    }
  }
  if (cp === null && mate === null) return null;
  const pv = line.slice(pvAt + 4).trim().split(/\s+/).filter(Boolean);
  if (!pv.length) return null;
  return { multipv, depth, cp, mate, pv };
}

/** UCI reports scores from the mover's point of view; we store white-positive. */
function toWhitePov(cp: number | null, mate: number | null, turn: string): Evaluation {
  const sign = turn === 'w' ? 1 : -1;
  return {
    cp: cp === null ? null : cp * sign,
    mate: mate === null ? null : mate * sign,
  };
}

/**
 * Thin promise wrapper around the Stockfish WASM worker.
 *
 * Every search is pushed through a single queue: the engine is one process and
 * UCI has no request ids, so overlapping searches would interleave their
 * `info` lines and corrupt both results.
 */
export class Engine {
  private worker: Worker | null = null;
  private listeners = new Set<(line: string) => void>();
  private chain: Promise<unknown> = Promise.resolve();
  private multipv = 0;
  private booted: Promise<void> | null = null;
  private cancelled = false;

  status: EngineStatus = 'idle';
  onStatus: ((s: EngineStatus) => void) | null = null;
  lastError: string | null = null;

  private setStatus(s: EngineStatus) {
    this.status = s;
    this.onStatus?.(s);
  }

  /** Boots the worker and completes the UCI handshake. Safe to call repeatedly. */
  boot(): Promise<void> {
    if (this.booted) return this.booted;
    this.setStatus('loading');
    this.booted = new Promise<void>((resolve, reject) => {
      let worker: Worker;
      try {
        const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
        worker = new Worker(`${base}${ENGINE_FILE}`);
      } catch (err) {
        this.lastError = `Could not start the engine worker: ${String(err)}`;
        this.setStatus('error');
        reject(new Error(this.lastError));
        return;
      }
      this.worker = worker;

      const timer = setTimeout(() => {
        this.lastError = 'The engine did not respond within 30 seconds.';
        this.setStatus('error');
        reject(new Error(this.lastError));
      }, 30_000);

      worker.onerror = (e) => {
        clearTimeout(timer);
        this.lastError = `Engine error: ${e.message || 'unknown'}`;
        this.setStatus('error');
        reject(new Error(this.lastError));
      };
      worker.onmessage = (e: MessageEvent) => {
        const data = typeof e.data === 'string' ? e.data : String(e.data ?? '');
        for (const listener of this.listeners) listener(data);
      };

      const onLine = (line: string) => {
        if (line.trim() === 'uciok') {
          this.send('setoption name Hash value 64');
          this.send('isready');
        } else if (line.trim() === 'readyok') {
          this.listeners.delete(onLine);
          clearTimeout(timer);
          this.setStatus('ready');
          resolve();
        }
      };
      this.listeners.add(onLine);
      this.send('uci');
    });
    return this.booted;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  /** Run `fn` only once every previously queued search has finished. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    // Keep the chain alive even when a link rejects.
    this.chain = run.catch(() => undefined);
    return run;
  }

  async analyse(fen: string, opts: AnalyseOptions = {}): Promise<PositionAnalysis> {
    await this.boot();
    return this.enqueue(() => this.runSearch(fen, opts));
  }

  private runSearch(fen: string, opts: AnalyseOptions): Promise<PositionAnalysis> {
    const wantMultipv = Math.max(1, opts.multipv ?? 1);
    const turn = fen.split(' ')[1] ?? 'w';

    return new Promise<PositionAnalysis>((resolve, reject) => {
      const best = new Map<number, EngineLine>();
      let deepest = 0;
      let lastTopMove: string | null = null;
      let stableFromDepth = 0;

      const finish = (ok: boolean, reason?: string) => {
        clearTimeout(timer);
        this.listeners.delete(onLine);
        if (this.status === 'searching') this.setStatus('ready');
        if (!ok) { reject(new Error(reason ?? 'search failed')); return; }
        const lines = [...best.values()].sort((a, b) => a.multipv - b.multipv);
        resolve({ fen, depth: deepest, lines, stableFromDepth: stableFromDepth || deepest });
      };

      const budget = (opts.movetime ?? 0) + (opts.depth ?? 12) * 4000 + 20_000;
      const timer = setTimeout(() => {
        this.send('stop');
        // Give the engine a moment to emit bestmove before giving up.
        setTimeout(() => (best.size ? finish(true) : finish(false, 'engine search timed out')), 1500);
      }, budget);

      const onLine = (raw: string) => {
        const line = raw.trim();
        if (line.startsWith('info ')) {
          const info = parseInfo(line);
          if (!info) return;
          if (info.multipv > wantMultipv) return;
          const prev = best.get(info.multipv);
          if (!prev || info.depth >= prev.depth) {
            best.set(info.multipv, {
              multipv: info.multipv,
              depth: info.depth,
              evaluation: toWhitePov(info.cp, info.mate, turn),
              pv: info.pv,
            });
          }
          if (info.multipv === 1) {
            deepest = Math.max(deepest, info.depth);
            if (info.pv[0] !== lastTopMove) {
              lastTopMove = info.pv[0];
              stableFromDepth = info.depth;
            }
          }
          return;
        }
        if (line.startsWith('bestmove')) {
          const mv = line.split(/\s+/)[1];
          if (mv === '(none)') { finish(true); return; }
          // A terminal position emits bestmove with no preceding info line.
          finish(true);
        }
      };

      this.listeners.add(onLine);
      this.setStatus('searching');

      if (this.multipv !== wantMultipv) {
        this.send(`setoption name MultiPV value ${wantMultipv}`);
        this.multipv = wantMultipv;
      }
      this.send('ucinewgame');
      this.send(`position fen ${fen}`);
      if (opts.movetime) this.send(`go movetime ${opts.movetime}`);
      else this.send(`go depth ${opts.depth ?? 12}`);
    });
  }

  /** Ask the current search to return its best line early. */
  stop() {
    this.send('stop');
  }

  cancel() {
    this.cancelled = true;
    this.stop();
  }

  resetCancel() {
    this.cancelled = false;
  }

  get isCancelled() {
    return this.cancelled;
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.booted = null;
    this.listeners.clear();
    this.multipv = 0;
    this.setStatus('idle');
  }
}

/** One engine per tab. WASM Stockfish is heavy; there is no reason for two. */
let shared: Engine | null = null;
export function getEngine(): Engine {
  if (!shared) shared = new Engine();
  return shared;
}
