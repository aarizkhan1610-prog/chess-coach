import { MOTIF_META, type AnalysedGame, type Color, type MotifTag } from '../types';

/*
 * The coach's material, taken from the player's own games.
 *
 * This is deliberately not the puzzle generator. A puzzle has one answer and
 * grades you against it, which is the right shape for drilling a pattern but
 * the wrong shape for "what should I have done here" — that question has
 * several defensible answers and the useful part is being told what each one
 * does. So these are positions, not puzzles: the board opens where the mistake
 * was made and the coach responds to whatever is played.
 */

export interface CoachSpot {
  gameId: string;
  ply: number;
  moveNumber: number;
  /** The position as it stood before the mistake. */
  fen: string;
  /** The side the player had. */
  hero: Color;
  /** What they actually played. */
  played: string;
  /** Win probability it cost them. */
  winLoss: number;
  motifs: MotifTag[];
  opponent: string;
  /** Date of the game, for ordering and for saying when it was. */
  at: number;
}

const WORTH_REVISITING: string[] = ['blunder', 'mistake'];

/**
 * Positions worth going back to, costliest first.
 *
 * Cost rather than recency, because the point is to spend the session on the
 * moves that actually decided games. One position per game at most on the
 * first pass, so a single disastrous game cannot fill the whole queue.
 */
export function coachSpots(games: AnalysedGame[], limit = 24): CoachSpot[] {
  const byGame = new Map<string, CoachSpot[]>();

  for (const game of games) {
    const opponent = game.hero === 'w' ? game.meta.black : game.meta.white;
    const spots = game.moves
      .filter((m) => m.color === game.hero && WORTH_REVISITING.includes(m.verdict))
      .map((m) => ({
        gameId: game.id,
        ply: m.ply,
        moveNumber: m.moveNumber,
        fen: m.fenBefore,
        hero: game.hero,
        played: m.san,
        winLoss: m.winLoss,
        motifs: m.motifs,
        opponent,
        at: game.analysedAt,
      }))
      .sort((a, b) => b.winLoss - a.winLoss);
    if (spots.length) byGame.set(game.id, spots);
  }

  /* Round-robin across games, so the queue spreads rather than clumping. */
  const out: CoachSpot[] = [];
  for (let round = 0; out.length < limit; round++) {
    let added = 0;
    for (const spots of byGame.values()) {
      if (round < spots.length && out.length < limit) {
        out.push(spots[round]);
        added++;
      }
    }
    if (!added) break;
  }

  return out.sort((a, b) => b.winLoss - a.winLoss);
}

/** One line naming what went wrong, from the motifs the analysis found. */
export function spotReason(spot: CoachSpot): string | null {
  const named = spot.motifs.filter((t) => MOTIF_META[t].family !== 'phase');
  if (!named.length) return null;
  return named.map((t) => MOTIF_META[t].short.toLowerCase()).join(' and ');
}
