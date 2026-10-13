# Chess Coach

**[Open it →](https://aarizkhan1610-prog.github.io/chess-coach/)**

A browser app that analyses your games, works out what you actually keep getting
wrong, and then trains exactly that. Everything runs locally — Stockfish 19 is
compiled to WebAssembly and executes in a worker in your own tab. No game ever
leaves your machine, and there is no server, account or API key.

```bash
npm install
npm run dev
```

## Two features

The app is a coach and a report, and the navigation has two entries because
there are two things here. An earlier version had a home page, four "pathway"
cards, and recommendations emitted from twelve different surfaces — at which
point what the app was actually for had stopped being obvious.

**The report** (`/report`) states findings. It opens on a shape rather than a
column of percentages, because there is no way to know whether 71% is good
without something to hold it against. Five axes — opening, middlegame, tactics,
serious errors, converting — are drawn against the measured typical range for
players at your rating, with the gaps ranked underneath, where your win
probability actually goes by phase and by cause, accuracy over time, and the
openings you play scored against your band. Every game opens on its own version
of the same report.

**The coach** (`/`) prescribes. It names the three habits costing you the most
and trains each one: six positions of that single motif from your own games,
worst first, then the lesson for it, then puzzles built from it, then the
opening it keeps happening in. Recommendations — lessons, puzzles, openings —
come from one place and all resolve into the coach, so nothing is suggested
without a reason attached to it.

On a first run the coach asks for your rating, because it is the one thing that
lets it say something specific before it has seen you play. Import games and it
stops talking about players like you and starts talking about you.

## Starting from nothing

There is a separate track for people who do not play yet, under **Learn to
play**. It is deliberately not a third feature: the coach and the report both
assume you can already play.

- **How the pieces move** — six sections, each with a diagram of every square
  the piece can reach and drills to try it. Wrong moves are not rejected;
  blocking them would teach the shape of the drill rather than the shape of the
  piece, so the task stays on screen with a hint and a walk-through on request.
- **The rules people get wrong** — checkmate, stalemate, castling, en passant.
- **The Opera Game** — Morphy in Paris in 1858, played from his side. You are
  asked what the position needs, you play whatever you think, and you are told
  how it compares with what was played. The last two moves carry no suggestion
  at all, because by then White has a forced mate in two.
- **Play with a coach** — a real game against a deliberately weak opponent with
  every move you make explained.

Neither of the first two stages touches the engine. None of those questions
need a search, and a first lesson should not wait on a 1.7 MB download.

### Explaining a move

Game review already works out *that* a move was bad and gives it a motif, but a
motif is a category rather than an explanation: `hanging-piece` tells a new
player nothing. The beginner track names the pieces and squares involved —
"your bishop on c4 has nothing defending it; your opponent plays dxc4 and wins
a bishop" — and offers to play the punishment out on the board, because
watching the piece disappear lands harder than a sentence saying it will.

It also explains moves that are *good*, which had to be written from scratch:
motif detection only ever fires on mistakes. Praise is offered only after the
faults have had their say, or the coach congratulates you for developing a
knight to a square where it is taken for free.

Two things the evaluation alone gets wrong for a beginner, both corrected here:
a move like `Ke2` costs a fraction of a pawn, so no threshold will ever object
to giving up castling — those are flagged on the habit instead of the score.
And a queen sacrifice that forces mate is not a blunder, so mate outranks
material outright.

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

Analysis runs at roughly fifteen seconds a game, and each game is saved the
moment it finishes rather than at the end of the batch, so stopping early — or
closing the tab — keeps everything already done.

**Find the pattern.** For every mistake the app works out *why* it was a mistake
— not just "you lost 30%", but "you left a piece undefended", "you walked into a
fork", "you moved a pawn in front of your own king". Those causes aggregate
across games into a ranked weakness profile, ordered by how much win probability
each habit costs you per game.

**Lessons.** 26 of them, one per detectable weakness, each mixing written
explanation, a checklist you can apply at the board, a worked position, and your
own positions where the mistake actually happened. The library organises them;
it does not rank them, because ranking by your games is the coach's job and
having both do it was the clearest case of the app giving the same advice twice.

**Puzzles from your own blunders.** Every mistake becomes up to two puzzles: the
position you faced with the move you missed, and the position after your error
from the other side, so you learn to spot the pattern both ways. Game modes:
Practice (spaced repetition), Weakness drill, Blunder rewind, Puzzle rush
(3 minutes, 3 strikes), Streak, Survival, and a Daily set.

**Openings.** 27 courses across White and Black repertoires, each with a
move-by-move walkthrough, the strategic ideas, plans for both sides, the main
variations, known traps, and a "play the line from memory" test.

## The benchmark

The comparison is measured, not invented. `npm run build:benchmark` samples real
rated games from the public Lichess API across five rating bands, runs them
through the same analysis and the same scoring function that runs on your own
games, and writes the medians and quartiles to `src/coach/benchmark.ts`. The
shipped table is built from 534 games, roughly 107 per band.

```bash
CORPUS_OUT=corpus.json npm run build:benchmark    # crawl, and keep the games
CORPUS_IN=a.json,b.json npm run build:benchmark   # re-score, deduplicated by game
```

Keeping the corpus is what makes the scoring changeable. Re-scoring one set of
games is the only way to tell a scoring change from a sampling difference; two
crawls through two formulas is a coincidence. Several files merge, deduplicated
by a hash of the players, date and moves, so a second crawl grows the sample
instead of doubling it.

Two rules keep the chart honest: an axis your game did not contain enough of is
left off rather than drawn as zero, and a rating band with too few samples is
passed over for the nearest one that has enough, which the page says out loud.

### The axes earn their place or they go

Each axis has to order the rating bands and keep away from both ends of its own
scale. Three failed and were changed; one failed twice and was removed.

- **King safety** scored a flat 100 in every band across 110 games. It fired so
  rarely that it measured nothing, and it became a blunder rate.
- **Serious errors** then counted only blunders, which left four bands off the
  ceiling and the fifth on it — the median game above 2000 contains no blunder.
  Mistakes now count half and inaccuracies a quarter.
- **Converting** summed every win-probability point lost while winning, which
  measures churn rather than conversion: an evaluation wobbling between 90% and
  86% for twenty moves adds up to a large number while nothing was handed over.
  It is now the largest drawdown from a winning high-water mark. The old version
  also moved 28 points between two samples of the same size, which is what
  measuring noise looks like.
- **Tactics** could only see damage above the motif detector's 8-point bar, and
  half of all games above 2000 contain none. It now also counts moves the
  opponent answered by force — a capture, a check or mate — which is the same
  damage seen from the other side.
- **The endgame** is gone. Scored as accuracy it ran 94, 93, 93, 91, 95 from the
  bottom band to the top: four points of spread across the whole rating range,
  because accuracy comes from win probability and win probability barely moves
  in a position that is already decided, which most endgames are. Restricting it
  to endgames that were still a contest gave it spread and cost it stability —
  only a fifth of games contain one, so its band medians moved 22 points between
  disjoint samples and it ranked the 1700s below the 1400s. Endgame accuracy is
  still reported, as a fact about your games rather than a comparison.

## Your data

Everything lives in one browser profile, in IndexedDB rather than
`localStorage`: one analysed game runs to tens of kilobytes of per-move
evaluations, so a few dozen would blow the 5 MB quota.

Because that is the only copy, three things guard it:

- **Backup and restore**, in Settings. The export used to have no counterpart,
  which is worse than having no backup at all — it reads as a safety net and is
  not one. Restoring states what is in the file and what it would replace, and
  refuses anything that is not ours, is from a newer format, or contains no
  games, since restoring an empty backup over a full library would be a wipe
  reported as a success.
- **Storage faults are surfaced.** A failed read used to return null, which is
  indistinguishable from an empty database, so the app came up looking like a
  fresh install and then wrote that emptiness over data that was fine. A read
  fault now switches writing off entirely and says so.
- **An error boundary** around the routed page, carrying the export button
  itself rather than a link to Settings, because the point is that reaching
  Settings may be what is broken.

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

Detection only runs on moves that lost 8 win-probability points or more. That is
the right bar for telling somebody they keep walking into pins — lowering it to
4 produces 43% more tags and to 2 nearly twice as many, which turns the weakness
list into a list of trivia.

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
npm test             # everything, including real-engine checks (~3 min)
npm run test:fast    # the pure-logic suites only
npm run typecheck
```

Thirteen suites, 607 assertions, and they gate the deploy: the workflow in
`.github/workflows/deploy.yml` runs the typecheck and the full suite before
publishing, so a bad commit stops at CI rather than on the live site.

They cover static exchange evaluation and tactical geometry against known
positions, PGN parsing across Lichess and Chess.com formats (clocks, variations,
custom FENs, multi-game files), motif detection against known blunders, the
report's scoring arithmetic, backup parsing, and weakness, puzzle and
spaced-repetition logic.

Five suites check content rather than code, because hand-written chess is easy
to get wrong:

- `openings.test.ts` replays all 105 move sequences in the opening book and
  verifies every claimed mate really is mate;
- `lesson-positions.test.ts` runs every position used in a lesson past the engine
  and fails if the stated answer is not the best move;
- `e2e.test.ts` drives real PGNs through the real engine and asserts on the
  blunders, motifs and refutations that come out;
- `basics.test.ts` replays every beginner drill through the same function the
  drill board uses, so it cannot pass while the real thing behaves differently;
- `guided.test.ts` replays the Opera Game, checks every recommended move
  against the engine, and proves the promise the design rests on — that a
  forced mate exists from the point where the suggestions stop.

There are no render tests. Every interface change in this project has been
checked by hand in a browser, which is the largest gap in the suite.

## Layout

```
src/
  chess/       rules, evaluation maths, board geometry, SEE, motif detection
  engine/      Stockfish worker wrapper, analysis pipeline, React hooks
  coach/       weakness profiling, report scoring and the benchmark, lessons,
               puzzle generation, spaced repetition, beginner drills,
               move explanation in plain English
  openings/    27 opening courses and opening detection
  components/  board (with hand-drawn SVG pieces), radar and trend charts,
               error boundary, primitives
  pages/       coach, coach training, report, games, game review, import,
               lessons, puzzles, openings, basics, settings
  state/       store, IndexedDB adapter, backup file format
scripts/       benchmark builder, starter-puzzle generator
tests/         see above
```

Deployment is a static build — `base` is relative and the engine is the
single-threaded Stockfish build, so there is no `SharedArrayBuffer` and none of
the COOP/COEP headers GitHub Pages cannot set. It needs no server anywhere.

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
