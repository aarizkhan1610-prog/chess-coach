import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { AnalysedMove, Evaluation, MoveVerdict } from '../types';
import { VERDICT_META, formatEval, winPctWhite } from '../chess/evaluation';

/* ------------------------------------------------------------------ *
 * Hash routing — a full router is more than this app needs.
 * ------------------------------------------------------------------ */
export function useRoute(): [string[], (path: string) => void] {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const on = () => setHash(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const parts = hash.split('/').filter(Boolean);
  return [parts, (path: string) => { window.location.hash = path; }];
}

export function navigate(path: string) {
  window.location.hash = path;
}

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */
export function Card({ children, className = '', title, actions, style }: {
  children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className={`card ${className}`} style={style}>
      {(title || actions) && (
        <div className="card-head">
          {typeof title === 'string' ? <h3>{title}</h3> : title}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: string }) {
  return (
    <div className="stat">
      <div className="value" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function Pill({ children, solid, color, title }: {
  children: ReactNode; solid?: boolean; color?: string; title?: string;
}) {
  return (
    <span
      className={`pill ${solid ? 'solid' : ''}`}
      title={title}
      style={color ? (solid ? { background: color, borderColor: color, color: '#141414' } : { color, borderColor: color }) : undefined}
    >
      {children}
    </span>
  );
}

export function Meter({ value, max = 100, color = 'var(--accent)', label }: {
  value: number; max?: number; color?: string; label?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="meter">
      <div className="track"><div style={{ width: `${pct}%`, background: color }} /></div>
      {label !== undefined && <span className="small nowrap dim">{label}</span>}
    </div>
  );
}

export function Progress({ value, max = 100 }: { value: number; max?: number }) {
  return <div className="progress"><div style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>;
}

export function Empty({ icon = '♟', title, children, action }: {
  icon?: string; title: string; children?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="icon">{icon}</div>
      <div className="bold" style={{ color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      {children && <div className="small" style={{ maxWidth: 440, margin: '0 auto 14px' }}>{children}</div>}
      {action}
    </div>
  );
}

export function Banner({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) {
  const icon = kind === 'error' ? '⚠' : kind === 'warn' ? '⚠' : kind === 'ok' ? '✓' : 'i';
  return (
    <div className={`banner ${kind === 'info' ? '' : kind}`}>
      <span className="bold" aria-hidden>{icon}</span>
      <div>{children}</div>
    </div>
  );
}

export function VerdictBadge({ verdict, title }: { verdict: MoveVerdict; title?: string }) {
  const m = VERDICT_META[verdict];
  return <Pill color={m.color} title={title}>{m.symbol ? `${m.symbol} ` : ''}{m.label}</Pill>;
}

export function accuracyColor(acc: number): string {
  if (acc >= 90) return 'var(--v-best)';
  if (acc >= 80) return 'var(--v-good)';
  if (acc >= 70) return 'var(--v-inaccuracy)';
  if (acc >= 55) return 'var(--v-mistake)';
  return 'var(--v-blunder)';
}

/* ------------------------------------------------------------------ *
 * Evaluation bar
 * ------------------------------------------------------------------ */
export function EvalBar({ evaluation, orientation = 'w' }: { evaluation: Evaluation; orientation?: 'w' | 'b' }) {
  const wp = winPctWhite(evaluation);
  const whiteHeight = orientation === 'w' ? wp : 100 - wp;
  return (
    <div className="evalbar" title={`Evaluation: ${formatEval(evaluation)}`}>
      <div className="midline" />
      <div className="white-part" style={{ height: `${whiteHeight}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Win-probability graph across the game
 * ------------------------------------------------------------------ */
export function EvalGraph({ moves, current, onSeek, heroColor }: {
  moves: AnalysedMove[];
  current: number;
  onSeek: (ply: number) => void;
  heroColor?: 'w' | 'b';
}) {
  const W = 600;
  const H = 88;
  if (!moves.length) return null;

  const pts = moves.map((m, i) => ({
    x: (i / Math.max(1, moves.length - 1)) * W,
    y: H - (winPctWhite(m.evalAfter) / 100) * H,
    m,
    i,
  }));

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const marks = pts.filter((p) => ['blunder', 'mistake', 'inaccuracy'].includes(p.m.verdict));

  return (
    <svg
      className="evalgraph"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const frac = (e.clientX - r.left) / r.width;
        onSeek(Math.round(frac * (moves.length - 1)));
      }}
    >
      {/* White's territory is the area under the curve. */}
      <path d={area} fill="var(--piece-white)" opacity={0.9} />
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--accent)" strokeWidth={1} opacity={0.45} strokeDasharray="4 4" />
      <path d={line} fill="none" stroke="var(--border-strong)" strokeWidth={1.4} />
      {marks.map((p) => (
        <circle
          key={p.i}
          cx={p.x}
          cy={p.y}
          r={3.4}
          fill={VERDICT_META[p.m.verdict].color}
          stroke="var(--bg)"
          strokeWidth={1}
        >
          <title>{`${p.m.moveNumber}${p.m.color === 'w' ? '.' : '...'} ${p.m.san} — ${VERDICT_META[p.m.verdict].label}`}</title>
        </circle>
      ))}
      {current >= 0 && current < pts.length && (
        <line x1={pts[current].x} y1={0} x2={pts[current].x} y2={H} stroke="var(--accent)" strokeWidth={1.6} />
      )}
      {heroColor === 'b' && <title>Higher means better for White</title>}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Move list
 * ------------------------------------------------------------------ */
export function MoveList({ moves, current, onSelect, heroColor }: {
  moves: AnalysedMove[];
  current: number;
  onSelect: (ply: number) => void;
  heroColor?: 'w' | 'b';
}) {
  const rows: { n: number; w?: AnalysedMove; b?: AnalysedMove }[] = [];
  for (const m of moves) {
    const idx = m.moveNumber - 1;
    rows[idx] = rows[idx] ?? { n: m.moveNumber };
    if (m.color === 'w') rows[idx].w = m;
    else rows[idx].b = m;
  }

  const cell = (m: AnalysedMove | undefined) => {
    if (!m) return <span className="move-cell empty-cell" />;
    const meta = VERDICT_META[m.verdict];
    const notable = ['blunder', 'mistake', 'inaccuracy', 'brilliant', 'great'].includes(m.verdict);
    const isHero = heroColor ? m.color === heroColor : true;
    return (
      <button
        type="button"
        className={`move-cell ${current === m.ply ? 'current' : ''}`}
        onClick={() => onSelect(m.ply)}
        aria-current={current === m.ply ? 'true' : undefined}
        title={`${meta.label}${m.winLoss > 0 ? ` — lost ${m.winLoss} win%` : ''}`}
      >
        <span style={{ opacity: isHero ? 1 : 0.62 }}>{m.san}</span>
        {notable && <span className="mark" style={{ color: meta.color }}>{meta.symbol}</span>}
      </button>
    );
  };

  return (
    <div className="movelist">
      {rows.filter(Boolean).map((r) => (
        <div className="movelist-row" key={r.n}>
          <div className="num">{r.n}.</div>
          {cell(r.w)}
          {cell(r.b)}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */
export function Spinner() {
  return <span className="spin" aria-label="working" />;
}

export function formatDate(d: string | null): string {
  if (!d) return '';
  return d.replace(/\./g, '-');
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function resultBadge(result: string, hero: 'w' | 'b'): { text: string; color: string } {
  if (result === '1/2-1/2') return { text: 'Draw', color: 'var(--text-dim)' };
  const won = (result === '1-0' && hero === 'w') || (result === '0-1' && hero === 'b');
  if (result !== '1-0' && result !== '0-1') return { text: '—', color: 'var(--text-faint)' };
  return won ? { text: 'Win', color: 'var(--good)' } : { text: 'Loss', color: 'var(--bad)' };
}
