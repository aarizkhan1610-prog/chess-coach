/**
 * Fetching games straight from a public profile.
 *
 * Both services expose read-only public endpoints that send
 * `Access-Control-Allow-Origin: *`, so the browser can call them directly and
 * the app still needs no server. The only thing that leaves the machine is the
 * username, in the URL; games travel inwards and the analysis stays local.
 */

export type Provider = 'lichess' | 'chesscom';

export const PROVIDERS: { id: Provider; name: string; placeholder: string; profile: (u: string) => string }[] = [
  { id: 'lichess', name: 'Lichess', placeholder: 'your lichess username', profile: (u) => `https://lichess.org/@/${u}` },
  { id: 'chesscom', name: 'Chess.com', placeholder: 'your chess.com username', profile: (u) => `https://www.chess.com/member/${u}` },
];

export type ImportErrorKind = 'not-found' | 'rate-limit' | 'blocked' | 'network' | 'empty' | 'cancelled';

export class ImportError extends Error {
  constructor(message: string, readonly kind: ImportErrorKind, readonly hint?: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export interface FetchResult {
  pgn: string;
  /** Games actually returned, which can be fewer than requested. */
  count: number;
  provider: Provider;
  username: string;
}

/** Rough count of games in a multi-game PGN, for reporting before parsing. */
function countGames(pgn: string): number {
  return (pgn.match(/^\s*\[Event\s/gm) ?? []).length;
}

async function getJson(url: string, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, { headers: { Accept: 'application/json' }, signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new ImportError('Cancelled.', 'cancelled');
    throw new ImportError(
      'Could not reach the server.',
      'network',
      'Check your connection. A browser extension or ad blocker can also block these requests.',
    );
  }
}

/* ------------------------------------------------------------------ *
 * Lichess
 * ------------------------------------------------------------------ */
async function fetchLichess(username: string, max: number, signal?: AbortSignal): Promise<FetchResult> {
  const url =
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}` +
    `?max=${max}&clocks=true&opening=true`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/x-chess-pgn' }, signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new ImportError('Cancelled.', 'cancelled');
    throw new ImportError('Could not reach Lichess.', 'network', 'Check your connection, or try again in a moment.');
  }

  if (res.status === 404) {
    throw new ImportError(`Lichess has no account called “${username}”.`, 'not-found', 'Check the spelling — usernames are not case sensitive.');
  }
  if (res.status === 429) {
    throw new ImportError('Lichess is asking us to slow down.', 'rate-limit', 'It allows one request at a time. Wait about a minute and try again.');
  }
  if (!res.ok) {
    throw new ImportError(`Lichess returned an error (${res.status}).`, 'network');
  }

  const pgn = await res.text();
  if (!pgn.trim()) {
    throw new ImportError(`“${username}” has no public games.`, 'empty', 'Games played while logged out are not attached to an account.');
  }
  return { pgn, count: countGames(pgn), provider: 'lichess', username };
}

/* ------------------------------------------------------------------ *
 * Chess.com
 * ------------------------------------------------------------------ */
interface ChessComGame {
  pgn?: string;
  rules?: string;
  end_time?: number;
}

async function fetchChessCom(username: string, max: number, signal?: AbortSignal): Promise<FetchResult> {
  const listRes = await getJson(
    `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`,
    signal,
  );

  if (listRes.status === 404) {
    throw new ImportError(`Chess.com has no member called “${username}”.`, 'not-found', 'Check the spelling.');
  }
  if (listRes.status === 403) {
    throw new ImportError(
      'Chess.com blocked the request.',
      'blocked',
      'Their bot protection sometimes rejects browser calls. Downloading the PGN from Chess.com and pasting it below always works.',
    );
  }
  if (!listRes.ok) throw new ImportError(`Chess.com returned an error (${listRes.status}).`, 'network');

  const { archives } = (await listRes.json()) as { archives?: string[] };
  if (!archives?.length) {
    throw new ImportError(`“${username}” has no games on Chess.com.`, 'empty');
  }

  // Games are filed by month. Walk back from the newest until we have enough,
  // capped so a quiet account cannot trigger a dozen requests.
  const collected: ChessComGame[] = [];
  for (let i = archives.length - 1; i >= 0 && collected.length < max && archives.length - i <= 4; i--) {
    const monthRes = await getJson(archives[i], signal);
    if (!monthRes.ok) break;
    const { games } = (await monthRes.json()) as { games?: ChessComGame[] };
    // Standard chess only — variants will not parse as normal PGN.
    const usable = (games ?? []).filter((g) => g.pgn && (g.rules ?? 'chess') === 'chess');
    collected.unshift(...usable);
  }

  if (!collected.length) {
    throw new ImportError(`No standard games found for “${username}”.`, 'empty', 'Variants such as Chess960 and bughouse are skipped.');
  }

  const recent = collected.slice(-max);
  const pgn = recent.map((g) => g.pgn).join('\n\n');
  return { pgn, count: recent.length, provider: 'chesscom', username };
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */
export async function fetchGames(
  provider: Provider,
  username: string,
  max: number,
  signal?: AbortSignal,
): Promise<FetchResult> {
  const clean = username.trim().replace(/^@/, '');
  if (!clean) throw new ImportError('Enter a username first.', 'not-found');
  return provider === 'lichess' ? fetchLichess(clean, max, signal) : fetchChessCom(clean, max, signal);
}
