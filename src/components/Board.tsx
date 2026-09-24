import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Color, PieceType, Square } from '../types';
import { Piece, PieceIcon } from './Pieces';
import { fileOf, rankOf, toSquare } from '../chess/board';

const SQ = 45;
const SIZE = SQ * 8;

export interface BoardArrow {
  from: Square;
  to: Square;
  color?: string;
}
export interface BoardHighlight {
  square: Square;
  color: string;
}
export interface BoardMove {
  from: Square;
  to: Square;
  promotion?: string;
  san: string;
  fenAfter: string;
}

export interface BoardProps {
  fen: string;
  orientation?: Color;
  /** Which side the user may move. 'none' makes the board read-only. */
  movable?: Color | 'both' | 'none';
  onMove?: (move: BoardMove) => void;
  lastMove?: { from: Square; to: Square } | null;
  arrows?: BoardArrow[];
  highlights?: BoardHighlight[];
  coordinates?: boolean;
  /** Dots on legal destinations for the selected piece. */
  showLegal?: boolean;
  /** Extra class on the wrapper. */
  className?: string;
}

function squareToXY(sq: Square, orientation: Color): { x: number; y: number } {
  const f = fileOf(sq);
  const r = rankOf(sq);
  return orientation === 'w'
    ? { x: f * SQ, y: (7 - r) * SQ }
    : { x: (7 - f) * SQ, y: r * SQ };
}

function xyToSquare(px: number, py: number, orientation: Color): Square | null {
  const col = Math.floor(px / SQ);
  const row = Math.floor(py / SQ);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return orientation === 'w' ? toSquare(col, 7 - row) : toSquare(7 - col, row);
}

export function Board({
  fen,
  orientation = 'w',
  movable = 'none',
  onMove,
  lastMove,
  arrows = [],
  highlights = [],
  coordinates = true,
  showLegal = true,
  className,
}: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [drag, setDrag] = useState<{ from: Square; x: number; y: number } | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen]);

  // A new position invalidates any in-progress interaction.
  useEffect(() => {
    setSelected(null);
    setDrag(null);
    setPromo(null);
  }, [fen]);

  const board = chess?.board() ?? [];
  const turn = (chess?.turn() ?? 'w') as Color;
  const canMoveSide = movable === 'both' ? turn : movable === 'none' ? null : movable;
  const interactive = canMoveSide !== null && canMoveSide === turn;

  const legalFrom = useMemo(() => {
    if (!chess || !selected) return [];
    try {
      return chess.moves({ square: selected as never, verbose: true });
    } catch {
      return [];
    }
  }, [chess, selected]);

  const checkedKing = useMemo(() => {
    if (!chess || !chess.inCheck()) return null;
    for (const row of chess.board()) {
      for (const cell of row) {
        if (cell && cell.type === 'k' && cell.color === chess.turn()) return cell.square as Square;
      }
    }
    return null;
  }, [chess]);

  function pointerSquare(e: React.PointerEvent): Square | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * SIZE;
    const py = ((e.clientY - r.top) / r.height) * SIZE;
    return xyToSquare(px, py, orientation);
  }

  function pointerXY(e: React.PointerEvent): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * SIZE,
      y: ((e.clientY - r.top) / r.height) * SIZE,
    };
  }

  function tryMove(from: Square, to: Square, promotion?: string): boolean {
    if (!chess) return false;
    const candidates = chess.moves({ square: from as never, verbose: true }).filter((m) => m.to === to);
    if (!candidates.length) return false;

    // Ask which piece to promote to before committing.
    if (candidates.some((m) => m.promotion) && !promotion) {
      setPromo({ from, to });
      setSelected(null);
      return true;
    }
    const probe = new Chess(fen);
    try {
      const made = probe.move({ from, to, promotion: promotion ?? undefined });
      onMove?.({ from, to, promotion, san: made.san, fenAfter: probe.fen() });
      setSelected(null);
      return true;
    } catch {
      return false;
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!interactive || promo) return;
    const sq = pointerSquare(e);
    if (!sq) return;
    const piece = chess?.get(sq as never);

    if (selected && selected !== sq) {
      if (tryMove(selected, sq)) return;
    }
    if (piece && piece.color === turn) {
      setSelected(sq);
      const { x, y } = pointerXY(e);
      setDrag({ from: sq, x, y });
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else {
      setSelected(null);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const { x, y } = pointerXY(e);
    setDrag({ ...drag, x, y });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag) return;
    const sq = pointerSquare(e);
    const from = drag.from;
    setDrag(null);
    // A click (release on the same square) keeps the piece selected instead.
    if (sq && sq !== from) {
      if (!tryMove(from, sq)) setSelected(from);
    }
  }

  const highlightMap = new Map(highlights.map((h) => [h.square, h.color]));
  const dragging = drag && Math.abs(drag.x - (squareToXY(drag.from, orientation).x + SQ / 2)) + Math.abs(drag.y - (squareToXY(drag.from, orientation).y + SQ / 2)) > 4;

  return (
    <div className={`board-wrap ${className ?? ''}`}>
      <svg
        ref={svgRef}
        className={`board ${drag ? 'grabbing' : ''}`}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        data-movable={movable}
        data-turn={turn}
        data-orientation={orientation}
        data-selected={selected ?? ''}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        style={{ cursor: interactive ? (drag ? 'grabbing' : 'pointer') : 'default' }}
      >
        {/* squares */}
        {Array.from({ length: 64 }, (_, i) => {
          const col = i % 8;
          const row = Math.floor(i / 8);
          const sq = (orientation === 'w' ? toSquare(col, 7 - row) : toSquare(7 - col, row))!;
          const isLight = (fileOf(sq) + rankOf(sq)) % 2 === 1;
          const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
          const isSel = selected === sq;
          let fill = isLight ? 'var(--sq-light)' : 'var(--sq-dark)';
          if (isLast || isSel) fill = isLight ? 'var(--sq-light-sel)' : 'var(--sq-dark-sel)';
          if (checkedKing === sq) fill = 'var(--sq-check)';
          return <rect key={sq} x={col * SQ} y={row * SQ} width={SQ} height={SQ} fill={fill} />;
        })}

        {/* caller-supplied highlights */}
        {[...highlightMap.entries()].map(([sq, color]) => {
          const { x, y } = squareToXY(sq, orientation);
          return (
            <rect key={`h-${sq}`} x={x} y={y} width={SQ} height={SQ} fill={color} opacity={0.5} />
          );
        })}

        {/* coordinates */}
        {coordinates &&
          Array.from({ length: 8 }, (_, i) => {
            const fileChar = String.fromCharCode(97 + (orientation === 'w' ? i : 7 - i));
            const rankChar = String(orientation === 'w' ? 8 - i : i + 1);
            const lightFile = (i + (orientation === 'w' ? 1 : 0)) % 2 === 0;
            return (
              <g key={`c-${i}`} style={{ pointerEvents: 'none' }} fontSize={8.5} fontWeight={700} fontFamily="var(--sans)" opacity={0.75}>
                <text x={(i + 1) * SQ - 3} y={SIZE - 3.5} textAnchor="end" fill={lightFile ? 'var(--sq-dark)' : 'var(--sq-light)'}>
                  {fileChar}
                </text>
                <text x={3.5} y={i * SQ + 11} fill={(i % 2 === 0) === (orientation === 'w') ? 'var(--sq-dark)' : 'var(--sq-light)'}>
                  {rankChar}
                </text>
              </g>
            );
          })}

        {/* pieces */}
        {board.flat().map((cell) => {
          if (!cell) return null;
          const sq = cell.square as Square;
          if (dragging && drag?.from === sq) return null;
          const { x, y } = squareToXY(sq, orientation);
          return (
            <Piece key={sq} type={cell.type as PieceType} color={cell.color as Color} x={x} y={y} />
          );
        })}

        {/* legal destinations */}
        {showLegal && interactive &&
          legalFrom.map((m) => {
            const { x, y } = squareToXY(m.to as Square, orientation);
            const isCapture = Boolean(m.captured);
            return isCapture ? (
              <circle
                key={`l-${m.to}`}
                cx={x + SQ / 2}
                cy={y + SQ / 2}
                r={SQ / 2 - 2.5}
                fill="none"
                stroke="rgba(20,20,20,0.34)"
                strokeWidth={4}
                style={{ pointerEvents: 'none' }}
              />
            ) : (
              <circle
                key={`l-${m.to}`}
                cx={x + SQ / 2}
                cy={y + SQ / 2}
                r={6.5}
                fill="rgba(20,20,20,0.26)"
                style={{ pointerEvents: 'none' }}
              />
            );
          })}

        {/* arrows */}
        {arrows.map((a, i) => {
          const from = squareToXY(a.from, orientation);
          const to = squareToXY(a.to, orientation);
          const x1 = from.x + SQ / 2;
          const y1 = from.y + SQ / 2;
          const x2 = to.x + SQ / 2;
          const y2 = to.y + SQ / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const head = 13;
          const tipX = x2 - ux * 5;
          const tipY = y2 - uy * 5;
          const baseX = tipX - ux * head;
          const baseY = tipY - uy * head;
          const nx = -uy;
          const ny = ux;
          const color = a.color ?? 'var(--accent)';
          return (
            <g key={`a-${i}`} style={{ pointerEvents: 'none' }} opacity={0.82}>
              <line
                x1={x1 + ux * 8}
                y1={y1 + uy * 8}
                x2={baseX}
                y2={baseY}
                stroke={color}
                strokeWidth={7}
                strokeLinecap="round"
              />
              <polygon
                points={`${tipX},${tipY} ${baseX + nx * 8},${baseY + ny * 8} ${baseX - nx * 8},${baseY - ny * 8}`}
                fill={color}
              />
            </g>
          );
        })}

        {/* the piece being dragged follows the pointer */}
        {dragging && drag && chess?.get(drag.from as never) && (
          <Piece
            type={chess.get(drag.from as never)!.type as PieceType}
            color={chess.get(drag.from as never)!.color as Color}
            x={drag.x - SQ / 2}
            y={drag.y - SQ / 2}
          />
        )}
      </svg>

      {promo && (
        <div className="promo-overlay">
          <div className="promo-choices">
            {(['q', 'r', 'b', 'n'] as PieceType[]).map((t) => (
              <button key={t} onClick={() => { const p = promo; setPromo(null); tryMove(p.from, p.to, t); }} title={t.toUpperCase()}>
                <PieceIcon type={t} color={turn} size={44} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
