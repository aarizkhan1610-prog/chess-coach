import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Board, type BoardHighlight } from './Board';
import { Pill, Spinner } from './ui';
import { useCoach, type CoachOptions } from '../coach/useCoach';
import { useStore } from '../state/store';
import type { Tone } from '../coach/explain';
import type { Color } from '../types';

/**
 * The board, plus a coach that reacts to whatever you play.
 *
 * Both halves of the exchange matter. The learner is never blocked from making
 * a move, and never made to live with one either: every verdict comes with the
 * option to take it back, so trying a bad move on purpose is a cheap way to
 * find out why it is bad.
 */

const TONE: Record<Tone, { label: string; cls: string }> = {
  excellent: { label: 'Strong move', cls: 'tone-great' },
  good: { label: 'Good', cls: 'tone-good' },
  ok: { label: 'Playable', cls: 'tone-ok' },
  dubious: { label: 'Loose', cls: 'tone-warn' },
  bad: { label: 'Costly', cls: 'tone-bad' },
  losing: { label: 'Loses', cls: 'tone-bad' },
};

export interface CoachedBoardProps extends CoachOptions {
  /** Shown above the board while it is the learner's turn. */
  prompt: ReactNode;
  orientation?: Color;
  /** Rendered under the coach panel, e.g. a "next" button. */
  footer?: ReactNode;
}

export function CoachedBoard({ prompt, orientation = 'w', footer, ...options }: CoachedBoardProps) {
  const coach = useCoach(options);
  const markTaught = useStore((s) => s.markTaught);

  const { explanation: x, phase } = coach;

  /*
   * A rule is shown once, the first time a move demonstrates it.
   *
   * It is held in state rather than derived from the store, because marking it
   * taught is exactly the thing that would make a derived value disappear: the
   * rule would be removed from the screen by the act of recording that it had
   * been shown. The store is read imperatively for the same reason — this
   * should re-run when the explanation changes, and at no other time.
   */
  const [rule, setRule] = useState<{ code: string; text: string } | null>(null);

  useEffect(() => {
    if (!x) { setRule(null); return; }
    const already = useStore.getState().taught;
    const point = x.points.find((p) => p.principle && !already[p.code]);
    if (!point) { setRule(null); return; }
    setRule({ code: point.code, text: point.principle as string });
    markTaught(point.code);
  }, [x, markTaught]);

  const highlights = useMemo<BoardHighlight[]>(() => {
    if (!x || coach.previewing) return [];
    const bad = x.tone === 'bad' || x.tone === 'losing' || x.tone === 'dubious';
    const colour = bad ? 'var(--bad)' : 'var(--good)';
    return (x.points[0]?.squares ?? []).map((square) => ({ square, color: colour }));
  }, [x, coach.previewing]);

  const arrows = useMemo(() => {
    if (!x || coach.previewing) return [];
    const a = x.points[0]?.arrow;
    return a ? [{ from: a.from, to: a.to, color: 'var(--bad)' }] : [];
  }, [x, coach.previewing]);

  const tone = x ? TONE[x.tone] : null;

  /* The move that put the learner back on turn, so the caption can report it. */
  const reply =
    options.userSide !== 'both' && phase === 'yours' && coach.history.length > 0
      ? coach.history[coach.history.length - 1]
      : null;

  return (
    <div className="train">
      <div className="train-board">
        <Board
          fen={coach.shownFen}
          orientation={orientation}
          movable={phase === 'yours' ? (options.userSide ?? 'w') : 'none'}
          onMove={(m) => coach.tryMove({ from: m.from, to: m.to, promotion: m.promotion })}
          lastMove={coach.lastMove}
          highlights={highlights}
          arrows={arrows}
          coordinates
        />
        <div className="train-caption">
          <span>
            {coach.previewing
              ? 'This is what happens next.'
              : phase === 'over'
                ? coach.result
                : phase === 'theirs'
                  ? 'Your opponent is thinking…'
                  : coach.candidate
                    ? `You played ${coach.candidate}.`
                    : reply
                      ? `Your opponent played ${reply}.`
                      : prompt}
          </span>
          {coach.history.length > 0 && <Pill>{`Move ${Math.floor(coach.history.length / 2) + 1}`}</Pill>}
        </div>
      </div>

      <div className="train-panel">
        {phase === 'thinking' && (
          <div className="coach-card">
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <Spinner /> <span className="dim small">Looking at {coach.candidate}…</span>
            </div>
          </div>
        )}

        {phase === 'yours' && !x && (
          <div className="coach-card coach-idle">
            <div className="coach-prompt">{prompt}</div>
            <p className="small dim">
              Play anything you like. Nothing is locked, and you can always take a move back.
            </p>
          </div>
        )}

        {phase === 'verdict' && x && tone && (
          <div className={`coach-card fade-in ${tone.cls}`}>
            <div className="coach-verdict">
              <span className="coach-tone">{tone.label}</span>
              {coach.candidate && <span className="mono coach-move">{coach.candidate}</span>}
              {x.materialSwing <= -1 && (
                <span className="coach-cost">{`−${Math.abs(Math.round(x.materialSwing))} points`}</span>
              )}
            </div>

            <p className="coach-headline">{x.headline}</p>

            {x.points.slice(1).map((p) => (
              <p key={p.code} className="small coach-extra">{p.text}</p>
            ))}

            {x.concession && <p className="small dim coach-extra">{`It does do one thing right: ${x.concession}`}</p>}

            {rule && (
              <div className="coach-rule">
                <span className="coach-rule-tag">The rule</span>
                <span>{rule.text}</span>
              </div>
            )}

            {x.better && (
              <p className="small dim coach-extra">
                The strongest move was <span className="mono">{x.better.san}</span>.
              </p>
            )}

            <div className="row wrap coach-actions">
              {x.punish && (
                <button className="btn sm" onClick={coach.togglePunishment}>
                  {coach.previewing ? 'Back' : 'Show me'}
                </button>
              )}
              <button className="btn sm" onClick={coach.undo}>Take it back</button>
              <button className="btn primary sm" onClick={coach.keep}>Keep it</button>
            </div>
          </div>
        )}

        {phase === 'theirs' && (
          <div className="coach-card">
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <Spinner /> <span className="dim small">Your opponent is replying…</span>
            </div>
          </div>
        )}

        {phase === 'over' && (
          <div className="coach-card">
            <p className="coach-headline">{coach.result}</p>
            <button className="btn sm" onClick={coach.reset}>Play it again</button>
          </div>
        )}

        {coach.history.length > 0 && (
          <div className="coach-moves mono small dim">
            {coach.history.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san)).join(' ')}
          </div>
        )}

        {footer}
      </div>
    </div>
  );
}
