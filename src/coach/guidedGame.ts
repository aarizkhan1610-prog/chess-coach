import type { Color } from '../types';

/*
 * A whole game, played from the strong side, with the reasoning attached.
 *
 * The opponent plays the moves the Duke of Brunswick and Count Isouard played
 * against Morphy in 1858, and the app says so rather than dressing a script up
 * as an engine. That is the point of using a real game: the moves were not
 * invented to make a lesson work, and the finish is a forced mate rather than
 * an opponent who cooperates.
 *
 * Nothing is locked. Play whatever you like and you are told how it compares;
 * keep it and the engine takes over the other side. The last two moves carry no
 * suggestion at all, because from there White has a forced mate in two and
 * Black has exactly one legal reply — the ending cannot break however it is
 * reached. Every claim here is checked in `tests/guided.test.ts`.
 */

export interface ScriptedMove {
  /** The move to play, in SAN. */
  san: string;
  /** The idea, shown before they move. Never names the move itself. */
  idea: string;
  /** Why it was right, shown after. */
  why: string;
  /** The general rule behind it. Taught once, like every other principle. */
  principle?: string;
  /** The opponent's historical answer. Null on the final move. */
  reply: string | null;
  /** What the opponent's answer tells you. */
  replyNote?: string;
}

export interface GuidedGame {
  id: string;
  title: string;
  subtitle: string;
  blurb: string[];
  hero: Color;
  moves: ScriptedMove[];
  /** Index from which no move is suggested. A forced mate starts here. */
  freeFrom: number;
  /** What they are told when the suggestions stop. */
  freeBrief: string;
}

export const OPERA: GuidedGame = {
  id: 'opera',
  title: 'The Opera Game',
  subtitle: 'Paris, 1858. You play Morphy.',
  blurb: [
    'Paul Morphy played this game in a box at the Paris opera, against two opponents sharing the black pieces, while trying to watch the performance. It is the game most often used to teach what the opening is actually for.',
    'You play White. Your opponents play exactly what they played on the night, so when they go wrong, they go wrong for the reasons real players do.',
    'Nothing is locked. Play whatever you want and you will be told how it compares with Morphy’s move, and you can take it back or carry on with your own. For the last two moves there is no suggestion at all: by then there is a forced checkmate, and finding it is yours.',
  ],
  hero: 'w',
  freeFrom: 15,
  freeBrief: 'From here you are on your own. There is a forced checkmate in two moves, and every reply loses. Look at what is holding Black together, and what happens if it is removed.',
  moves: [
    {
      san: 'e4',
      idea: 'Start in the middle. Which pawn move claims the most space and frees the most pieces?',
      why: 'The centre, and two pieces unblocked in one move: the bishop on f1 and the queen both see daylight now.',
      principle: 'Open with a centre pawn. It claims space and opens lines for the pieces behind it.',
      reply: 'e5',
      replyNote: 'Black stakes the same claim.',
    },
    {
      san: 'Nf3',
      idea: 'Bring a piece out. Is there one that develops and attacks something at the same time?',
      why: 'Developed and attacking the e5 pawn, so Black has to answer it. A move that develops and threatens is worth two.',
      principle: 'Develop knights and bishops early, and towards the centre. A knight on the rim reaches half as many squares.',
      reply: 'd6',
      replyNote: 'Black defends the pawn, but the move shuts in their own light-squared bishop.',
    },
    {
      san: 'd4',
      idea: 'Your opponent has spent a move defending. Can you add a second pawn to the centre and hit e5 again?',
      why: 'Two pawns abreast in the centre, and e5 is attacked twice while defended once.',
      reply: 'Bg4',
      replyNote: 'Active-looking: the bishop pins your knight against the queen. But it develops towards nothing and leaves the centre alone.',
    },
    {
      san: 'dxe5',
      idea: 'The pin looks awkward. Look harder at it: is the knight really stuck, and what happens to the e5 pawn?',
      why: 'The pin is an illusion. Black cannot recapture with the pawn, because 4...dxe5 runs into 5.Qxd8+ and the queen is gone.',
      reply: 'Bxf3',
      replyNote: 'Forced. Black takes first so the queen is not lost with check.',
    },
    {
      san: 'Qxf3',
      idea: 'Take the bishop back. Which recapture develops a piece rather than wrecking your pawns?',
      why: 'The queen recaptures and eyes f7. Taking with the g-pawn would have split your kingside for nothing.',
      reply: 'dxe5',
      replyNote: 'Black wins the pawn back, and has still not developed a single piece.',
    },
    {
      san: 'Bc4',
      idea: 'Another piece out. Which square lets your bishop join the queen in pointing at the same weakness?',
      why: 'Bishop and queen both bear down on f7, the one square in Black’s camp defended by nothing but the king.',
      principle: 'f7 and f2 are the weakest squares at the start of a game: each is defended only by its own king.',
      reply: 'Nf6',
      replyNote: 'Black’s first developed piece, and it blocks your queen’s path down the f-file.',
    },
    {
      san: 'Qb3',
      idea: 'Your queen is blocked on f3. Is there a square where she attacks two things at once?',
      why: 'From b3 the queen hits f7 again alongside the bishop, and b7 as well. Two threats, one move.',
      principle: 'A move that creates two threats usually wins something, because only one of them can be answered.',
      reply: 'Qe7',
      replyNote: 'The only way to hold f7, and it buries Black’s dark-squared bishop behind the queen.',
    },
    {
      san: 'Nc3',
      idea: 'There is a free pawn on b7. Is taking it worth more than getting your last knight into the game?',
      why: 'The engine would take the pawn. Morphy developed, and for a human that is the better practical choice: material can be collected later, but an attack disappears if you give the opponent time.',
      principle: 'When you are ahead in development, a move that adds a piece is usually worth more than a pawn.',
      reply: 'c6',
      replyNote: 'Black props up b5 and d5, but is still three pieces behind.',
    },
    {
      san: 'Bg5',
      idea: 'One minor piece is still at home. Where does it go so that it pins something?',
      why: 'The last minor piece is out, and it pins the knight that is currently holding Black’s position together.',
      reply: 'b5',
      replyNote: 'A lunge to chase the bishop away. Black has one piece developed and is opening lines, which is exactly the wrong thing to do when behind.',
    },
    {
      san: 'Nxb5',
      idea: 'Black just opened a file towards their own king. Count your pieces against theirs before deciding what a knight is worth here.',
      why: 'A knight for a pawn, to tear open the file every one of your pieces is already pointing down. The engine rates this the best move on the board.',
      principle: 'Material is a means, not the goal. Giving some up to open lines at an uncastled king is often the strongest move in the position.',
      reply: 'cxb5',
      replyNote: 'Accepting. Declining would leave Black a pawn down with a ruined position anyway.',
    },
    {
      san: 'Bxb5+',
      idea: 'Keep the initiative. Is there a capture that comes with check, so Black never gets a free move?',
      why: 'Check, so Black has no time to catch up. You have three pieces attacking and Black has one developed.',
      reply: 'Nbd7',
      replyNote: 'Blocking is the only legal answer, and it puts another piece on the d-file.',
    },
    {
      san: 'O-O-O',
      idea: 'Your king is still in the middle and a rook is still in the corner. Is there one move that fixes both?',
      why: 'Castling with tempo: the king steps out of the centre and the rook lands on d1, pinning the knight that is holding everything.',
      principle: 'Castling long brings a rook to the centre file immediately. It is the only move that develops two pieces at once.',
      reply: 'Rd8',
      replyNote: 'Black adds a defender to the pinned knight.',
    },
    {
      san: 'Rxd7',
      idea: 'Black is holding on by defending one pinned piece. What happens if you keep trading pieces onto that square?',
      why: 'Every exchange on d7 drags another Black piece onto the pin and brings another of yours to bear.',
      reply: 'Rxd7',
    },
    {
      san: 'Rd1',
      idea: 'One rook is gone. Where does the other one want to be?',
      why: 'The second rook joins the same file. Black’s remaining pieces are all tied to defending d7.',
      principle: 'Rooks belong on open files, and doubled on the file where the pressure already is.',
      reply: 'Qe6',
      replyNote: 'Black defends the knight a third time. It is still not enough.',
    },
    {
      san: 'Bxd7+',
      idea: 'Black has defended that square as many times as you have attacked it. Can you remove a defender with check?',
      why: 'The last defender goes, with check, so there is no time to reorganise.',
      reply: 'Nxd7',
      replyNote: 'Forced again.',
    },
    {
      san: 'Qb8+',
      idea: '',
      why: 'The queen is worth nine points and the knight three, and none of that matters: Black has exactly one legal reply, and it drags the knight off the square that was stopping mate.',
      principle: 'Material is irrelevant next to checkmate. Count the opponent’s legal answers before you count the points.',
      reply: 'Nxb8',
      replyNote: 'The only legal move on the board.',
    },
    {
      san: 'Rd8#',
      idea: '',
      why: 'Checkmate. The rook lands on the square the knight was forced to leave, and the king has nowhere to go.',
      reply: null,
    },
  ],
};

export const GUIDED_GAMES: GuidedGame[] = [OPERA];

export function findGuidedGame(id: string): GuidedGame | undefined {
  return GUIDED_GAMES.find((g) => g.id === id);
}

/** Strip the decorations so a learner's "Rd8" matches a scripted "Rd8#". */
export function sameMove(a: string, b: string): boolean {
  const bare = (s: string) => s.replace(/[+#!?]/g, '');
  return bare(a) === bare(b);
}
