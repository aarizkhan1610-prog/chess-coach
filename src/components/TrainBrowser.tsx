import { useMemo, useState, type ReactNode } from 'react';
import { Chess } from 'chess.js';
import { Board } from './Board';
import { Pill, navigate } from './ui';
import type { Color } from '../types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface TrainNode {
  id: string;
  label: string;
  /** Right-aligned, usually a count. */
  meta?: string;
  /** Second line under the label. */
  detail?: string;
  /** SAN moves from the start position, shown on the board for this row. */
  preview?: string[];
  /** A position that cannot be reached by moves from the start. Wins over `preview`. */
  fen?: string;
  /** Overrides the line printed under the board. */
  caption?: string;
  /** Orientation to show the preview from. */
  orientation?: Color;
  /** Drill down into these. */
  children?: TrainNode[];
  /** Leaf: choosing this row goes here. */
  href?: string;
  /** Leaf: shown beneath the list once selected. */
  summary?: ReactNode;
  /** Leaf: label for the confirm button. */
  cta?: string;
}

/** Replay SAN from the start; returns the start position if anything is off. */
function fenFor(moves: string[] | undefined): { fen: string; last: { from: string; to: string } | null } {
  if (!moves?.length) return { fen: START, last: null };
  const c = new Chess();
  let last: { from: string; to: string } | null = null;
  for (const san of moves) {
    try {
      const m = c.move(san);
      last = { from: m.from, to: m.to };
    } catch {
      break;
    }
  }
  return { fen: c.fen(), last };
}

function numbered(moves: string[] | undefined): string {
  if (!moves?.length) return 'Starting position';
  return moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m}` : m)).join(' ');
}

/**
 * A board on the left, one list of choices on the right.
 *
 * The whole point is that only one level is on screen at a time: you pick a
 * category, that category's contents replace it, and the board keeps up so the
 * choice is never abstract. Going back is always one click.
 */
export function TrainBrowser({
  rootLabel,
  roots,
  intro,
  children: extra,
}: {
  /** Breadcrumb label for the top level. */
  rootLabel: string;
  roots: TrainNode[];
  /** Shown above the list at the top level only. */
  intro?: ReactNode;
  children?: ReactNode;
}) {
  const [trail, setTrail] = useState<TrainNode[]>([]);
  const [selected, setSelected] = useState<TrainNode | null>(null);

  const level = trail.length ? (trail[trail.length - 1].children ?? []) : roots;
  const current = trail[trail.length - 1] ?? null;

  // The board follows the selected row, falling back to the level you are in.
  const shown = selected ?? current;
  const { fen, last } = useMemo(() => {
    if (shown?.fen) return { fen: shown.fen, last: null };
    return fenFor(shown?.preview);
  }, [shown]);
  const orientation: Color = shown?.orientation ?? 'w';
  const caption = shown?.caption ?? numbered(shown?.preview);

  function open(node: TrainNode) {
    if (node.children?.length) {
      setTrail((t) => [...t, node]);
      setSelected(null);
      return;
    }
    if (node.summary || node.cta) {
      setSelected((s) => (s?.id === node.id ? null : node));
      return;
    }
    if (node.href) navigate(node.href);
  }

  function back() {
    setTrail((t) => t.slice(0, -1));
    setSelected(null);
  }

  return (
    <div className="train">
      <div className="train-board">
        <Board fen={fen} orientation={orientation} lastMove={last} movable="none" coordinates />
        <div className="train-caption">
          <span className={shown?.caption ? '' : 'mono'}>{caption}</span>
          {shown?.orientation === 'b' && <Pill>Black&rsquo;s view</Pill>}
        </div>
      </div>

      <div className="train-panel">
        <nav className="train-crumbs">
          <button className="crumb" onClick={() => { setTrail([]); setSelected(null); }} disabled={!trail.length}>
            {rootLabel}
          </button>
          {trail.map((node, i) => (
            <span key={node.id} className="crumb-part">
              <span className="crumb-sep" aria-hidden>/</span>
              <button
                className="crumb"
                onClick={() => { setTrail((t) => t.slice(0, i + 1)); setSelected(null); }}
                disabled={i === trail.length - 1}
              >
                {node.label}
              </button>
            </span>
          ))}
        </nav>

        {trail.length > 0 && (
          <button className="btn sm ghost train-back" onClick={back}>
            ← Back to {trail.length > 1 ? trail[trail.length - 2].label : rootLabel}
          </button>
        )}

        {trail.length === 0 && intro}

        <ul className="train-list">
          {level.map((node) => {
            const isSelected = selected?.id === node.id;
            return (
              <li key={node.id}>
                <button
                  className={`train-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => open(node)}
                  onMouseEnter={() => { if (!node.children?.length) setSelected(node); }}
                >
                  <span className="train-row-text">
                    <span className="train-row-label">{node.label}</span>
                    {node.detail && <span className="train-row-detail">{node.detail}</span>}
                  </span>
                  {node.meta && <span className="train-row-meta">{node.meta}</span>}
                  <span className="train-row-arrow" aria-hidden>{node.children?.length ? '›' : '→'}</span>
                </button>

                {isSelected && (
                  <div className="train-detail fade-in">
                    {node.summary}
                    {node.href && (
                      <button className="btn primary sm" style={{ marginTop: 10, width: '100%' }} onClick={() => navigate(node.href!)}>
                        {node.cta ?? 'Open'} →
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {level.length === 0 && <div className="small dim" style={{ padding: '10px 2px' }}>Nothing here yet.</div>}

        {extra}
      </div>
    </div>
  );
}
