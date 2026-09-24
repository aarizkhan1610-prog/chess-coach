import type { Color, MotifTag } from '../types';

export type LessonStep =
  | { kind: 'read'; heading: string; body: string[] }
  | { kind: 'checklist'; heading: string; items: string[] }
  | {
      kind: 'position';
      heading: string;
      fen: string;
      /** What the learner is asked to find. */
      prompt: string;
      /** SAN line; the first move is the answer. */
      solution: string[];
      explain: string;
      orientation?: Color;
    }
  | { kind: 'drill'; heading: string; body: string; tags: MotifTag[]; count: number }
  | { kind: 'yours'; heading: string; body: string };

export interface Lesson {
  tag: MotifTag;
  title: string;
  /** One line shown in the lesson list. */
  oneLiner: string;
  estMinutes: number;
  /** Why this habit costs games. */
  why: string;
  steps: LessonStep[];
}
