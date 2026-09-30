import { useMemo, useState } from 'react';
import { AXES, comparableAxes, type AxisId, type AxisScores, type BandStats } from '../coach/report';

/*
 * One game's shape against the shape of games by players at the same rating.
 *
 * Two series, and only one of them is the subject — so the benchmark is drawn
 * as recessive context (a grey band between the quartiles, with a hairline at
 * the median) and the player gets the single accent colour. That keeps identity
 * off colour alone: the player's series is the only coloured thing on the chart.
 *
 * The band matters more than a single line would. "Typical" is a range, and
 * drawing it as one value invites reading a two-point gap as a real difference.
 *
 * Only axes that both sides can answer are drawn. An axis the game never
 * reached, or one the benchmark has too few readings for, is named underneath
 * instead — a spoke at zero would say "you were terrible at this" when what it
 * means is "nobody measured".
 */

const SIZE = 360;
const CX = 180;
const CY = 158;
const R = 106;
const RINGS = [0.25, 0.5, 0.75, 1];

function polygon(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/** The ring-shaped area between two sets of readings, as one fillable path. */
function ribbon(outer: [number, number][], inner: [number, number][]): string {
  const line = (pts: [number, number][]) =>
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return `${line(outer)} Z ${line([...inner].reverse())} Z`;
}

export interface RadarProps {
  scores: AxisScores;
  band: BandStats;
  label?: string;
}

export function RadarChart({ scores, band, label = 'This game' }: RadarProps) {
  const [hovered, setHovered] = useState<AxisId | null>(null);

  const axes = useMemo(() => comparableAxes(scores, band), [scores, band]);
  const skipped = useMemo(() => AXES.filter((a) => !axes.some((d) => d.id === a.id)), [axes]);

  // Start at the top and go clockwise, which is how people read a dial.
  const at = (index: number, value: number): [number, number] => {
    const angle = (-Math.PI / 2) + (index * 2 * Math.PI) / axes.length;
    const d = (Math.max(0, Math.min(100, value)) / 100) * R;
    return [CX + d * Math.cos(angle), CY + d * Math.sin(angle)];
  };

  if (axes.length < 3) {
    return (
      <p className="small dim radar-missing">
        There is not enough in this game to draw a comparison — only {axes.length} of the six areas
        could be measured.
      </p>
    );
  }

  const outer = axes.map((a, i) => at(i, band.p75[a.id] as number));
  const inner = axes.map((a, i) => at(i, band.p25[a.id] as number));
  const median = axes.map((a, i) => at(i, band.median[a.id] as number));
  const mine = axes.map((a, i) => at(i, scores[a.id] as number));

  return (
    <div className="radar">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE - 40}`}
        className="radar-svg"
        role="img"
        aria-label={`${label} compared with players rated ${band.label}`}
      >
        {RINGS.map((r) => (
          <polygon
            key={r}
            points={polygon(axes.map((_, i) => at(i, r * 100)))}
            fill="none"
            stroke="var(--border)"
            strokeWidth={0.7}
          />
        ))}
        {axes.map((a, i) => {
          const [x, y] = at(i, 100);
          return <line key={a.id} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--border)" strokeWidth={0.7} />;
        })}

        <path d={ribbon(outer, inner)} fill="var(--text-faint)" opacity={0.18} fillRule="evenodd" />
        <polygon points={polygon(median)} fill="none" stroke="var(--text-faint)" strokeWidth={1.2} />

        <polygon points={polygon(mine)} fill="var(--accent)" fillOpacity={0.16} stroke="var(--accent)" strokeWidth={2} />
        {mine.map(([x, y], i) => (
          <circle
            key={axes[i].id}
            cx={x}
            cy={y}
            r={hovered === axes[i].id ? 6 : 4.5}
            fill="var(--accent)"
            stroke="var(--bg-elev)"
            strokeWidth={2}
          />
        ))}

        {axes.map((a, i) => {
          const [lx, ly] = at(i, 132);
          const anchor = Math.abs(lx - CX) < 6 ? 'middle' : lx > CX ? 'start' : 'end';
          const [hx, hy] = at(i, 100);
          return (
            <g
              key={a.id}
              onMouseEnter={() => setHovered(a.id)}
              onMouseLeave={() => setHovered((h) => (h === a.id ? null : h))}
              style={{ cursor: 'default' }}
            >
              {/* Hit target far larger than the mark. */}
              <circle cx={hx} cy={hy} r={28} fill="transparent" />
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                className={`radar-label ${hovered === a.id ? 'on' : ''}`}
              >
                {a.label}
              </text>
              <text x={lx} y={ly + 13} textAnchor={anchor} dominantBaseline="middle" className="radar-value">
                {scores[a.id]} vs {band.median[a.id]}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="radar-legend">
        <span className="radar-key">
          <span className="radar-swatch mine" aria-hidden />
          {label}
        </span>
        <span className="radar-key">
          <span className="radar-swatch theirs" aria-hidden />
          Typical at {band.label}
          <span className="tiny faint">&nbsp;({band.games} games)</span>
        </span>
      </div>

      {hovered && <p className="small dim radar-hint">{axes.find((a) => a.id === hovered)?.hint}</p>}

      {skipped.length > 0 && (
        <p className="tiny faint radar-missing">
          Not shown: {skipped.map((a) => a.label.toLowerCase()).join(', ')} — this game did not contain
          enough to measure.
        </p>
      )}
    </div>
  );
}
