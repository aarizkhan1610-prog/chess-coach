import { WHITE_OPENINGS } from './white';
import { BLACK_OPENINGS } from './black';
import type { Opening, OpeningGroup } from './types';

export * from './types';
export const ALL_OPENINGS: Opening[] = [...WHITE_OPENINGS, ...BLACK_OPENINGS];

export function openingById(id: string): Opening | undefined {
  return ALL_OPENINGS.find((o) => o.id === id);
}

export function openingsByGroup(): { group: OpeningGroup; openings: Opening[] }[] {
  const groups: OpeningGroup[] = ['e4', 'd4', 'flank', 'vs-e4', 'vs-d4'];
  return groups.map((group) => ({ group, openings: ALL_OPENINGS.filter((o) => o.group === group) }));
}

/**
 * Short, well-known move sequences used to name games that do not reach one of
 * the full courses. Longest match wins, so these only apply as a fallback.
 */
const FAMILIES: { moves: string[]; name: string; eco: string }[] = [
  { moves: ['e4'], name: "King's Pawn Opening", eco: 'B00' },
  { moves: ['e4', 'e5'], name: 'Open Game', eco: 'C20' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6'], name: 'Open Game: Knights', eco: 'C44' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], name: 'Two Knights Defence', eco: 'C55' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3'], name: 'Four Knights Game', eco: 'C46' },
  { moves: ['e4', 'e5', 'Bc4'], name: "Bishop's Opening", eco: 'C23' },
  { moves: ['e4', 'c5'], name: 'Sicilian Defence', eco: 'B20' },
  { moves: ['e4', 'c5', 'Nf3', 'e6'], name: 'Sicilian: Kan / Taimanov', eco: 'B40' },
  { moves: ['e4', 'c5', 'Nf3', 'Nc6', 'Bb5'], name: 'Sicilian: Rossolimo', eco: 'B30' },
  { moves: ['e4', 'c5', 'Nf3', 'd6', 'Bb5+'], name: 'Sicilian: Moscow', eco: 'B51' },
  { moves: ['e4', 'c5', 'Nc3'], name: 'Sicilian: Closed', eco: 'B23' },
  { moves: ['e4', 'c5', 'c3'], name: 'Sicilian: Alapin', eco: 'B22' },
  { moves: ['e4', 'c5', 'd4'], name: 'Sicilian: Smith-Morra', eco: 'B21' },
  { moves: ['e4', 'e6'], name: 'French Defence', eco: 'C00' },
  { moves: ['e4', 'c6'], name: 'Caro-Kann Defence', eco: 'B10' },
  { moves: ['e4', 'd5'], name: 'Scandinavian Defence', eco: 'B01' },
  { moves: ['e4', 'd6'], name: 'Pirc Defence', eco: 'B07' },
  { moves: ['e4', 'g6'], name: 'Modern Defence', eco: 'B06' },
  { moves: ['e4', 'Nf6'], name: "Alekhine's Defence", eco: 'B02' },
  { moves: ['e4', 'e5', 'f4'], name: "King's Gambit", eco: 'C30' },
  { moves: ['d4'], name: "Queen's Pawn Opening", eco: 'A40' },
  { moves: ['d4', 'd5'], name: 'Closed Game', eco: 'D00' },
  { moves: ['d4', 'd5', 'c4'], name: "Queen's Gambit", eco: 'D06' },
  { moves: ['d4', 'd5', 'c4', 'dxc4'], name: "Queen's Gambit Accepted", eco: 'D20' },
  { moves: ['d4', 'Nf6'], name: 'Indian Defence', eco: 'A45' },
  { moves: ['d4', 'Nf6', 'c4', 'e6'], name: 'Indian: East Indian', eco: 'E00' },
  { moves: ['d4', 'Nf6', 'c4', 'g6'], name: "Indian: King's Indian setup", eco: 'E60' },
  { moves: ['d4', 'f5'], name: 'Dutch Defence', eco: 'A80' },
  { moves: ['d4', 'e6'], name: 'Queen\'s Pawn: Horwitz', eco: 'A40' },
  { moves: ['d4', 'g6'], name: 'Modern Defence', eco: 'A40' },
  { moves: ['d4', 'c5'], name: 'Old Benoni', eco: 'A43' },
  { moves: ['c4'], name: 'English Opening', eco: 'A10' },
  { moves: ['Nf3'], name: 'Réti / Zukertort Opening', eco: 'A04' },
  { moves: ['g3'], name: "Benko's Opening", eco: 'A00' },
  { moves: ['b3'], name: 'Nimzo-Larsen Attack', eco: 'A01' },
  { moves: ['f4'], name: "Bird's Opening", eco: 'A02' },
  { moves: ['e4', 'e5', 'Nf3', 'Nf6'], name: 'Petrov Defence', eco: 'C42' },
];

interface BookEntry {
  id: string;
  name: string;
  plies: number;
}

/** key = SAN moves joined by spaces */
const BOOK = new Map<string, BookEntry>();

function addLine(id: string, name: string, moves: string[]) {
  for (let n = 1; n <= moves.length; n++) {
    const key = moves.slice(0, n).join(' ');
    const existing = BOOK.get(key);
    // A longer, more specific line should win the exact-key contest only when
    // this key IS its full line; otherwise keep the first (shorter) name.
    if (!existing || (n === moves.length && existing.plies < n)) {
      BOOK.set(key, { id, name, plies: n });
    }
  }
}

for (const f of FAMILIES) addLine(`family:${f.name}`, f.name, f.moves);
for (const o of ALL_OPENINGS) {
  addLine(o.id, o.name, o.moves);
  for (const b of o.branches) addLine(o.id, `${o.name}: ${b.name}`, b.moves);
}

export interface BookMatch {
  id: string;
  name: string;
  bookPlies: number;
}

/** Longest known prefix of a game's move list. */
export function findOpening(sans: string[]): BookMatch | null {
  let best: BookMatch | null = null;
  const limit = Math.min(sans.length, 24);
  for (let n = 1; n <= limit; n++) {
    const hit = BOOK.get(sans.slice(0, n).join(' '));
    if (hit) best = { id: hit.id, name: hit.name, bookPlies: n };
  }
  return best;
}

/** Courses whose main line or branches start with the moves played so far. */
export function coursesMatching(sans: string[]): Opening[] {
  if (!sans.length) return [];
  return ALL_OPENINGS.filter((o) => {
    const lines = [o.moves, ...o.branches.map((b) => b.moves)];
    return lines.some((line) => sans.every((s, i) => line[i] === s));
  });
}

/* ------------------------------------------------------------------ *
 * First repertoire
 * ------------------------------------------------------------------ */

export interface StarterSlot {
  /** The gap this slot fills in a repertoire. */
  role: string;
  question: string;
  picks: { id: string; why: string }[];
}

/**
 * A complete repertoire needs three decisions: what you open with, and an
 * answer to each of the two main first moves. These are the low-theory
 * choices for each — openings you can play on understanding rather than
 * memorisation, which is what a first repertoire should be.
 */
export const FIRST_REPERTOIRE: StarterSlot[] = [
  {
    role: 'As White',
    question: 'What do you open with?',
    picks: [
      { id: 'london', why: 'One setup you can play against almost anything. The least memorisation of any opening here.' },
      { id: 'italian', why: 'The classical choice: natural moves, real plans, and it teaches you how to attack.' },
    ],
  },
  {
    role: 'Against 1.e4',
    question: 'What do you answer 1.e4 with?',
    picks: [
      { id: 'scandinavian', why: 'The fastest Black repertoire to learn — you trade off the centre on move two and no piece ends up stuck.' },
      { id: 'caro-kann', why: 'Rock solid, with none of the bad-bishop problems of the French. Harder to crack, slightly more to learn.' },
    ],
  },
  {
    role: 'Against 1.d4',
    question: 'What do you answer 1.d4 with?',
    picks: [
      { id: 'qgd', why: 'The most respectable answer there is. Hard to go wrong, and the plans repeat every game.' },
      { id: 'slav', why: 'The same solidity, but your light-squared bishop gets out first. A little sharper.' },
    ],
  },
];

export function firstRepertoire(): { role: string; question: string; picks: { opening: Opening; why: string }[] }[] {
  return FIRST_REPERTOIRE.map((slot) => ({
    role: slot.role,
    question: slot.question,
    picks: slot.picks.flatMap((pick) => {
      const opening = openingById(pick.id);
      return opening ? [{ opening, why: pick.why }] : [];
    }),
  }));
}
