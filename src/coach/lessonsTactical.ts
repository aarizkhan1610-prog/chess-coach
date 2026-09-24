import type { Lesson } from './lessonTypes';

export const TACTICAL_LESSONS: Lesson[] = [
  {
    tag: 'hanging-piece',
    title: 'Stop leaving pieces undefended',
    oneLiner: 'The single most common way club games are decided.',
    estMinutes: 8,
    why: 'More rated games are lost to an undefended piece than to every opening mistake combined. It is not a knowledge problem — it is a looking problem.',
    steps: [
      {
        kind: 'read',
        heading: 'What "hanging" actually means',
        body: [
          'A piece is hanging when your opponent can capture it and win material — either because nothing defends it, or because it is defended too few times.',
          'The dangerous cases are rarely the piece you just moved. They are the piece you moved three turns ago and stopped thinking about, whose defender has since wandered off.',
          'This is why the habit that fixes it is not "check the piece I am moving" but "check every piece, every move".',
        ],
      },
      {
        kind: 'checklist',
        heading: 'The scan — do this before every move',
        items: [
          'Name every one of your pieces that your opponent attacks.',
          'For each, count attackers and defenders. Attackers greater than defenders means trouble.',
          'Check whether the move you want to play removes a defender from somewhere else.',
          'Check whether it blocks a line one of your own pieces was defending along.',
          'Only then play the move.',
        ],
      },
      {
        kind: 'position',
        heading: 'Take the free piece',
        fen: '4k3/8/8/1p6/2B5/8/8/4K3 b - - 0 1',
        prompt: 'Black to play. White has left something behind — collect it.',
        solution: ['bxc4'],
        explain:
          'The pawn on b5 attacks the bishop on c4 and nothing defends it. Simple, and exactly the kind of thing that decides real games. Train yourself to see it from both sides: the same scan that wins this bishop is the scan that stops you losing yours.',
        orientation: 'b',
      },
      {
        kind: 'read',
        heading: 'The defender-removal trap',
        body: [
          'The subtler version: your piece is defended, so you relax — and then you move the defender.',
          'Every time you move a piece, ask what it was doing before. If the answer includes "defending something", you have just created a hanging piece.',
          'Rooks and queens are the worst offenders, because they defend along long lines you stop noticing.',
        ],
      },
      { kind: 'yours', heading: 'Your own examples', body: 'These are the positions from your games where this happened. Play through each one and find what you should have seen.' },
      { kind: 'drill', heading: 'Drill it', body: 'Puzzles built from your own hanging-piece mistakes, plus matching patterns.', tags: ['hanging-piece', 'moved-into-attack'], count: 8 },
    ],
  },
  {
    tag: 'moved-into-attack',
    title: 'Look before you land',
    oneLiner: 'Check the destination square before you commit the piece.',
    estMinutes: 6,
    why: 'Moving a piece onto a square the opponent already covers is a pure oversight: the information was on the board and free to read.',
    steps: [
      {
        kind: 'read',
        heading: 'Why this happens',
        body: [
          'You decide where a piece should go based on what it will do there — and forget to ask whether it will survive there.',
          'Pawn attacks are missed most often, because pawns are small and you are looking at pieces.',
          'Knight attacks are missed second most often, because knight moves are not straight lines.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Before you release the piece',
        items: [
          'Which enemy pieces attack the square I am moving to?',
          'Pawns first — they are cheap and they are the ones you miss.',
          'Then knights, then the long-range pieces.',
          'If it is attacked, is it defended enough, and is the trade good for me?',
        ],
      },
      {
        kind: 'read',
        heading: 'The discovered-square problem',
        body: [
          'A square can be safe right now and unsafe the moment you move there, because your own piece was blocking the attacker.',
          'Classic case: you move a knight off a file, and the rook behind it now attacks the square the knight went to.',
          'When you move a piece, mentally lift it off the board first, then ask what attacks the destination.',
        ],
      },
      { kind: 'yours', heading: 'Your own examples', body: 'Positions where you put a piece on a covered square.' },
      { kind: 'drill', heading: 'Drill it', body: 'Practice punishing this pattern so you stop producing it.', tags: ['moved-into-attack', 'hanging-piece'], count: 8 },
    ],
  },
  {
    tag: 'missed-material',
    title: 'See the free material',
    oneLiner: 'Check every capture, every move — including the ones that look silly.',
    estMinutes: 7,
    why: 'Missing free material costs exactly as much as giving it away, and it is the easier of the two problems to fix.',
    steps: [
      {
        kind: 'read',
        heading: 'Captures first',
        body: [
          'Strong players look at every capture available to them before anything else. Not because captures are usually right, but because the list is short and checking it is cheap.',
          'This includes captures that look absurd. "Obviously bad" captures are how you find sacrifices and how you notice that a defender was overloaded.',
          'The same applies to your opponent: look at every capture they have, too.',
        ],
      },
      {
        kind: 'position',
        heading: 'Count before you take',
        fen: '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1',
        prompt: 'White to play. What is available?',
        solution: ['exd5'],
        explain:
          'The pawn takes the queen and nothing recaptures. Trivial on an empty board, routinely missed with thirty pieces on it — because the queen was not the piece you were thinking about.',
      },
      {
        kind: 'checklist',
        heading: 'The capture scan',
        items: [
          'List every capture you have. All of them.',
          'For each, count what recaptures and work out the net material.',
          'Look for captures that win material only because a defender is doing two jobs.',
          'Then do the same for your opponent, so you know what you are allowing.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Positions from your games where material was on offer.', tags: ['missed-material', 'missed-fork', 'missed-pin'], count: 8 },
    ],
  },
  {
    tag: 'allowed-fork',
    title: 'Stop walking into forks',
    oneLiner: 'Two pieces on the same knight-move pattern is a standing invitation.',
    estMinutes: 8,
    why: 'A fork wins material by force. Once it lands there is usually nothing to be done, so the entire defence happens beforehand.',
    steps: [
      {
        kind: 'read',
        heading: 'Forks are a geometry problem',
        body: [
          'A knight on one square attacks up to eight others. If two of your valuable pieces sit on any two of those eight, the fork exists — whether or not the knight is there yet.',
          'So the question is never "is there a fork?" but "could a knight reach a square that hits two of my things?".',
          'Kings and queens are the usual victims, because a check forces you to respond and the other piece drops.',
        ],
      },
      {
        kind: 'position',
        heading: 'Play the fork',
        fen: '4k3/5r2/8/8/2N5/8/8/4K3 w - - 0 1',
        prompt: 'White to play. The knight has a square that hits two things at once.',
        solution: ['Nd6+'],
        explain:
          'Nd6 attacks the king on e8 and the rook on f7. The check is forced, so the rook falls next move. Notice the pattern: king and rook two squares apart on the same rank, with a knight two moves away.',
      },
      {
        kind: 'checklist',
        heading: 'Fork prophylaxis',
        items: [
          'After each of your moves, look at your king and queen. Are they on squares a knight could hit together?',
          'Watch the squares c7/f7 and c2/f2 — knights land there and hit king plus rook.',
          'When an enemy knight has two free moves toward your camp, check both.',
          "Pawns fork too. A pawn advancing to hit two pieces is the cheapest fork there is.",
        ],
      },
      { kind: 'yours', heading: 'Your own examples', body: 'Every fork you allowed, with the move that would have prevented it.' },
      { kind: 'drill', heading: 'Drill it', body: 'Find forks from both sides of the board.', tags: ['allowed-fork', 'missed-fork'], count: 8 },
    ],
  },
  {
    tag: 'missed-fork',
    title: 'Find your own forks',
    oneLiner: 'Look for knight squares that touch two enemy pieces.',
    estMinutes: 7,
    why: 'Forks are the most common way material is won below master level. Learning to spot yours is the fastest tactical upgrade available.',
    steps: [
      {
        kind: 'read',
        heading: 'How to hunt a fork',
        body: [
          'Start from the target, not the knight. Pick two valuable enemy pieces and ask: is there a square that attacks both?',
          'If there is, work out whether your knight can get there, and whether the square is safe.',
          'If the fork includes a check, it does not even need to be safe from everything — only from the king.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'The hunt',
        items: [
          'Find the enemy king and the enemy queen. Is there a square hitting both?',
          'Repeat for king and rook, queen and rook.',
          'Can any of your knights reach that square in one move? In two?',
          'Would a check or capture first drag a piece onto the right square?',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Fork patterns, including ones you walked past in your own games.', tags: ['missed-fork', 'allowed-fork'], count: 8 },
    ],
  },
  {
    tag: 'allowed-pin',
    title: 'Do not line up behind your king',
    oneLiner: 'A piece in front of something more valuable cannot move.',
    estMinutes: 7,
    why: 'A pin does not win material immediately — it freezes a piece so your opponent can pile on. The damage accumulates quietly.',
    steps: [
      {
        kind: 'read',
        heading: 'Absolute and relative pins',
        body: [
          'An absolute pin is against the king: the piece legally cannot move. A relative pin is against something valuable: it can move, but moving loses material.',
          'The pinned piece is not just stuck — it is a defender that has stopped working. Anything it was guarding is now effectively undefended.',
          'That second point is what actually loses games. The pin itself is often survivable; the collapse of what it was defending is not.',
        ],
      },
      {
        kind: 'position',
        heading: 'Punish the pin',
        fen: '4k3/3p1p2/4n3/8/5P2/8/8/4RK2 w - - 0 1',
        prompt: 'White to play. The knight on e6 cannot move — make that cost Black a piece.',
        solution: ['f5', 'Ke7', 'fxe6'],
        explain:
          'The rook on e1 pins the knight to the king, so it cannot run. f5 attacks it a second time and nothing saves it: 1.f5 Ke7 2.fxe6 dxe6 and White is a piece up. That is the whole technique — pin the piece, then hit it again, usually with a pawn.',
      },
      {
        kind: 'checklist',
        heading: 'Avoiding pins',
        items: [
          'Keep your king and queen off open files and diagonals where enemy rooks and bishops live.',
          'When a piece gets pinned, break it quickly: interpose, move the king, or challenge the pinner.',
          'Never count a pinned piece as a defender.',
          'The move ...h6 or ...a6 to stop Bg5 or Bb5 is usually worth the tempo.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Pins from both sides.', tags: ['allowed-pin', 'missed-pin', 'allowed-skewer'], count: 8 },
    ],
  },
  {
    tag: 'missed-pin',
    title: 'Use pins to win material',
    oneLiner: 'Pin it, then attack it again.',
    estMinutes: 6,
    why: 'A pin turns a defended piece into a stationary target. It is the cheapest way to create a winnable weakness out of nothing.',
    steps: [
      {
        kind: 'read',
        heading: 'The two-step',
        body: [
          'Step one: pin a piece against the king or queen. Step two: attack the pinned piece again, usually with a pawn.',
          'The pinned piece cannot run, so a pawn attacking it wins material outright.',
          'Bg5 against a knight on f6 (or Bb5 against a knight on c6, once the blocking pawn is gone) is the pattern to look for, followed by a pawn push.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Finding pins',
        items: [
          'Is any enemy piece on the same line as their king or queen?',
          'Can one of my bishops, rooks or my queen occupy that line?',
          'Once pinned, what can attack it a second time?',
          'Is the pinned piece defending something I can now take?',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Create and exploit pins.', tags: ['missed-pin', 'allowed-pin'], count: 6 },
    ],
  },
  {
    tag: 'allowed-skewer',
    title: 'Skewers: the pin in reverse',
    oneLiner: 'Valuable piece in front, cheaper piece behind — the valuable one must move and the other falls.',
    estMinutes: 6,
    why: 'Skewers appear constantly in endgames, where kings and rooks end up on the same lines and there are no pieces left to block.',
    steps: [
      {
        kind: 'read',
        heading: 'Pin or skewer?',
        body: [
          'Pin: the cheap piece is in front and cannot move. Skewer: the valuable piece is in front, must move, and exposes what is behind it.',
          'A check that also hits something behind the king is the purest form and the most common in practice.',
          'Endgames are where this decides games, because open lines are everywhere and blockers are gone.',
        ],
      },
      {
        kind: 'position',
        heading: 'Win the queen',
        fen: '8/8/8/4q3/4k3/8/8/1R4K1 w - - 0 1',
        prompt: 'White to play. The king and queen are on the same file.',
        solution: ['Re1+'],
        explain:
          'Re1 checks the king on e4 with the queen sitting behind it on e5. The king must step off the file and the rook takes the queen. Nothing could block, because the queen is behind the king rather than in front of it.',
      },
      {
        kind: 'checklist',
        heading: 'Prevention',
        items: [
          'In endgames, keep your king off the file or rank your rook sits on.',
          'Never leave your king and queen on the same line with a gap behind.',
          'Before every king move, check what is behind the destination square.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Skewer patterns, mostly from endgames.', tags: ['allowed-skewer', 'allowed-pin'], count: 6 },
    ],
  },
  {
    tag: 'discovered-attack',
    title: 'Discovered attacks',
    oneLiner: 'Move one piece and the piece behind it does the damage.',
    estMinutes: 7,
    why: 'Discoveries are hard to see because the attacking piece never moves. They punish players who only look at the piece that moved.',
    steps: [
      {
        kind: 'read',
        heading: 'The hidden attacker',
        body: [
          'A discovered attack happens when a piece steps off a line and reveals an attack from a piece behind it.',
          'It is especially nasty combined with a check: the front piece checks, you must respond, and the discovered attack collects something else.',
          'To spot them, look at lines rather than pieces. Any of your valuable pieces sharing a file, rank or diagonal with an enemy long-range piece is at risk, even if something is currently in the way.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Line audit',
        items: [
          'For each enemy rook, bishop and queen, trace its lines through blockers.',
          'Note anything of yours sitting on those lines behind a blocker.',
          'Ask whether the blocker can move with a threat — that is the discovery.',
          'Do the same for your own pieces; you probably have discoveries available too.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Discovered attacks from your games and matching patterns.', tags: ['discovered-attack'], count: 6 },
    ],
  },
  {
    tag: 'trapped-piece',
    title: 'Keep your pieces free',
    oneLiner: 'A piece with no safe squares is already lost.',
    estMinutes: 7,
    why: 'Trapped pieces are lost slowly and quietly — you get a move or two of warning, and most players spend it doing something else.',
    steps: [
      {
        kind: 'read',
        heading: 'How pieces get trapped',
        body: [
          'A piece is trapped when every square it can reach loses material. Usually it has wandered into enemy territory chasing a pawn.',
          'Bishops are trapped by pawn chains. Knights are trapped on the rim. Rooks are trapped grabbing pawns on the seventh rank. Queens are trapped everywhere, because everything attacks them.',
          'The warning sign is a piece far from your other pieces with few retreat squares.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Before you go pawn-hunting',
        items: [
          'Count the retreat squares the piece will have after it takes.',
          'Ask which enemy pawns can advance to take those squares away.',
          'Is the pawn worth two tempi and the risk?',
          'If a piece is already short of squares, spend a move fixing that before anything else.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Trap enemy pieces and rescue your own.', tags: ['trapped-piece'], count: 6 },
    ],
  },
  {
    tag: 'back-rank',
    title: 'Fix your back rank',
    oneLiner: 'One pawn move now prevents a lost game later.',
    estMinutes: 6,
    why: 'Back-rank mate is the most preventable loss in chess. The fix costs one tempo and you can play it almost any time.',
    steps: [
      {
        kind: 'read',
        heading: 'The pattern',
        body: [
          'You castle. Your three pawns stay put. Your king has no escape square. Any enemy rook or queen reaching the back rank is mate.',
          'The danger is not the mate itself — it is that every tactic in the position now works, because your defending pieces are tied to the back rank forever.',
          'That hidden cost is why strong players make luft early, well before there is a threat.',
        ],
      },
      {
        kind: 'position',
        heading: 'Deliver it once so you never allow it',
        fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
        prompt: 'White to play. Mate in one.',
        solution: ['Ra8#'],
        explain:
          'The rook lands on the back rank. The king cannot move — f8 is covered along the rank and g7/h7 are blocked by its own pawns. This is the position you must never allow, from either side.',
      },
      {
        kind: 'checklist',
        heading: 'Prevention',
        items: [
          'Play h3 (or ...h6) at a quiet moment. One tempo, permanent insurance.',
          'Before every trade of major pieces, ask whether your back rank survives without the piece you are giving up.',
          'Count the defenders of your back rank. If the answer is one, you have a problem.',
          'Watch for the deflection: your opponent does not need to invade, only to remove the defender.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Back-rank patterns from both sides.', tags: ['back-rank'], count: 6 },
    ],
  },
  {
    tag: 'missed-mate',
    title: 'Find forced mates',
    oneLiner: 'When the king is exposed, count checks before anything else.',
    estMinutes: 8,
    why: 'Missing a mate is the most expensive possible oversight: a won game becomes anything at all.',
    steps: [
      {
        kind: 'read',
        heading: 'Checks, captures, threats — in that order',
        body: [
          'When the enemy king has few escape squares, stop evaluating and start calculating. List every check you have and follow each one until it fails.',
          'Most missed mates are missed because the first move looks pointless — a quiet queen move, or a sacrifice that removes a defender.',
          'The signals to switch into calculation mode: the king has two or fewer escape squares, or you have two attackers near it and they have none.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Mate search',
        items: [
          'Count the enemy king\'s escape squares. Two or fewer means look for mate.',
          'List every check. Play each one out in your head, at least two moves deep.',
          'Consider sacrifices that remove a defender or open a line to the king.',
          'Ask which of your pieces is not helping, and whether it can join in one move.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Forced mates, including ones you had on the board.', tags: ['missed-mate', 'back-rank'], count: 8 },
    ],
  },
  {
    tag: 'allowed-mate',
    title: 'Notice when you are getting mated',
    oneLiner: 'Check your own king before you look at anything else.',
    estMinutes: 7,
    why: 'Allowing mate usually means you were attacking and stopped looking at your own position. It is an attention failure, not a calculation failure.',
    steps: [
      {
        kind: 'read',
        heading: 'Ask the opponent\'s question',
        body: [
          'Before you play a move, ask what your opponent would do if it were their turn right now. Not "what are they threatening" — what would they actually play?',
          'This one habit catches most mates, because mate needs a specific configuration and you will notice it when you look for it.',
          'The riskiest moment is when you are winning. Attacking players stop defending, and that is when mates land.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'King safety check',
        items: [
          'How many escape squares does my king have?',
          'How many enemy pieces are within two moves of it?',
          'Does the move I want to play remove a defender or open a line to my own king?',
          'Am I about to be mated on the back rank, on h7, or along an open file?',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Defend against mating attacks — and deliver them.', tags: ['allowed-mate', 'king-safety'], count: 8 },
    ],
  },
  {
    tag: 'ignored-threat',
    title: 'Answer the threat first',
    oneLiner: 'Your plan does not matter if their threat lands first.',
    estMinutes: 6,
    why: 'Playing your own plan while a real threat sits on the board is how good positions turn into lost ones in a single move.',
    steps: [
      {
        kind: 'read',
        heading: 'Every move is a question',
        body: [
          'Your opponent\'s last move did something. Before you continue your plan, work out what.',
          'Not every move contains a threat — but you must check, every time, or you will find out the hard way.',
          'When a threat is real, you have four answers: capture the attacker, block, move the target, or create a bigger threat. Count them all before choosing.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'After every opponent move',
        items: [
          'What does that move attack, directly?',
          'What does it attack indirectly, by opening a line?',
          'What did it stop defending?',
          'Is the threat bigger than my plan? If yes, deal with it.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Positions where you need to answer a threat, not continue a plan.', tags: ['ignored-threat', 'hanging-piece'], count: 6 },
    ],
  },
  {
    tag: 'unsound-sacrifice',
    title: 'Sacrifice only when you can see the end',
    oneLiner: 'Intuition is not a calculation.',
    estMinutes: 7,
    why: 'Hopeful sacrifices are how attacking players lose. The attack fizzles, and you are simply a piece down in an ordinary position.',
    steps: [
      {
        kind: 'read',
        heading: 'Two kinds of sacrifice',
        body: [
          'A concrete sacrifice ends in something you can name: mate, material back, or a winning position you can see. Calculate it to the end.',
          'A positional sacrifice buys a lasting asset — an open file to the king, a permanent bind, a passed pawn. Those are real, but they need justification you can state in words.',
          'If you can do neither, you are gambling. Play the good move instead; there almost always is one.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Before you give material',
        items: [
          'Can I name what I get? If the answer is "an attack", that is not specific enough.',
          'Calculate the forcing line to its end, including the opponent\'s best defence rather than the one you hope for.',
          'What happens if they simply give the material back at the right moment?',
          'If it does not work, what is my second-best move? Compare honestly.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Sound sacrifices — so you learn the difference.', tags: ['unsound-sacrifice', 'missed-mate'], count: 6 },
    ],
  },
];
