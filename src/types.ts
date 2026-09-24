export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Square = string;

/** Engine evaluation, always normalised to WHITE's point of view. */
export interface Evaluation {
  /** Centipawns, white-positive. Null when the line is a forced mate. */
  cp: number | null;
  /** Moves-to-mate, white-positive (+3 = white mates in 3, -2 = white gets mated in 2). */
  mate: number | null;
}

export interface EngineLine {
  multipv: number;
  depth: number;
  evaluation: Evaluation;
  /** Principal variation in UCI long-algebraic form (e2e4, e7e8q). */
  pv: string[];
}

export interface PositionAnalysis {
  fen: string;
  depth: number;
  lines: EngineLine[];
  /** Search depth at which the best move stopped changing — a difficulty signal. */
  stableFromDepth: number;
}

/* ------------------------------------------------------------------ *
 * Motifs: the "why" behind a mistake. Each tag maps 1:1 to a lesson.
 * ------------------------------------------------------------------ */

export const MOTIF_TAGS = [
  // Tactical oversights
  'hanging-piece',
  'moved-into-attack',
  'missed-material',
  'allowed-fork',
  'missed-fork',
  'allowed-pin',
  'missed-pin',
  'allowed-skewer',
  'discovered-attack',
  'trapped-piece',
  'back-rank',
  'missed-mate',
  'allowed-mate',
  'ignored-threat',
  'unsound-sacrifice',
  // Positional / strategic
  'king-safety',
  'pawn-structure',
  'development',
  'premature-queen',
  'bad-trade',
  'weak-square',
  'lost-the-initiative',
  // Meta / phase
  'converting-advantage',
  'defending-worse',
  'endgame-technique',
  'time-trouble',
] as const;

export type MotifTag = (typeof MOTIF_TAGS)[number];

export interface MotifMeta {
  tag: MotifTag;
  label: string;
  short: string;
  family: 'tactics' | 'strategy' | 'phase';
}

export const MOTIF_META: Record<MotifTag, MotifMeta> = {
  'hanging-piece':        { tag: 'hanging-piece',        label: 'Leaving pieces undefended',   short: 'Hanging pieces',      family: 'tactics' },
  'moved-into-attack':    { tag: 'moved-into-attack',    label: 'Moving a piece to an attacked square', short: 'Moved into attack', family: 'tactics' },
  'missed-material':      { tag: 'missed-material',      label: 'Missing free material',        short: 'Missed material',     family: 'tactics' },
  'allowed-fork':         { tag: 'allowed-fork',         label: 'Allowing forks',               short: 'Allowed fork',        family: 'tactics' },
  'missed-fork':          { tag: 'missed-fork',          label: 'Missing your own forks',        short: 'Missed fork',         family: 'tactics' },
  'allowed-pin':          { tag: 'allowed-pin',          label: 'Walking into pins',            short: 'Allowed pin',         family: 'tactics' },
  'missed-pin':           { tag: 'missed-pin',           label: 'Missing pins',                 short: 'Missed pin',          family: 'tactics' },
  'allowed-skewer':       { tag: 'allowed-skewer',       label: 'Allowing skewers',             short: 'Allowed skewer',      family: 'tactics' },
  'discovered-attack':    { tag: 'discovered-attack',    label: 'Discovered attacks',           short: 'Discovery',           family: 'tactics' },
  'trapped-piece':        { tag: 'trapped-piece',        label: 'Letting pieces get trapped',   short: 'Trapped piece',       family: 'tactics' },
  'back-rank':            { tag: 'back-rank',            label: 'Back-rank weakness',           short: 'Back rank',           family: 'tactics' },
  'missed-mate':          { tag: 'missed-mate',          label: 'Missing forced mates',         short: 'Missed mate',         family: 'tactics' },
  'allowed-mate':         { tag: 'allowed-mate',         label: 'Allowing forced mates',        short: 'Allowed mate',        family: 'tactics' },
  'ignored-threat':       { tag: 'ignored-threat',       label: "Ignoring the opponent's threat", short: 'Ignored threat',    family: 'tactics' },
  'unsound-sacrifice':    { tag: 'unsound-sacrifice',    label: 'Unsound sacrifices',           short: 'Bad sacrifice',       family: 'tactics' },
  'king-safety':          { tag: 'king-safety',          label: 'King safety',                  short: 'King safety',         family: 'strategy' },
  'pawn-structure':       { tag: 'pawn-structure',       label: 'Damaging your pawn structure', short: 'Pawn structure',      family: 'strategy' },
  'development':          { tag: 'development',          label: 'Slow development',             short: 'Development',         family: 'strategy' },
  'premature-queen':      { tag: 'premature-queen',      label: 'Early queen sorties',          short: 'Early queen',         family: 'strategy' },
  'bad-trade':            { tag: 'bad-trade',            label: 'Trading the wrong pieces',     short: 'Bad trade',           family: 'strategy' },
  'weak-square':          { tag: 'weak-square',          label: 'Conceding weak squares',       short: 'Weak squares',        family: 'strategy' },
  'lost-the-initiative':  { tag: 'lost-the-initiative',  label: 'Passive play / losing the initiative', short: 'Initiative',  family: 'strategy' },
  'converting-advantage': { tag: 'converting-advantage', label: 'Converting winning positions', short: 'Converting',          family: 'phase' },
  'defending-worse':      { tag: 'defending-worse',      label: 'Defending worse positions',    short: 'Defending',           family: 'phase' },
  'endgame-technique':    { tag: 'endgame-technique',    label: 'Endgame technique',            short: 'Endgames',            family: 'phase' },
  'time-trouble':         { tag: 'time-trouble',         label: 'Time trouble',                 short: 'Time trouble',        family: 'phase' },
};

export type Phase = 'opening' | 'middlegame' | 'endgame';

export type MoveVerdict =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'forced';

export interface AnalysedMove {
  ply: number;               // 0-based index into the move list
  moveNumber: number;        // 1-based chess move number
  color: Color;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  /** Eval of fenBefore (white POV). */
  evalBefore: Evaluation;
  /** Eval of fenAfter (white POV). */
  evalAfter: Evaluation;
  /** Win-probability points lost by the mover, 0..100. */
  winLoss: number;
  /** Per-move accuracy, 0..100. */
  accuracy: number;
  verdict: MoveVerdict;
  /** Engine's preferred move at fenBefore, in SAN. */
  bestSan: string | null;
  /** Engine's preferred line at fenBefore, in SAN. */
  bestLineSan: string[];
  /** Engine's preferred line at fenBefore, in UCI — replayable for puzzles. */
  bestLineUci: string[];
  /** How the opponent could have punished this move, in SAN. */
  refutationSan: string[];
  /** How the opponent could have punished this move, in UCI. */
  refutationUci: string[];
  /** Win% the second-best move would have kept, relative to the best. */
  secondBestWinLoss: number | null;
  /** Other moves that were about as good (SAN) — used to accept alternates in puzzles. */
  alternativesSan: string[];
  phase: Phase;
  motifs: MotifTag[];
  /** Seconds spent on this move, when the PGN carries clock data. */
  secondsSpent: number | null;
  stableFromDepth: number;
}

export interface GameMeta {
  white: string;
  black: string;
  result: string;
  date: string | null;
  event: string | null;
  whiteElo: number | null;
  blackElo: number | null;
  timeControl: string | null;
  eco: string | null;
  termination: string | null;
}

export interface AnalysedGame {
  id: string;
  meta: GameMeta;
  /** Which side the app treats as "you". */
  hero: Color;
  moves: AnalysedMove[];
  /** Detected opening from the built-in book. */
  openingId: string | null;
  openingName: string | null;
  /** Ply at which the game left the book. */
  bookPlies: number;
  accuracy: { w: number; b: number };
  accuracyByPhase: Record<Phase, { w: number; b: number }>;
  counts: Record<Color, Record<MoveVerdict, number>>;
  depth: number;
  analysedAt: number;
  startingFen: string;
}

/* ------------------------------------------------------------------ *
 * Puzzles
 * ------------------------------------------------------------------ */

export type PuzzleOrigin = 'your-miss' | 'punish' | 'starter';

export interface Puzzle {
  id: string;
  fen: string;
  /** Side the solver plays. */
  solverColor: Color;
  /** Full solution in SAN, alternating solver / opponent. */
  solution: string[];
  /** Acceptable first moves (SAN) besides solution[0]. */
  alternates: string[];
  tags: MotifTag[];
  rating: number;
  origin: PuzzleOrigin;
  gameId: string | null;
  ply: number | null;
  /** One-line framing shown above the board. */
  prompt: string;
  /** Shown after solving. */
  explanation: string;
}

export interface PuzzleProgress {
  puzzleId: string;
  /** SM-2 style ease factor. */
  ease: number;
  /** Interval in days. */
  interval: number;
  dueAt: number;
  attempts: number;
  solvedFirstTry: number;
  lapses: number;
  lastSeen: number;
}

export interface WeaknessStat {
  tag: MotifTag;
  occurrences: number;
  gamesAffected: number;
  /** Total win-probability points lost to this motif. */
  winLoss: number;
  perGame: number;
  /** Share of all identified loss, 0..100. */
  share: number;
  /** 0..100 composite priority. */
  severity: number;
  /** Positive = getting worse recently. */
  trend: number;
  examples: { gameId: string; ply: number }[];
}

export interface Profile {
  games: number;
  moves: number;
  accuracy: number;
  accuracyByPhase: Record<Phase, number>;
  verdicts: Record<MoveVerdict, number>;
  weaknesses: WeaknessStat[];
  /** Accuracy of the last 5 games vs the 5 before that. */
  momentum: number | null;
  openingRecord: {
    openingId: string;
    name: string;
    games: number;
    score: number;
    accuracy: number;
  }[];
}

export type AnalysisDepthPreset = 'fast' | 'balanced' | 'deep';

export const DEPTH_PRESETS: Record<AnalysisDepthPreset, { depth: number; label: string; note: string }> = {
  fast:     { depth: 10, label: 'Fast',     note: '~5s per game — good enough to catch blunders' },
  balanced: { depth: 14, label: 'Balanced', note: '~25s per game — catches most real mistakes' },
  deep:     { depth: 18, label: 'Deep',     note: '~2min per game — finds subtle errors too' },
};
