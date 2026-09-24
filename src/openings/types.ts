import type { Color } from '../types';

export interface OpeningStep {
  /** Number of plies of the main line this step has explained. */
  upto: number;
  title: string;
  body: string;
}

export interface OpeningBranch {
  name: string;
  /** Full move list from the start, so it can be loaded directly. */
  moves: string[];
  idea: string;
}

export interface OpeningTrap {
  name: string;
  moves: string[];
  explain: string;
}

export type OpeningGroup = 'e4' | 'd4' | 'flank' | 'vs-e4' | 'vs-d4';

export interface Opening {
  id: string;
  name: string;
  eco: string;
  /** The side whose repertoire this course teaches. */
  side: Color;
  group: OpeningGroup;
  /** Main line in SAN from the initial position. */
  moves: string[];
  difficulty: 1 | 2 | 3;
  style: string[];
  summary: string;
  ideas: string[];
  plans: { you: string[]; them: string[] };
  steps: OpeningStep[];
  branches: OpeningBranch[];
  traps: OpeningTrap[];
}

export const GROUP_LABEL: Record<OpeningGroup, string> = {
  e4: 'White — 1.e4',
  d4: 'White — 1.d4',
  flank: 'White — flank openings',
  'vs-e4': 'Black — against 1.e4',
  'vs-d4': 'Black — against 1.d4',
};
