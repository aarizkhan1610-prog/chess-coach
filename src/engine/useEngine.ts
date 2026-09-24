import { useCallback, useEffect, useRef, useState } from 'react';
import { getEngine, type EngineStatus } from './uci';
import { AnalysisCancelled, analyseGame, type AnalyseOptions } from './analyze';
import type { AnalysedGame, Color, PositionAnalysis } from '../types';
import type { ParsedGame } from '../chess/pgn';
import { findOpening } from '../openings';

export function useEngineStatus(): { status: EngineStatus; error: string | null; boot: () => void } {
  const engine = getEngine();
  const [status, setStatus] = useState<EngineStatus>(engine.status);
  const [error, setError] = useState<string | null>(engine.lastError);

  useEffect(() => {
    engine.onStatus = (s) => {
      setStatus(s);
      setError(engine.lastError);
    };
    return () => {
      engine.onStatus = null;
    };
  }, [engine]);

  const boot = useCallback(() => {
    engine.boot().catch(() => setError(engine.lastError));
  }, [engine]);

  return { status, error, boot };
}

export interface BatchProgress {
  running: boolean;
  gameIndex: number;
  gameCount: number;
  gameLabel: string;
  positionsDone: number;
  positionsTotal: number;
  finished: AnalysedGame[];
  failures: { label: string; message: string }[];
}

const IDLE: BatchProgress = {
  running: false,
  gameIndex: 0,
  gameCount: 0,
  gameLabel: '',
  positionsDone: 0,
  positionsTotal: 0,
  finished: [],
  failures: [],
};

/**
 * Runs a batch of games through the engine, reporting progress per position.
 * The evaluation cache is shared across the batch, which makes re-analysing
 * games from the same opening noticeably faster.
 */
export function useBatchAnalysis() {
  const engine = getEngine();
  const [progress, setProgress] = useState<BatchProgress>(IDLE);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const cancel = useCallback(() => {
    cancelRef.current.cancelled = true;
    engine.stop();
  }, [engine]);

  const run = useCallback(
    async (jobs: { parsed: ParsedGame; hero: Color }[], depth: number): Promise<AnalysedGame[]> => {
      cancelRef.current = { cancelled: false };
      const cache = new Map<string, PositionAnalysis>();
      const totalPositions = jobs.reduce((n, j) => n + j.parsed.moves.length + 1, 0);
      let positionsBefore = 0;
      const finished: AnalysedGame[] = [];
      const failures: BatchProgress['failures'] = [];

      setProgress({
        ...IDLE,
        running: true,
        gameCount: jobs.length,
        positionsTotal: totalPositions,
      });

      for (let i = 0; i < jobs.length; i++) {
        const { parsed, hero } = jobs[i];
        const label = `${parsed.meta.white} vs ${parsed.meta.black}`;
        if (cancelRef.current.cancelled) break;

        setProgress((p) => ({ ...p, gameIndex: i, gameLabel: label }));
        const options: AnalyseOptions = {
          depth,
          multipv: 3,
          book: findOpening,
          cache,
          signal: cancelRef.current,
          onProgress: (done) =>
            setProgress((p) => ({ ...p, positionsDone: positionsBefore + done })),
        };
        try {
          const game = await analyseGame(engine, parsed, hero, options);
          finished.push(game);
          setProgress((p) => ({ ...p, finished: [...finished] }));
        } catch (err) {
          if (err instanceof AnalysisCancelled) break;
          failures.push({ label, message: err instanceof Error ? err.message : String(err) });
          setProgress((p) => ({ ...p, failures: [...failures] }));
        }
        positionsBefore += parsed.moves.length + 1;
      }

      setProgress((p) => ({ ...p, running: false, positionsDone: p.positionsTotal }));
      return finished;
    },
    [engine],
  );

  const reset = useCallback(() => setProgress(IDLE), []);

  return { progress, run, cancel, reset };
}

/** One-off evaluation, used by the puzzle trainer to accept good alternatives. */
export function useQuickEval() {
  const engine = getEngine();
  return useCallback(
    async (fen: string, depth = 12): Promise<PositionAnalysis | null> => {
      try {
        return await engine.analyse(fen, { depth, multipv: 1 });
      } catch {
        return null;
      }
    },
    [engine],
  );
}
