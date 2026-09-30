import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoachView } from './CoachedBoard';
import { Pill, navigate } from './ui';
import { useCoach } from '../coach/useCoach';
import { sameMove, type GuidedGame as Game } from '../coach/guidedGame';
import { useStore } from '../state/store';

/**
 * A famous game, replayed from the winning side, with the reasoning attached.
 *
 * The learner is asked what the position needs before they move, told how their
 * answer compares with the one that was played, and left to choose. Keep a
 * different move and the script is over — the opponent becomes the engine and
 * the coach keeps working, because a lesson that punishes curiosity is not
 * worth having. Take it back and the game carries on as it was.
 */
export function GuidedGameBoard({ game }: { game: Game }) {
  const markDone = useStore((s) => s.markBasicDone);
  /** Set the moment a kept move differs from the script. Never unset. */
  const [offScript, setOffScript] = useState(false);
  const [beaten, setBeaten] = useState(false);

  /**
   * How many of the learner's moves have been kept. It is derived from the
   * move list rather than counted separately, so a take-back cannot leave the
   * script pointing at the wrong move.
   */
  const [ply, setPly] = useState(0);
  const step = game.moves[ply];
  const free = ply >= game.freeFrom;

  const opponentMove = useCallback(
    (_fen: string, history: string[]) => {
      if (offScript) return null;
      const index = Math.floor((history.length - 1) / 2);
      return game.moves[index]?.reply ?? null;
    },
    [game, offScript],
  );

  const coach = useCoach({
    userSide: game.hero,
    opponentSkill: 8,
    opponentMove,
  });

  const matched = coach.candidate && step ? sameMove(coach.candidate, step.san) : false;

  const keep = useCallback(() => {
    if (!matched) setOffScript(true);
    setPly((n) => n + 1);
    coach.keep();
  }, [matched, coach]);

  const restart = useCallback(() => {
    setOffScript(false);
    setBeaten(false);
    setPly(0);
    coach.reset();
  }, [coach]);

  /* Delivering the mate is the whole point, so it is worth marking. */
  const won = Boolean(
    coach.phase === 'over'
    && coach.result?.includes('checkmate')
    && !coach.result.startsWith(game.hero === 'w' ? 'Black' : 'White'),
  );

  // In an effect, not during render: writing to the store while rendering the
  // component that reads it is how a render loop starts.
  useEffect(() => {
    if (won && !beaten) {
      setBeaten(true);
      markDone(`guided-${game.id}`);
    }
  }, [won, beaten, markDone, game.id]);

  const prompt = useMemo(() => {
    if (!step) return 'Play on.';
    if (offScript) return 'Your game now. Play whatever you think is best.';
    if (free) return game.freeBrief;
    return step.idea;
  }, [step, free, offScript, game.freeBrief]);

  const progress = Math.min(ply, game.moves.length);

  return (
    <div>
      <div className="row wrap guided-status">
        <Pill>{`Move ${progress + (progress < game.moves.length ? 1 : 0)} of ${game.moves.length}`}</Pill>
        {offScript ? (
          <span className="tiny faint">Off the game — your opponent is the engine now.</span>
        ) : free ? (
          <span className="tiny" style={{ color: 'var(--v-brilliant)' }}>No more hints. Find the mate.</span>
        ) : (
          <span className="tiny faint">Following the 1858 game.</span>
        )}
      </div>

      <CoachView
        coach={coach}
        prompt={prompt}
        userSide={game.hero}
        orientation={game.hero}
        idle={
          free || offScript ? (
            <p className="small dim">Nothing is locked, and you can always take a move back.</p>
          ) : (
            <p className="small dim">
              Work it out before you look. Play what you think, and you will be told how it compares.
            </p>
          )
        }
        verdictExtra={
          step && !offScript ? (
            <div className={`guided-compare ${matched ? 'match' : ''}`}>
              <span className="guided-compare-tag">
                {matched ? 'That is the move' : free ? 'The game went' : `${game.title} went`}
              </span>
              {matched ? (
                <span>{step.why}</span>
              ) : (
                <span>
                  <span className="mono">{step.san}</span> was played here. {step.why}
                </span>
              )}
            </div>
          ) : null
        }
        undoLabel={!matched && !offScript && step ? 'Back to the game' : 'Take it back'}
        over={
          <div className="coach-card tone-great">
            <p className="coach-headline">
              {won
                ? 'Checkmate. That is the finish Morphy played in 1858, and you found it yourself.'
                : coach.result}
            </p>
            <div className="row wrap coach-actions">
              <button className="btn sm" onClick={restart}>Play it again</button>
              <button className="btn primary sm" onClick={() => navigate('/basics/play')}>
                Play your own game →
              </button>
            </div>
          </div>
        }
        onKeep={keep}
        keepLabel={coach.endsGame ? 'Finish the game' : matched ? 'Play it' : 'Keep my move'}
        footer={
          <div className="guided-foot">
            <button className="btn sm ghost" onClick={restart}>Start the game over</button>
          </div>
        }
      />
    </div>
  );
}
