import { useMemo, type ReactNode } from 'react';
import { ALL_OPENINGS, openingById } from '../openings';
import { ALL_LESSONS, buildPlan, coreTrack } from '../coach/lessons';
import { buildProfile } from '../coach/weaknesses';
import { puzzlesFromGames } from '../coach/puzzles';
import { STARTER_PUZZLES } from '../coach/starterPuzzles';
import { isDue } from '../coach/srs';
import { useGames, useStore } from '../state/store';
import { PieceIcon } from './Pieces';
import { navigate } from './ui';

/* ------------------------------------------------------------------ *
 * Icons
 * ------------------------------------------------------------------ */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function MagnifierIcon({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden {...stroke}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4 L21 21" />
      <path d="M8 10.5 L10 12.5 L13.5 8.5" />
    </svg>
  );
}

export function BookIcon({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden {...stroke}>
      <path d="M3 4.8 C 6 3.4 9 3.4 12 4.8 C 15 3.4 18 3.4 21 4.8 L 21 19 C 18 17.6 15 17.6 12 19 C 9 17.6 6 17.6 3 19 Z" />
      <path d="M12 4.8 L 12 19" />
    </svg>
  );
}

export function BoltIcon({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden {...stroke}>
      <path d="M13.5 2 L 5 13.5 L 11 13.5 L 10.5 22 L 19 10.5 L 13 10.5 Z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Paths
 * ------------------------------------------------------------------ */
export interface PathView {
  id: string;
  icon: ReactNode;
  title: string;
  /** Long copy, used on the landing page. */
  blurb: string;
  /** Short status line, used on the dashboard strip. Reflects your data. */
  status: string;
  /** Footnote under the long copy. */
  meta: string;
  cta: string;
  href: string;
}

/**
 * The four pathways, resolved against whatever the user has actually done.
 *
 * With no data these read as an invitation; with data they read as a
 * to-do list — where you left off in each, rather than a generic pitch.
 */
export function usePaths(): PathView[] {
  const games = useGames();
  const settings = useStore((s) => s.settings);
  const lessonDone = useStore((s) => s.lessonDone);
  const openingStep = useStore((s) => s.openingStep);
  const progress = useStore((s) => s.progress);

  const profile = useMemo(() => buildProfile(games), [games]);
  const plan = useMemo(() => buildPlan(profile, 6), [profile]);
  const track = useMemo(() => coreTrack(lessonDone), [lessonDone]);

  const myPuzzles = useMemo(
    () => puzzlesFromGames(games, { includePunish: settings.includePunishPuzzles }),
    [games, settings.includePunishPuzzles],
  );

  return useMemo(() => {
    const hasGames = games.length > 0;

    /* --- mistakes --- */
    const blunders = profile.verdicts.blunder + profile.verdicts.mistake;
    const mistakes: PathView = {
      id: 'mistakes',
      icon: <MagnifierIcon />,
      title: 'Show me my mistakes',
      blurb:
        'Paste in a game and every move gets checked. You get the moves that cost you the game, what you should have played, and — the useful part — why you missed it.',
      status: hasGames
        ? `${blunders} mistake${blunders === 1 ? '' : 's'} found across ${games.length} game${games.length === 1 ? '' : 's'}`
        : 'Nothing analysed yet',
      meta: hasGames ? `${games.length} analysed` : 'Takes a minute · needs one of your games',
      cta: hasGames ? 'Analyse another' : 'Analyse a game',
      href: hasGames ? '/games' : '/import',
    };

    /* --- fundamentals --- */
    // The personalised plan wins when it exists; otherwise follow the track.
    const nextLesson = plan.find((p) => !lessonDone[p.lesson.tag])?.lesson ?? track.find((t) => !t.done)?.lesson;
    const lessonsDone = ALL_LESSONS.filter((l) => lessonDone[l.tag]).length;
    const fundamentals: PathView = {
      id: 'fundamentals',
      icon: <BookIcon />,
      title: 'Teach me the fundamentals',
      blurb:
        `The ${ALL_LESSONS.length} habits that actually decide games below master level — hanging pieces, king safety, when to trade, how to convert a won position. Each with a board to try it on.`,
      status: nextLesson
        ? `Next: ${nextLesson.title}`
        : `All ${ALL_LESSONS.length} lessons complete`,
      meta: lessonsDone
        ? `${lessonsDone} of ${ALL_LESSONS.length} done`
        : `${ALL_LESSONS.length} lessons · start anywhere`,
      cta: lessonsDone ? 'Continue' : 'Start learning',
      href: nextLesson ? `/lessons/${nextLesson.tag}` : '/lessons',
    };

    /* --- openings --- */
    const started = Object.entries(openingStep)
      .filter(([, step]) => step > 0)
      .map(([id]) => openingById(id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o));
    // An opening you actually played, that we have a course for, beats a generic suggestion.
    const playedWithCourse = games.map((g) => g.openingId).filter((id): id is string => Boolean(id)).map(openingById).find(Boolean);
    const openings: PathView = {
      id: 'openings',
      icon: <PieceIcon type="n" color="w" size={34} />,
      title: 'Grow my opening repertoire',
      blurb:
        'Proper courses for both colours, taught move by move with the ideas behind them — not just a list of moves to memorise. Then play the line back from memory.',
      status: started.length
        ? `Continue ${started[0].name}`
        : playedWithCourse
          ? `You played the ${playedWithCourse.name} — learn it properly`
          : 'No repertoire started',
      meta: started.length
        ? `${started.length} of ${ALL_OPENINGS.length} started`
        : `${ALL_OPENINGS.length} openings · White and Black`,
      cta: started.length ? 'Continue' : 'Browse openings',
      href: started.length ? `/openings/${started[0].id}` : playedWithCourse ? `/openings/${playedWithCourse.id}` : '/openings',
    };

    /* --- tactics --- */
    const pool = [...myPuzzles, ...STARTER_PUZZLES];
    const due = pool.filter((p) => isDue(progress[p.id])).length;
    const tactics: PathView = {
      id: 'tactics',
      icon: <BoltIcon />,
      title: 'Sharpen my tactics',
      blurb:
        'Puzzles with real game modes — three-minute rush, endless streak, survival. Once you have imported games, your own blunders become the puzzles.',
      status: myPuzzles.length
        ? `${myPuzzles.length} puzzle${myPuzzles.length === 1 ? '' : 's'} from your own blunders`
        : `${due} puzzle${due === 1 ? '' : 's'} ready`,
      meta: `${pool.length} puzzles · 7 modes`,
      cta: myPuzzles.length ? 'Train on your mistakes' : 'Solve puzzles',
      href: myPuzzles.length ? '/puzzles/weakness' : '/puzzles',
    };

    return [mistakes, fundamentals, openings, tactics];
  }, [games, profile, plan, track, lessonDone, openingStep, progress, myPuzzles]);
}

/* ------------------------------------------------------------------ *
 * Presentations
 * ------------------------------------------------------------------ */

/** Full-size cards, for the landing page. */
export function PathCards({ paths }: { paths: PathView[] }) {
  return (
    <div className="path-grid">
      {paths.map((p) => (
        <button key={p.id} className="path-card" onClick={() => navigate(p.href)}>
          <span className="path-icon">{p.icon}</span>
          <span className="path-title">{p.title}</span>
          <span className="path-blurb">{p.blurb}</span>
          <span className="path-foot">
            <span className="path-meta">{p.meta}</span>
            <span className="path-cta">
              {p.cta} <span aria-hidden>{'→'}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Compact row, for the dashboard — same paths, showing where you left off. */
export function PathStrip({ paths }: { paths: PathView[] }) {
  return (
    <div className="path-strip">
      {paths.map((p) => (
        <button key={p.id} className="strip-card" onClick={() => navigate(p.href)}>
          <span className="strip-icon">{p.icon}</span>
          <span className="strip-text">
            <span className="strip-title">{p.title}</span>
            <span className="strip-status">{p.status}</span>
          </span>
          <span className="strip-arrow" aria-hidden>{'→'}</span>
        </button>
      ))}
    </div>
  );
}
