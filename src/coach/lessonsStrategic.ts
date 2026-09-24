import type { Lesson } from './lessonTypes';

export const STRATEGIC_LESSONS: Lesson[] = [
  {
    tag: 'king-safety',
    title: 'Keep your king safe',
    oneLiner: 'Castle early, and do not push the pawns in front of it without a reason.',
    estMinutes: 8,
    why: 'Every other advantage is conditional on your king surviving. King safety is the one factor that cannot be compensated.',
    steps: [
      {
        kind: 'read',
        heading: 'The pawn shield',
        body: [
          'Three pawns in front of a castled king, unmoved, is the strongest structure in chess. Every pawn you push creates a permanent hole.',
          'The most common self-inflicted wound is ...h6 or ...g6 played to stop a threat that was not real. You buy one tempo and sell a square forever.',
          'The exception is luft against back-rank mate — h3 or ...h6 at a quiet moment, when nothing is aiming at the kingside.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Before moving a pawn near your king',
        items: [
          'Is there a concrete threat, or does the move just feel useful?',
          'Which square am I giving up permanently, and can an enemy piece use it?',
          'Does my opponent have a bishop or queen aimed at the square this creates?',
          'Could I answer the threat by developing a piece instead?',
        ],
      },
      {
        kind: 'read',
        heading: 'Opposite-side castling',
        body: [
          'When kings castle on opposite wings, the game becomes a race and normal rules suspend. Pawn storms are correct, and defending passively loses.',
          'Count tempi rather than material. Whoever lands first wins, and a pawn is a small price for a move.',
          'When you castle on the same side, the opposite applies: pawn storms weaken your own king too.',
        ],
      },
      { kind: 'yours', heading: 'Your own examples', body: 'Moves from your games where king safety measurably dropped.' },
      { kind: 'drill', heading: 'Drill it', body: 'Attacking and defending exposed kings.', tags: ['king-safety', 'allowed-mate', 'back-rank'], count: 8 },
    ],
  },
  {
    tag: 'pawn-structure',
    title: 'Respect your pawn structure',
    oneLiner: 'Pawns cannot go back — every pawn move is permanent.',
    estMinutes: 9,
    why: 'Pawn weaknesses do not lose games immediately; they lose endgames. They are the damage you cannot repair.',
    steps: [
      {
        kind: 'read',
        heading: 'The three weaknesses',
        body: [
          'Isolated: no friendly pawn on either adjacent file. It must be defended by pieces forever, and the square in front of it becomes an enemy outpost.',
          'Doubled: two pawns on one file. They cannot defend each other and they cover fewer squares than they should.',
          'Backward: behind its neighbours on an open file, unable to advance safely. The worst of the three, because it is both weak and blockading.',
        ],
      },
      {
        kind: 'read',
        heading: 'When weaknesses are worth it',
        body: [
          'An isolated pawn in the middlegame often buys open lines and active pieces — that is the whole point of the isolated-queen\'s-pawn positions.',
          'Doubled pawns can be fine when they open a file for your rook, as in the Ruy López Exchange.',
          'The rule is: accept structural damage for activity, never for nothing. And remember that activity expires while the weakness does not.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Before a pawn move or a pawn trade',
        items: [
          'What squares does this pawn stop covering, permanently?',
          'Does the trade leave me with an isolated, doubled or backward pawn?',
          'Am I getting activity or an open file in exchange?',
          'If we reach an endgame, whose structure is better?',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Positions where structure decided the outcome.', tags: ['pawn-structure', 'bad-trade'], count: 6 },
    ],
  },
  {
    tag: 'development',
    title: 'Develop every piece before you attack',
    oneLiner: 'One piece per move, toward the centre, then castle.',
    estMinutes: 7,
    why: 'Almost every opening disaster traces back to attacking with two pieces while three sit at home.',
    steps: [
      {
        kind: 'read',
        heading: 'The rules exist for a reason',
        body: [
          'Move each piece once before moving any piece twice. Every repeat move is a tempo your opponent spends developing.',
          'Knights before bishops, because you know where the knights belong before you know where the bishops do.',
          'Castle by move ten unless you have a concrete reason not to. "I want to keep options open" is not a concrete reason.',
          'Do not move the same pawn twice in the opening without a purpose, and do not bring the queen out early.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Opening audit at move ten',
        items: [
          'How many pieces have I developed? How many has my opponent?',
          'Am I castled?',
          'Are both rooks connected?',
          'Which piece is my worst, and what is its best square?',
        ],
      },
      {
        kind: 'read',
        heading: 'Punishing slow development',
        body: [
          'When you are ahead in development, open the position. Trades and open lines favour the side with more pieces in play.',
          'When you are behind, do the opposite: keep the position closed, decline trades that cost time, and catch up.',
          'A lead in development is temporary. Use it or lose it.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Punish underdeveloped positions.', tags: ['development', 'premature-queen', 'lost-the-initiative'], count: 6 },
    ],
  },
  {
    tag: 'premature-queen',
    title: 'Leave the queen at home',
    oneLiner: 'Your most valuable piece is the worst attacker in the opening.',
    estMinutes: 5,
    why: 'An early queen gets chased by minor pieces. Every time it runs, your opponent develops for free.',
    steps: [
      {
        kind: 'read',
        heading: 'Why it backfires',
        body: [
          'The queen is worth nine points, so a pawn or a knight can attack it and it must move. Your opponent develops while you retreat.',
          'Early queen raids (Qh5, Qf3 aiming at f7) do contain a one-move threat. Almost any developing move answers it, and then you are worse.',
          'The exception is a concrete tactic you have calculated, or a specific opening where the queen sortie is theory — the Scandinavian, for example.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Before moving the queen before move ten',
        items: [
          'Can a pawn or knight attack it where it is going?',
          'Is the threat I am making answerable by a developing move?',
          'Would developing a piece be better?',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Punish early queen sorties.', tags: ['premature-queen', 'development'], count: 6 },
    ],
  },
  {
    tag: 'bad-trade',
    title: 'Trade the right pieces',
    oneLiner: 'An even trade of material can still be a losing trade.',
    estMinutes: 8,
    why: 'Trades are irreversible and most players make them for the wrong reason: because they are available.',
    steps: [
      {
        kind: 'read',
        heading: 'Who wants the trade?',
        body: [
          'If you are cramped, trade — every trade gives your remaining pieces more room. If you have more space, avoid trades and keep the bind.',
          'If you are ahead in material, trade pieces and head for an endgame. If behind, keep pieces on and play for complications.',
          'Trade your bad pieces for their good ones. A bishop stuck behind your own pawns for their active knight is a fine trade at equal material.',
        ],
      },
      {
        kind: 'read',
        heading: 'Bishops and knights',
        body: [
          'Bishops are better in open positions and better as a pair. Knights are better in closed positions and on outposts.',
          'Giving up the two bishops needs a reason: damage to their structure, an outpost, or a concrete tactic.',
          'A knight on a protected central square your pawns cannot be driven from is often worth more than a bishop.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Before any trade',
        items: [
          'Which of us has less space? That player wants the trade.',
          'Is the piece I am giving up better or worse than the one I get?',
          'What does the resulting structure look like, and who does it favour?',
          'Am I trading a defender of my king?',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Trade decisions from your own games.', tags: ['bad-trade', 'pawn-structure'], count: 6 },
    ],
  },
  {
    tag: 'weak-square',
    title: 'Do not concede squares',
    oneLiner: 'A square your pawns can never attack again belongs to your opponent.',
    estMinutes: 7,
    why: 'Outposts are how positional games are won. A knight on a permanent central square can be worth more than a rook.',
    steps: [
      {
        kind: 'read',
        heading: 'What makes a square weak',
        body: [
          'A square is weak for you when no pawn of yours can ever attack it again — the pawns that would have done the job have advanced past it or been traded.',
          'Weak squares only matter when the enemy can occupy them. A weak square in the middle of your position, reachable by a knight, is a real problem.',
          'Every pawn advance creates weak squares behind it. That is the permanent cost of gaining space.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Square audit',
        items: [
          'After a pawn move, which squares can my pawns no longer reach?',
          'Can an enemy knight get to one of them in two moves?',
          'Do I have a piece or pawn that can cover it instead?',
          'Conversely: which enemy squares are weak, and can I put a knight there?',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Occupy outposts and deny theirs.', tags: ['weak-square', 'pawn-structure'], count: 6 },
    ],
  },
  {
    tag: 'lost-the-initiative',
    title: 'Keep the initiative',
    oneLiner: 'Passive moves hand the game to your opponent for free.',
    estMinutes: 8,
    why: 'Drifting is the most common way a good position becomes equal, and an equal one becomes worse. No single move looks bad.',
    steps: [
      {
        kind: 'read',
        heading: 'Always have a plan',
        body: [
          'A plan does not need to be deep. "Put my rook on the open file", "improve my worst piece", "prepare c5" are all real plans.',
          'The alternative to a plan is shuffling, and shuffling loses. Your opponent improves while you wait.',
          'When you genuinely do not know what to do, improve your worst-placed piece. It is almost never wrong.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'When you do not know what to play',
        items: [
          'Which of my pieces is worst placed, and where does it belong?',
          'Which file or diagonal could I open in my favour?',
          'What is my opponent\'s plan, and can I take it away cheaply?',
          'Is there a pawn break available, and is it good for me?',
        ],
      },
      {
        kind: 'read',
        heading: 'Prophylaxis',
        body: [
          'The strongest players spend moves stopping ideas that have not happened yet. Ask what your opponent wants to do, then make it impossible.',
          'This feels slow and wins games. A move that removes your opponent\'s only plan is worth more than a move that advances yours slightly.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Find the active move.', tags: ['lost-the-initiative', 'development'], count: 6 },
    ],
  },
  {
    tag: 'converting-advantage',
    title: 'Convert winning positions',
    oneLiner: 'When you are winning, simplify — do not attack.',
    estMinutes: 9,
    why: 'Failing to convert is the most frustrating way to lose rating, and it is almost entirely about technique rather than strength.',
    steps: [
      {
        kind: 'read',
        heading: 'Change gear when you are ahead',
        body: [
          'A material advantage is converted by trading pieces, not by attacking. Every trade makes your extra piece more decisive.',
          'Trade pieces, keep pawns. A piece up in an endgame with pawns wins easily; a piece up with no pawns can be a draw.',
          'Avoid complications on principle. You do not need brilliance — you need the position to get simpler.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Winning-position technique',
        items: [
          'Can I trade a pair of pieces safely? If yes, usually do it.',
          'Is my king safe? Fix that before anything ambitious.',
          'Am I still looking at my opponent\'s threats? Winning players stop looking.',
          'Would the simple, boring move win? Then play it.',
        ],
      },
      {
        kind: 'read',
        heading: 'The psychology',
        body: [
          'Most botched conversions come from relaxing, from wanting a pretty finish, or from rushing because you want it over.',
          'A won position is when to slow down, not speed up. The clock is a real factor — leave yourself time for the conversion.',
        ],
      },
      { kind: 'yours', heading: 'Your own examples', body: 'Games where you were clearly winning and the evaluation collapsed.' },
      { kind: 'drill', heading: 'Drill it', body: 'Convert winning positions cleanly.', tags: ['converting-advantage', 'endgame-technique'], count: 6 },
    ],
  },
  {
    tag: 'defending-worse',
    title: 'Defend worse positions properly',
    oneLiner: 'When you are worse, make your opponent prove it.',
    estMinutes: 8,
    why: 'Bad positions are lost twice: once by the mistake that caused them, and again by panicking afterwards.',
    steps: [
      {
        kind: 'read',
        heading: 'Active defence',
        body: [
          'Passive defence loses slowly. Look for counterplay — a pawn break, a piece that can become annoying, a trade that changes the structure.',
          'Trade pawns when a piece down; trade pieces when a pawn down. Fewer pawns favours the defender; fewer pieces favours the material leader.',
          'Set problems. A move that gives your opponent a choice is worth more than the objectively best move that gives them none.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'When you are worse',
        items: [
          'What is my opponent\'s plan, and what is the cheapest way to stop it?',
          'Do I have any counterplay at all? Prefer active over passive.',
          'Which trades help me? Make those; refuse the rest.',
          'Is there a fortress or a known drawn endgame I can head for?',
        ],
      },
      {
        kind: 'read',
        heading: 'Do not compound it',
        body: [
          'The worst habit in a bad position is the desperate sacrifice. It converts "worse" into "lost".',
          'Being a pawn down is not lost. Play solid moves, stay alert, and give your opponent the chance to err — most opponents do.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Find the best defensive resource.', tags: ['defending-worse', 'king-safety'], count: 6 },
    ],
  },
  {
    tag: 'endgame-technique',
    title: 'Learn the endgames that matter',
    oneLiner: 'A handful of positions decide a large share of your games.',
    estMinutes: 12,
    why: 'Endgames are the most learnable part of chess: the positions are concrete and the knowledge never goes out of date.',
    steps: [
      {
        kind: 'read',
        heading: 'King activity comes first',
        body: [
          'In the endgame the king is a strong piece. Centralise it as soon as the queens are off — an inactive king is usually the whole reason an endgame is lost.',
          'The rule that follows: push the king before the pawn. A pawn that runs ahead of its king is usually stopped.',
        ],
      },
      {
        kind: 'position',
        heading: 'King before pawn',
        fen: '8/8/8/3k4/8/8/3PK3/8 w - - 0 1',
        prompt: 'White to play. Exactly one move wins — every other try is a draw.',
        solution: ['Kd3'],
        explain:
          'Kd3 steps in front of the pawn and takes the opposition: Black must give way, and the king escorts the pawn home. Ke3, Kf3 and pushing the pawn are all dead draws, because Black\'s king gets in front of it. King before pawn — this single idea decides more endgames than any other.',
      },
      {
        kind: 'checklist',
        heading: 'The endgames worth memorising',
        items: [
          'King and pawn versus king: the square rule, and the key squares in front of the pawn.',
          'Rook and pawn versus rook: the Lucena position (winning) and the Philidor position (drawing).',
          'Which pawnless endings are drawn: two knights, bishop and knight against a competent defender.',
          'Rook endgames: the rook belongs behind a passed pawn, yours or theirs.',
        ],
      },
      {
        kind: 'read',
        heading: 'Rook endgames are half of all endgames',
        body: [
          'If you learn one endgame properly, make it rook and pawn versus rook. Philidor draws it when defending; Lucena wins it when attacking.',
          'Active rooks matter more than pawns here. A passive rook defending a pawn usually loses anyway.',
          'Cut the enemy king off from the action. A king separated from the pawns is a spectator.',
        ],
      },
      { kind: 'drill', heading: 'Drill it', body: 'Endgame positions from your own games.', tags: ['endgame-technique', 'converting-advantage'], count: 8 },
    ],
  },
  {
    tag: 'time-trouble',
    title: 'Manage the clock',
    oneLiner: 'Losing on time is losing. Spend your thinking where it pays.',
    estMinutes: 7,
    why: 'If your mistakes cluster in moves you played in under three seconds, your problem is time management, not chess.',
    steps: [
      {
        kind: 'read',
        heading: 'Spend time where it matters',
        body: [
          'Opening moves you know should take seconds. Save the time for the first genuinely unclear position.',
          'The moments that deserve real time: when the position changes character, when a forcing line appears, and when you are about to make an irreversible decision like a trade or a pawn push.',
          'Moving instantly in a complicated position is the most expensive habit in fast chess.',
        ],
      },
      {
        kind: 'checklist',
        heading: 'Clock discipline',
        items: [
          'Play your known opening moves quickly and deliberately.',
          'Before any capture or pawn push, take one breath and check it. These are the irreversible moves.',
          'When short of time, prefer forcing moves and simplification — they need less calculation.',
          'Do not think on your opponent\'s move about what you will play; think about what they might.',
        ],
      },
      {
        kind: 'yours',
        heading: 'Your own examples',
        body: 'Mistakes you made under time pressure, where the PGN recorded your clock.',
      },
      { kind: 'drill', heading: 'Drill it', body: 'Fast pattern recognition — try the Rush mode to build speed safely.', tags: ['time-trouble', 'hanging-piece'], count: 8 },
    ],
  },
];
