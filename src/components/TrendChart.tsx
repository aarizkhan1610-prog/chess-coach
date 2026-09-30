import { useMemo, useState } from 'react';

/*
 * Accuracy game by game.
 *
 * One series, so no legend — the title names it. The trend line is the point
 * and the points themselves are context, which is the opposite of how these
 * usually get drawn: with ten noisy games, a reader who follows the zigzag
 * concludes something different every time they look at it.
 *
 * The band is a least-squares fit, and it is only drawn once there are enough
 * games for the slope to mean anything. Saying "you are improving" from four
 * games would be the most flattering possible lie.
 */

const W = 640;
const H = 150;
const PAD = { top: 12, right: 10, bottom: 22, left: 30 };

/** Games below this and a trend line is drawing a shape in noise. */
const MIN_FOR_TREND = 6;

export interface TrendPoint {
  id: string;
  label: string;
  accuracy: number;
}

function fit(values: number[]): { at: (i: number) => number; slope: number } | null {
  const n = values.length;
  if (n < MIN_FOR_TREND) return null;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return { at: (i: number) => meanY + slope * (i - meanX), slope };
}

export function TrendChart({ points, onSelect }: { points: TrendPoint[]; onSelect?: (id: string) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const values = points.map((p) => p.accuracy);
  const line = useMemo(() => fit(values), [values.join(',')]);

  if (points.length < 2) return null;

  /* A fixed 0..100 scale: accuracy is a percentage and rescaling it to the
   * data's own range would make a flat run look like a mountain. */
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - PAD.top - PAD.bottom);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.accuracy).toFixed(1)}`).join(' ');
  const shown = hovered === null ? null : points[hovered];

  return (
    <div className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" role="img" aria-label="Accuracy in each game, oldest first">
        {[25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="var(--border)" strokeWidth={0.7} />
            <text x={PAD.left - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" className="trend-tick">{v}</text>
          </g>
        ))}

        {line && (
          <line
            x1={x(0)}
            y1={y(line.at(0))}
            x2={x(points.length - 1)}
            y2={y(line.at(points.length - 1))}
            stroke="var(--text-faint)"
            strokeWidth={1.4}
          />
        )}

        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />

        {points.map((p, i) => (
          <g
            key={p.id}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            onClick={() => onSelect?.(p.id)}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
          >
            {/* Hit target far larger than the mark. */}
            <rect x={x(i) - 14} y={PAD.top} width={28} height={H - PAD.top - PAD.bottom} fill="transparent" />
            <circle
              cx={x(i)}
              cy={y(p.accuracy)}
              r={hovered === i ? 5.5 : 3.5}
              fill="var(--accent)"
              stroke="var(--bg-elev)"
              strokeWidth={2}
            />
          </g>
        ))}
      </svg>

      <div className="trend-foot small dim">
        {shown
          ? <>vs <b>{shown.label}</b> — {shown.accuracy}% accuracy{onSelect ? '. Click to open it.' : ''}</>
          : line
            ? line.slope > 0.4
              ? <>Trending up: about {line.slope.toFixed(1)} points of accuracy better per game.</>
              : line.slope < -0.4
                ? <>Trending down: about {Math.abs(line.slope).toFixed(1)} points of accuracy worse per game.</>
                : <>Flat across these {points.length} games — no trend either way yet.</>
            : <>Oldest on the left. {MIN_FOR_TREND - points.length} more game{MIN_FOR_TREND - points.length === 1 ? '' : 's'} and a trend line becomes worth drawing.</>}
      </div>
    </div>
  );
}
