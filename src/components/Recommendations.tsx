import { navigate } from './ui';
import type { Recommendation } from '../coach/recommend';

/*
 * The only two ways a recommendation is drawn.
 *
 * There used to be twelve places in the app that suggested what to do next,
 * each with its own markup and its own idea of what counted as a reason. That
 * is why nobody could tell where advice came from. One producer
 * (`src/coach/recommend.ts`), two renderers, and every one of them states why
 * it is there.
 */

const SOURCE_LABEL: Record<Recommendation['source'], string> = {
  'your-games': 'From your games',
  'your-rating': 'For your rating',
  'starting-out': 'To begin with',
};

/** Full-size cards, for a page that leads with them. */
export function RecommendationCards({ recommendations }: { recommendations: Recommendation[] }) {
  if (!recommendations.length) return null;
  return (
    <div className="rec-grid">
      {recommendations.map((rec) => (
        <button key={rec.id} className="rec-card" onClick={() => navigate(rec.href)}>
          <span className="rec-source">{SOURCE_LABEL[rec.source]}</span>
          <span className="rec-title">{rec.title}</span>
          <span className="rec-why">{rec.why}</span>
          <span className="rec-cta">{rec.cta} →</span>
        </button>
      ))}
    </div>
  );
}

/** Compact rows, for a side panel where the chart is the main event. */
export function RecommendationList({ recommendations }: { recommendations: Recommendation[] }) {
  if (!recommendations.length) return null;
  return (
    <ul className="rec-list">
      {recommendations.map((rec) => (
        <li key={rec.id}>
          <button className="rec-row" onClick={() => navigate(rec.href)}>
            <span className="rec-row-title">{rec.title}</span>
            <span className="rec-row-why">{rec.why}</span>
            <span className="rec-row-cta">{rec.cta} →</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
