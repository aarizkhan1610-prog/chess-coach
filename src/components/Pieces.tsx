import type { ReactElement } from 'react';
import type { Color, PieceType } from '../types';

/**
 * Chess pieces drawn as SVG in a 45x45 box, matching the board's square size.
 *
 * These are authored rather than taken from a font: Unicode chess glyphs have
 * wildly different metrics across platforms, which makes them sit off-centre.
 * Both colours use the same shapes, differing only in fill and outline, so the
 * set reads consistently on light and dark squares.
 */

const BASE = 'M 10.5 37.5 L 34.5 37.5 L 36 41 L 9 41 Z';

function Pawn(_: ShapeProps) {
  return (
    <>
      <circle cx="22.5" cy="14" r="6" />
      <path d="M 18.6 20 L 26.4 20 C 26.4 26 30.6 30.5 32 35.5 L 13 35.5 C 14.4 30.5 18.6 26 18.6 20 Z" />
      <path d="M 12 35.5 L 33 35.5 L 34.5 39.5 L 10.5 39.5 Z" />
    </>
  );
}

function Rook(_: ShapeProps) {
  return (
    <>
      <path d="M 11.5 9.5 L 11.5 16.5 L 33.5 16.5 L 33.5 9.5 L 29.5 9.5 L 29.5 12.5 L 25.5 12.5 L 25.5 9.5 L 19.5 9.5 L 19.5 12.5 L 15.5 12.5 L 15.5 9.5 Z" />
      <path d="M 14.5 17 L 13 33 L 32 33 L 30.5 17 Z" />
      <path d="M 11.5 33 L 33.5 33 L 35 37.5 L 10 37.5 Z" />
      <path d={BASE} />
    </>
  );
}

function Knight({ line }: ShapeProps) {
  return (
    <>
      <path d="M 12.5 37 C 12.5 31 13.5 25.5 16 21.5 C 17 20 17.6 17.2 16.6 14.6 L 15.6 9.4 L 19.6 13.6 C 21.1 10.5 23.6 9 26 9.4 C 29.6 10.4 32 13.6 32.6 17 L 33.2 20.6 L 29.4 21.6 L 27 20.6 C 27.5 23.6 28 25.6 29.6 27.6 C 31.6 30.6 32 33.6 32 37 Z" />
      {/* mane */}
      <path d="M 16.4 14.8 C 18.4 17 19.4 19.6 19 22.4" fill="none" stroke={line} strokeWidth={1.2} strokeLinecap="round" />
      <circle cx="25.2" cy="15.4" r="1.4" fill={line} stroke="none" />
      <path d="M 11 37 L 34 37 L 35.5 41 L 9.5 41 Z" />
    </>
  );
}

function Bishop({ line }: ShapeProps) {
  return (
    <>
      <circle cx="22.5" cy="7.5" r="2.3" />
      <path d="M 22.5 9.8 C 26.8 9.8 29.5 14 29.5 18 C 29.5 21.8 26.4 24 22.5 24.8 C 18.6 24 15.5 21.8 15.5 18 C 15.5 14 18.2 9.8 22.5 9.8 Z" />
      <path d="M 22.5 13 L 22.5 21" fill="none" stroke={line} strokeWidth={1.2} strokeLinecap="round" />
      <path d="M 17 24.8 L 28 24.8 L 29.5 28.5 L 15.5 28.5 Z" />
      <path d="M 15.5 28.5 C 15.5 32.5 12.5 34 11 37 L 34 37 C 32.5 34 29.5 32.5 29.5 28.5 Z" />
      <path d="M 11 37 L 34 37 L 35.5 41 L 9.5 41 Z" />
    </>
  );
}

function Queen(_: ShapeProps) {
  return (
    <>
      <circle cx="8.5" cy="13" r="2.3" />
      <circle cx="15.5" cy="9.5" r="2.3" />
      <circle cx="22.5" cy="7.8" r="2.6" />
      <circle cx="29.5" cy="9.5" r="2.3" />
      <circle cx="36.5" cy="13" r="2.3" />
      <path d="M 8.5 14.5 L 12.5 27 L 32.5 27 L 36.5 14.5 L 30 19.5 L 26 11.5 L 22.5 18.5 L 19 11.5 L 15 19.5 Z" />
      <path d="M 12.5 27 L 32.5 27 L 33.5 30.5 L 11.5 30.5 Z" />
      <path d="M 11.5 30.5 C 11.5 34 9.5 35 8.5 37.5 L 36.5 37.5 C 35.5 35 33.5 34 33.5 30.5 Z" />
      <path d="M 9 37.5 L 36 37.5 L 37.5 41 L 7.5 41 Z" />
    </>
  );
}

function King(_: ShapeProps) {
  return (
    <>
      <path d="M 21 4 L 24 4 L 24 7 L 27 7 L 27 10 L 24 10 L 24 13 L 21 13 L 21 10 L 18 10 L 18 7 L 21 7 Z" />
      <path d="M 11 27 L 9.5 17 C 13 13.5 17.5 14.5 19.5 18 C 20.5 15 24.5 15 25.5 18 C 27.5 14.5 32 13.5 35.5 17 L 34 27 Z" />
      <path d="M 11 27 L 34 27 L 35 30.5 L 10 30.5 Z" />
      <path d="M 10 30.5 C 10 34 8.5 35 7.5 37.5 L 37.5 37.5 C 36.5 35 35 34 35 30.5 Z" />
      <path d="M 8 37.5 L 37 37.5 L 38.5 41 L 6.5 41 Z" />
    </>
  );
}

interface ShapeProps {
  /** Outline colour, reused for interior details like the knight's eye. */
  line: string;
}

const SHAPES: Record<PieceType, (p: ShapeProps) => ReactElement> = {
  p: Pawn,
  r: Rook,
  n: Knight,
  b: Bishop,
  q: Queen,
  k: King,
};

export interface PieceProps {
  type: PieceType;
  color: Color;
  /** Top-left corner in board units. */
  x: number;
  y: number;
  opacity?: number;
}

export function Piece({ type, color, x, y, opacity }: PieceProps) {
  const Shape = SHAPES[type];
  const fill = color === 'w' ? 'var(--piece-white)' : 'var(--piece-black)';
  const line = color === 'w' ? 'var(--piece-white-line)' : 'var(--piece-black-line)';
  return (
    <g
      transform={`translate(${x} ${y})`}
      fill={fill}
      stroke={line}
      strokeWidth={1.4}
      strokeLinejoin="round"
      opacity={opacity}
      style={{ pointerEvents: 'none' }}
    >
      <Shape line={line} />
    </g>
  );
}

/** Standalone piece, for the promotion picker. */
export function PieceIcon({ type, color, size = 40 }: { type: PieceType; color: Color; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 45 45" aria-hidden>
      <Piece type={type} color={color} x={0} y={0} />
    </svg>
  );
}
