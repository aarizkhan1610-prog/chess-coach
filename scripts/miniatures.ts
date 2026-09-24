/**
 * Short games used to build the bundled starter puzzle pack. Each one contains
 * at least one decisive error, so the analyser can mine puzzles from it.
 * Every line is replayed for legality before use.
 */
export interface Miniature {
  name: string;
  pgn: string;
}

const g = (name: string, headers: string, moves: string): Miniature => ({
  name,
  pgn: `[Event "${name}"]\n[White "White"]\n[Black "Black"]\n${headers}\n\n${moves}`,
});

export const MINIATURES: Miniature[] = [
  g("Scholar's Mate", '[Result "1-0"]', '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0'),
  g("Légal's Mate", '[Result "1-0"]',
    '1. e4 e5 2. Nf3 Nc6 3. Bc4 d6 4. Nc3 Bg4 5. h3 Bh5 6. Nxe5 Bxd1 7. Bxf7+ Ke7 8. Nd5# 1-0'),
  g('Fried Liver Attack', '[Result "1-0"]',
    '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3 Nce7 9. d4 c6 10. Bg5 h6 11. Bxe7 Bxe7 12. O-O-O Rf8 13. Qe4 1-0'),
  g('Elephant Trap', '[Result "0-1"]',
    '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Nbd7 5. cxd5 exd5 6. Nxd5 Nxd5 7. Bxd8 Bb4+ 8. Qd2 Bxd2+ 9. Kxd2 Kxd8 0-1'),
  g("Noah's Ark Trap", '[Result "0-1"]',
    '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 d6 5. d4 b5 6. Bb3 Nxd4 7. Nxd4 exd4 8. Qxd4 c5 9. Qd5 Be6 10. Qc6+ Bd7 11. Qd5 c4 0-1'),
  g('Blackburne Shilling Gambit', '[Result "0-1"]',
    '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3# 0-1'),
  g('Lasker Trap', '[Result "0-1"]',
    '1. d4 d5 2. c4 e5 3. dxe5 d4 4. e3 Bb4+ 5. Bd2 dxe3 6. Bxb4 exf2+ 7. Ke2 fxg1=N+ 0-1'),
  g('Opera Game', '[Result "1-0"]',
    '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0'),
  g('Damiano Defence refuted', '[Result "1-0"]',
    '1. e4 e5 2. Nf3 f6 3. Nxe5 fxe5 4. Qh5+ Ke7 5. Qxe5+ Kf7 6. Bc4+ Kg6 7. Qf5+ Kh6 8. d4+ g5 9. h4 Kg7 10. Qf7+ Kh6 11. hxg5# 1-0'),
  g('Back-rank collapse', '[Result "1-0"]\n[SetUp "1"]\n[FEN "r5k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1"]',
    '1... Ra5 2. Rd8# 1-0'),
  g('Hanging piece in the Italian', '[Result "0-1"]',
    '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Nxe5 Nxe5 5. d4 Bb4+ 6. c3 Bd6 7. dxe5 Bxe5 0-1'),
  g('Queen sortie punished', '[Result "0-1"]',
    '1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6 4. Bb5 Bc5 5. Nxe5 Nxe5 6. d4 Qe7 7. dxc5 Qxc5 0-1'),
  g('Pin exploited', '[Result "1-0"]\n[SetUp "1"]\n[FEN "4k3/8/2n5/1B6/3P4/8/8/4K3 b - - 0 1"]',
    '1... Ke7 2. d5 Kd6 3. dxc6 Kc7 1-0'),
  g('Skewer on the e-file', '[Result "1-0"]\n[SetUp "1"]\n[FEN "8/8/8/4q3/4k3/8/8/1R4K1 b - - 0 1"]',
    '1... Kd4 2. Rd1+ Kc5 3. Rd5+ Kc6 4. Rxe5 1-0'),
  g('Endgame technique', '[Result "1-0"]\n[SetUp "1"]\n[FEN "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1"]',
    '1. e4 Kd4 2. Kd2 Ke5 3. Ke3 Kd6 4. Kf4 Ke6 1-0'),
  g('Greek gift refused', '[Result "0-1"]',
    '1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. e5 Nfd7 5. f4 c5 6. Nf3 Nc6 7. Be3 Qb6 8. Na4 Qa5+ 9. c3 cxd4 10. b4 Nxb4 11. cxb4 Bxb4+ 0-1'),
  g('Trapped bishop', '[Result "0-1"]',
    '1. d4 d5 2. c4 dxc4 3. e3 b5 4. a4 c6 5. axb5 cxb5 6. Qf3 Nc6 7. Qxc6+ Bd7 8. Qxc4 bxc4 0-1'),
];
