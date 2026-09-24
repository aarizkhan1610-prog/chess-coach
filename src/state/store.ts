import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AnalysedGame, AnalysisDepthPreset, MotifTag, Puzzle, PuzzleProgress } from '../types';
import { idbStorage } from './idb';
import { newProgress, review, updateSolverRating } from '../coach/srs';

export type PuzzleOutcome = 'first-try' | 'hinted' | 'failed';

export interface SessionRecord {
  mode: string;
  at: number;
  solved: number;
  attempted: number;
  best: number;
}

export interface Settings {
  playerName: string;
  depth: AnalysisDepthPreset;
  theme: 'dark' | 'light';
  /** Orient the board to the side you played. */
  autoOrient: boolean;
  /** Include puzzles built from the opponent's blunders. */
  includePunishPuzzles: boolean;
}

interface AppState {
  settings: Settings;
  games: Record<string, AnalysedGame>;
  /** Newest first. */
  gameOrder: string[];
  progress: Record<string, PuzzleProgress>;
  solverRating: number;
  /** motif tag -> highest step index reached */
  lessonStep: Record<string, number>;
  /** motif tag -> completed */
  lessonDone: Record<string, boolean>;
  /** opening id -> furthest lesson step */
  openingStep: Record<string, number>;
  openingQuizBest: Record<string, number>;
  sessions: SessionRecord[];
  totals: { attempted: number; solved: number; bestStreak: number };

  setSettings: (patch: Partial<Settings>) => void;
  addGames: (games: AnalysedGame[]) => void;
  removeGame: (id: string) => void;
  clearGames: () => void;
  setHero: (id: string, hero: 'w' | 'b') => void;
  recordPuzzle: (puzzle: Puzzle, outcome: PuzzleOutcome) => void;
  setLessonStep: (tag: MotifTag, step: number) => void;
  markLessonDone: (tag: MotifTag, done: boolean) => void;
  setOpeningStep: (id: string, step: number) => void;
  setOpeningQuizBest: (id: string, score: number) => void;
  addSession: (s: SessionRecord) => void;
}

const DEFAULT_SETTINGS: Settings = {
  playerName: '',
  depth: 'balanced',
  theme: 'dark',
  autoOrient: true,
  includePunishPuzzles: true,
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      games: {},
      gameOrder: [],
      progress: {},
      solverRating: 1200,
      lessonStep: {},
      lessonDone: {},
      openingStep: {},
      openingQuizBest: {},
      sessions: [],
      totals: { attempted: 0, solved: 0, bestStreak: 0 },

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addGames: (incoming) =>
        set((s) => {
          const games = { ...s.games };
          // Newly analysed games replace any earlier analysis of the same game.
          const added: string[] = [];
          for (const g of incoming) {
            if (!games[g.id]) added.push(g.id);
            games[g.id] = g;
          }
          return { games, gameOrder: [...added.reverse(), ...s.gameOrder] };
        }),

      removeGame: (id) =>
        set((s) => {
          const games = { ...s.games };
          delete games[id];
          return { games, gameOrder: s.gameOrder.filter((g) => g !== id) };
        }),

      clearGames: () => set({ games: {}, gameOrder: [] }),

      setHero: (id, hero) =>
        set((s) => (s.games[id] ? { games: { ...s.games, [id]: { ...s.games[id], hero } } } : {})),

      recordPuzzle: (puzzle, outcome) =>
        set((s) => {
          const prev = s.progress[puzzle.id] ?? newProgress(puzzle.id);
          const solved = outcome === 'first-try';
          return {
            progress: { ...s.progress, [puzzle.id]: review(prev, outcome) },
            solverRating: updateSolverRating(s.solverRating, puzzle.rating, solved),
            totals: {
              ...s.totals,
              attempted: s.totals.attempted + 1,
              solved: s.totals.solved + (solved ? 1 : 0),
            },
          };
        }),

      setLessonStep: (tag, step) =>
        set((s) => ({ lessonStep: { ...s.lessonStep, [tag]: Math.max(step, s.lessonStep[tag] ?? 0) } })),

      markLessonDone: (tag, done) => set((s) => ({ lessonDone: { ...s.lessonDone, [tag]: done } })),

      setOpeningStep: (id, step) =>
        set((s) => ({ openingStep: { ...s.openingStep, [id]: Math.max(step, s.openingStep[id] ?? 0) } })),

      setOpeningQuizBest: (id, score) =>
        set((s) => ({ openingQuizBest: { ...s.openingQuizBest, [id]: Math.max(score, s.openingQuizBest[id] ?? 0) } })),

      addSession: (record) =>
        set((s) => ({
          sessions: [record, ...s.sessions].slice(0, 60),
          totals: { ...s.totals, bestStreak: Math.max(s.totals.bestStreak, record.best) },
        })),
    }),
    {
      name: 'chess-coach-v1',
      storage: createJSONStorage(() => idbStorage),
      version: 1,
    },
  ),
);

/**
 * Games, newest first.
 *
 * The result must be memoised: it feeds `buildProfile`, which feeds the puzzle
 * pool and the session queue. Returning a fresh array each render invalidates
 * that whole chain every render, which rebuilds the puzzle queue underneath the
 * solver. Both `games` and `gameOrder` are stable store references, so this
 * recomputes only when something actually changed.
 */
export function useGames(): AnalysedGame[] {
  const games = useStore((s) => s.games);
  const order = useStore((s) => s.gameOrder);
  return useMemo(() => order.map((id) => games[id]).filter(Boolean), [games, order]);
}

/**
 * True once the persisted state has been read back from IndexedDB.
 *
 * `persist.hasHydrated()` is a plain function rather than reactive state, so it
 * has to be paired with the onFinishHydration subscription to re-render.
 */
export function useHydrated(): boolean {
  const [ready, setReady] = useState(() => useStore.persist.hasHydrated());
  useEffect(() => {
    if (ready) return;
    const unsub = useStore.persist.onFinishHydration(() => setReady(true));
    // Hydration can finish between the initial render and this effect.
    if (useStore.persist.hasHydrated()) setReady(true);
    return unsub;
  }, [ready]);
  return ready;
}
