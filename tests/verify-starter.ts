import { Chess } from 'chess.js';
import { STARTER_PUZZLES } from '../src/coach/starterPuzzles';
let bad = 0;
for (const p of STARTER_PUZZLES) {
  const c = new Chess(p.fen);
  if (c.turn() !== p.solverColor) { console.log('WRONG TURN', p.id); bad++; }
  for (const san of p.solution) { try { c.move(san); } catch { console.log('ILLEGAL', p.id, san); bad++; break; } }
  if (p.solution.length % 2 === 0) { console.log('EVEN SOLUTION', p.id); bad++; }
}
console.log(`${STARTER_PUZZLES.length} puzzles, ${bad} problems`);
console.log('ratings:', STARTER_PUZZLES.map(p=>p.rating).sort((a,b)=>a-b).join(' '));
console.log('\nsample:'); const s = STARTER_PUZZLES[3];
console.log(JSON.stringify({fen:s.fen, solution:s.solution, tags:s.tags, rating:s.rating, prompt:s.prompt, explanation:s.explanation}, null, 1));
