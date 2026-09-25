# Chess Coach

A browser app that analyses your games, works out what you actually keep getting
wrong, and then trains exactly that. Everything runs locally — Stockfish 19 is
compiled to WebAssembly and executes in a worker in your own tab. No game ever
leaves your machine, and there is no server, account or API key.

```bash
npm install
npm run dev
```

## Where you start

The app opens on four pathways rather than a dashboard, because a dashboard
with no games in it tells you nothing. They are phrased as intentions, not
features:

- **Show me my mistakes** — import a game and find out what it cost you
- **Teach me the fundamentals** — the habits that decide games below master level
- **Grow my opening repertoire** — proper courses for both colours
- **Sharpen my tactics** — puzzles, and seven ways to drill them

Each destination is built to be worth arriving at with no data at all:

- **Lessons** lead with a *core track* — eleven lessons in the order that pays
  off fastest, each stating why it sits where it does, with progress and a
  resume point. It is a fallback, not the goal: the personalised plan takes
  over the moment there are games to rank by, because an order built from your
  own mistakes always beats a fixed one.
- **Openings** lead with a *first repertoire* panel, which reduces 27 courses to
  the three decisions a repertoire actually is — what you open with, and an
  answer to each of 1.e4 and 1.d4 — offering two low-theory options for each.
- **Puzzles** mark Practice as the place to begin, and say why.

The pathways are not discarded once the app has data. The same definitions
render as a compact strip above the dashboard, resolved against real state —
how many mistakes were found, which lesson is next, which opening you have
started or actually played, how many puzzles came from your own blunders — and
their destinations retarget to match. The beginner scaffolding stands down on
its own: the core track yields to the personal plan, and the first-repertoire
panel gives way to the openings you actually play.

## What it does

**Import and analyse.** Type your Lichess or Chess.com username and it pulls
your last 5, 10 or 20 games straight from the public API — or paste a PGN from
anywhere, including a real board. Every position in the game is evaluated, each
move gets a verdict (blunder / mistake / inaccuracy / good / best / great /
brilliant / book) and a win-probability cost, and the game gets an accuracy
score per side and per phase.

Fetching by username is the only time the app talks to anything external, and
the only thing that leaves the machine is the username, in the URL. Games
travel inwards; the analysis stays here. Both services expose read-only public
endpoints that permit browser requests, so this still needs no server of its
own. Lichess rate-limits to one request at a time, and Chess.com's bot
protection occasionally rejects browser calls — both are reported with a
readable explanation, and pasting a PGN always works as a fallback.

**Find the pattern.** For every mistake the app works out *why* it was a mistake
— not just "you lost 30%", but "you left a piece undefended", "you walked into a
fork", "you moved a pawn in front of your own king". Those causes aggregate
across games into a ranked weakness profile, ordered by how much win probability
each habit costs you per game.

**Lessons that follow your profile.** 26 lessons, one per detectable weakness,
ordered by what your games say is costing you the most. Each one mixes written
explanation, a checklist you can apply at the board, a worked position, and your
own positions where the mistake actually happened.

**Puzzles from your own blunders.** Every mistake becomes up to two puzzles: the
position you faced with the move you missed, and the position after your error
from the other side, so you learn to spot the pattern both ways.

**Puzzle game modes.** Practice (spaced repetition), Weakness drill, Blunder
rewind, Puzzle rush (3 minutes, 3 strikes), Streak, Survival, and a Daily set.

**Openings.** 27 courses across White and Black repertoires, each with a
move-by-move walkthrough, the strategic ideas, plans for both sides, the main
variations, known traps, and a "play the line from memory" test.

## How the analysis works

### Evaluation and verdicts

Positions are scored by Stockfish and converted to win probability with the
standard logistic used by public tooling, so the numbers are comparable to what
you would see elsewhere. A move's cost is the win probability the mover gave
away. Thresholds follow Lichess: 10 points is an inaccuracy, 20 a mistake, 30 a
blunder.

Two guards keep the labels honest:

- in an already-decided position (below 12% or above 88%) errors are softened by
  one step, because win-probability swings are cheap there;
- a position with one legal move cannot contain a mistake.

Moves that are the *only* move holding the position — where the second-best
choice loses 20 points or more — are promoted to "great", or "brilliant" when
they also give up material.

Game accuracy combines a volatility-weighted mean (mistakes in calm positions
count more than noise in wild ones) with a harmonic mean (any single bad move
drags the number down hard). A straight average is far too forgiving: in a short
game a piece blunder hides behind a handful of book moves.

### Why a move was bad

This is the part that makes the coaching specific. For every mistake the app
looks at the engine's refutation and the move you should have played, and runs a
set of checks over the position:

- **Static exchange evaluation**, implemented by actually playing out the capture
  sequence with legal move generation, so x-rays, pins and overloaded defenders
  are handled correctly rather than approximated.
- **Its own attack map**, because chess.js only generates moves for the side to
  move and most of these questions are about the opponent's pieces.
- **Geometry** for forks, pins, skewers, discovered attacks, outposts, trapped
  pieces, back-rank risk, king exposure and pawn-structure damage.

That produces up to two *cause* tags and two *context* tags per mistake, from 26
motifs. When a move has several causes, its cost is split between them, so one
blunder cannot inflate several categories at once.

### Puzzle generation

A puzzle is only created when the answer is unambiguous — the second-best move
must be at least 8 win-probability points worse, otherwise there is nothing fair
to grade against. Solutions are cut at the last forcing move (capture, check or
promotion), because past that point the engine's continuation is just one good
move among many.

Difficulty is estimated from the length of the forcing line, whether the key move
is quiet (much harder to spot than a capture or check), and how deep the engine
had to search before it settled on the move.

At solve time, a move that is not the stored answer is checked against the engine
before being marked wrong: real positions often have more than one winning move,
and rejecting those is the fastest way to lose the solver's trust.

## Testing

```bash
npm test        # everything, including real-engine checks (~2 min)
npm run test:fast   # the pure-logic suites only
npm run typecheck
```

The suite covers static exchange evaluation and tactical geometry against known
positions, PGN parsing across Lichess and Chess.com formats (clocks, variations,
custom FENs, multi-game files), motif detection against known blunders, and
weakness, puzzle and spaced-repetition logic.

Three suites check content rather than code, because hand-written chess is easy
to get wrong:

- `openings.test.ts` replays all 105 move sequences in the opening book and
  verifies every claimed mate really is mate;
- `lesson-positions.test.ts` runs every position used in a lesson past the engine
  and fails if the stated answer is not the best move;
- `e2e.test.ts` drives real PGNs through the real engine and asserts on the
  blunders, motifs and refutations that come out.

## Layout

```
src/
  chess/       rules, evaluation maths, board geometry, SEE, motif detection
  engine/      Stockfish worker wrapper, analysis pipeline, React hooks
  coach/       weakness profiling, lessons, puzzle generation, spaced repetition
  openings/    27 opening courses and opening detection
  components/  board (with hand-drawn SVG pieces), eval bar and graph, pathway
               definitions, primitives
  pages/       landing, import, review, profile, lessons, puzzles, openings,
               settings
scripts/       starter-puzzle generator (npm run build:puzzles)
tests/         see above
```

Analysed games are stored in IndexedDB rather than `localStorage`: one game runs
to tens of kilobytes of per-move evaluations, so a few dozen games would blow the
5 MB quota.

## Regenerating the starter puzzles

`src/coach/starterPuzzles.ts` is generated, so the puzzle modes have content
before you have imported anything. It is built by pushing famous miniatures and
every opening-book position (with a deliberate material-losing move appended)
through the same analysis and puzzle-generation code the app uses on your games.

```bash
npm run build:puzzles
```

## Licence

This project is licensed under the **GNU General Public License v3.0** — see
[LICENSE](LICENSE).

It has to be. The app bundles the Stockfish engine
(`public/engine/stockfish-19-lite-single.wasm` and its loader), which the
Stockfish team publishes under GPL-3. Shipping that engine — in this repository,
and to every visitor's browser when the app is deployed — is distribution, so the
combined work is offered under the same terms.

In practice that means you are free to use, study, modify and redistribute this,
provided you keep it under GPL-3 and make the source available.

Stockfish is copyright the Stockfish developers; its licence text also ships at
`public/engine/STOCKFISH-LICENSE-GPLv3.txt`.
