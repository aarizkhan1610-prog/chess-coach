import { Chess } from 'chess.js';
import type { Color, GameMeta } from '../types';

export interface ParsedMove {
  san: string;
  uci: string;
  color: Color;
  moveNumber: number;
  fenBefore: string;
  fenAfter: string;
  /** Clock reading after the move, in seconds, when the PGN carries one. */
  clockSeconds: number | null;
}

export interface ParsedGame {
  id: string;
  meta: GameMeta;
  startingFen: string;
  moves: ParsedMove[];
  /** Base time and increment in seconds, parsed from the TimeControl header. */
  timeControl: { base: number; increment: number } | null;
}

export interface ParseResult {
  games: ParsedGame[];
  errors: { index: number; message: string; excerpt: string }[];
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** FNV-1a — short, stable ids so re-importing the same game does not duplicate it. */
function hashId(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

/**
 * Split a file that may hold many games. A new game starts at an `[Event ...]`
 * tag that follows movetext, which is how the PGN spec delimits them in practice.
 */
export function splitGames(text: string): string[] {
  const normalised = text.replace(/\r\n?/g, '\n');
  const lines = normalised.split('\n');
  const chunks: string[] = [];
  let current: string[] = [];
  let sawMovetext = false;

  for (const line of lines) {
    const isTag = /^\s*\[\s*\w+\s+"/.test(line);
    if (isTag && sawMovetext && current.some((l) => l.trim())) {
      chunks.push(current.join('\n'));
      current = [];
      sawMovetext = false;
    }
    if (!isTag && line.trim()) sawMovetext = true;
    current.push(line);
  }
  if (current.some((l) => l.trim())) chunks.push(current.join('\n'));
  return chunks.filter((c) => /\[\s*\w+\s+"/.test(c) || /\d+\s*\./.test(c));
}

function readHeaders(chunk: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const re = /\[\s*(\w+)\s+"([^"]*)"\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk))) headers[m[1]] = m[2];
  return headers;
}

/** Remove recursive annotation variations, which chess.js cannot consume. */
function stripVariations(movetext: string): string {
  let out = '';
  let depth = 0;
  for (const ch of movetext) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

function parseClock(comment: string): number | null {
  const m = /\[%(?:clk|emt)\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/.exec(comment);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  const short = /\[%(?:clk|emt)\s+(\d+):(\d+(?:\.\d+)?)\]/.exec(comment);
  if (short) return Number(short[1]) * 60 + Number(short[2]);
  return null;
}

export function parseTimeControl(tc: string | undefined): { base: number; increment: number } | null {
  if (!tc || tc === '-' || tc === '?') return null;
  const m = /^(\d+)(?:\+(\d+))?/.exec(tc.trim());
  if (!m) return null;
  return { base: Number(m[1]), increment: Number(m[2] ?? 0) };
}

function toInt(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseGame(chunk: string): ParsedGame {
  const headers = readHeaders(chunk);
  const movetext = stripVariations(chunk.replace(/\[\s*\w+\s+"[^"]*"\s*\]/g, ''));

  const startingFen = headers.FEN && headers.SetUp !== '0' ? headers.FEN : START_FEN;
  const game = new Chess(startingFen);
  game.loadPgn(`${Object.entries(headers).map(([k, v]) => `[${k} "${v}"]`).join('\n')}\n\n${movetext}`);

  // Map the position after each move to its trailing comment, for clock data.
  const commentByFen = new Map<string, string>();
  for (const c of game.getComments()) commentByFen.set(c.fen, c.comment);

  const history = game.history({ verbose: true });
  const moves: ParsedMove[] = history.map((m, i) => ({
    san: m.san,
    uci: `${m.from}${m.to}${m.promotion ?? ''}`,
    color: m.color as Color,
    moveNumber: Math.floor(i / 2) + 1,
    fenBefore: m.before,
    fenAfter: m.after,
    clockSeconds: parseClock(commentByFen.get(m.after) ?? ''),
  }));

  const meta: GameMeta = {
    white: headers.White || 'White',
    black: headers.Black || 'Black',
    result: headers.Result || '*',
    date: headers.UTCDate || headers.Date || null,
    event: headers.Event || null,
    whiteElo: toInt(headers.WhiteElo),
    blackElo: toInt(headers.BlackElo),
    timeControl: headers.TimeControl || null,
    eco: headers.ECO || null,
    termination: headers.Termination || null,
  };

  const id = hashId(`${meta.white}|${meta.black}|${meta.date}|${moves.map((m) => m.san).join(' ')}`);
  return { id, meta, startingFen, moves, timeControl: parseTimeControl(headers.TimeControl) };
}

export function parsePgn(text: string): ParseResult {
  const games: ParsedGame[] = [];
  const errors: ParseResult['errors'] = [];
  const chunks = splitGames(text);

  chunks.forEach((chunk, index) => {
    try {
      const g = parseGame(chunk);
      if (!g.moves.length) throw new Error('no moves found');
      games.push(g);
    } catch (err) {
      errors.push({
        index,
        message: err instanceof Error ? err.message : String(err),
        excerpt: chunk.trim().slice(0, 120).replace(/\s+/g, ' '),
      });
    }
  });

  // Drop duplicates within one paste.
  const seen = new Set<string>();
  const unique = games.filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
  return { games: unique, errors };
}

/**
 * Seconds spent on each move, derived from the clock readings.
 * Returns nulls when the PGN has no clock data.
 */
export function moveTimes(game: ParsedGame): (number | null)[] {
  const tc = game.timeControl;
  const prev: Record<Color, number | null> = { w: tc?.base ?? null, b: tc?.base ?? null };
  return game.moves.map((m) => {
    if (m.clockSeconds === null) return null;
    const before = prev[m.color];
    prev[m.color] = m.clockSeconds;
    if (before === null) return null;
    const spent = before - m.clockSeconds + (tc?.increment ?? 0);
    return spent >= 0 && spent < 7200 ? Math.round(spent * 10) / 10 : null;
  });
}

/** Which side the named player had, or null when neither name matches. */
export function heroFor(meta: GameMeta, playerName: string | null): Color | null {
  if (!playerName) return null;
  const needle = playerName.trim().toLowerCase();
  if (!needle) return null;
  if (meta.white.toLowerCase() === needle) return 'w';
  if (meta.black.toLowerCase() === needle) return 'b';
  return null;
}

export function resultScore(result: string, color: Color): number {
  if (result === '1/2-1/2') return 0.5;
  if (result === '1-0') return color === 'w' ? 1 : 0;
  if (result === '0-1') return color === 'b' ? 1 : 0;
  return 0.5;
}

/** Convert a UCI principal variation into readable SAN. */
export function pvToSan(fen: string, pv: string[], limit = 12): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const uci of pv.slice(0, limit)) {
    try {
      const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
      out.push(m.san);
    } catch {
      break;
    }
  }
  return out;
}

export function uciToSan(fen: string, uci: string): string | null {
  const [san] = pvToSan(fen, [uci], 1);
  return san ?? null;
}
