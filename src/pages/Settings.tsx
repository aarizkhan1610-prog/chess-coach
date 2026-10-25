import { useEffect, useRef, useState } from 'react';
import { useGames, useStore } from '../state/store';
import { downloadBackup, readBackup, type BackupState } from '../state/backup';
import { Card, Banner, navigate } from '../components/ui';
import { DEPTH_PRESETS, type AnalysisDepthPreset } from '../types';
import { estimateUsage } from '../state/idb';
import { STARTER_PUZZLES } from '../coach/starterPuzzles';
import { ALL_OPENINGS } from '../openings';
import { ALL_LESSONS } from '../coach/lessons';

/* Drawn from the same values as the board themes in styles.css. */
const BOARD_THEMES = [
  { id: 'green', label: 'Green', light: '#eeeed2', dark: '#769656' },
  { id: 'brown', label: 'Brown', light: '#f0d9b5', dark: '#b58863' },
  { id: 'blue', label: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
] as const;

export function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const clearGames = useStore((s) => s.clearGames);
  const games = useGames();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => { estimateUsage().then(setUsage); }, [games.length]);

  const restoreRef = useRef<HTMLInputElement>(null);
  /* The file is read and checked before anything is asked, so the question can
   * say what is actually in it. */
  const [pending, setPending] = useState<{ state: BackupState; games: number; exportedAt: string | null } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  function exportData() {
    downloadBackup(useStore.getState() as unknown as Record<string, unknown>);
  }

  async function chooseBackup(file: File | undefined) {
    setRestoreError(null);
    setRestored(false);
    if (!file) return;
    const result = readBackup(await file.text());
    if (!result.ok) {
      setPending(null);
      setRestoreError(result.reason);
      return;
    }
    setPending({ state: result.state, games: result.games, exportedAt: result.exportedAt });
  }

  /*
   * Merged rather than replacing the whole state, so the store keeps its own
   * actions. The keys a backup carries are the data keys and nothing else —
   * `readBackup` drops the rest, because this object came off somebody's disk.
   */
  function applyRestore() {
    if (!pending) return;
    useStore.setState(pending.state as Partial<ReturnType<typeof useStore.getState>>);
    setPending(null);
    setRestored(true);
  }

  return (
    <div>
      <div className="page-head">
        <h1>Settings</h1>
        <div className="sub">Everything is stored in this browser only.</div>
      </div>

      <div className="split">
        <div className="grid">
          <Card title="You">
            <label className="field">
              <span>Your name as it appears in PGN headers</span>
              <input
                type="text"
                value={settings.playerName}
                placeholder="e.g. your Lichess or Chess.com username"
                onChange={(e) => setSettings({ playerName: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Your rating</span>
              <input
                type="number"
                min={100}
                max={3200}
                value={settings.rating ?? ''}
                placeholder="e.g. 1200"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  const ok = e.target.value !== '' && Number.isFinite(n) && n >= 100 && n <= 3200;
                  // Clearing it puts the question back rather than leaving it
                  // permanently answered with nothing.
                  setSettings({ rating: ok ? Math.round(n) : null, ratingAsked: ok });
                }}
              />
              <span className="tiny faint">
                Used to pick what gets recommended, and to compare a game against players at your level
                when the file itself carries no rating.
              </span>
            </label>
            <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.autoOrient}
                onChange={(e) => setSettings({ autoOrient: e.target.checked })}
                style={{ width: 'auto' }}
              />
              <span>Always show the board from your side</span>
            </label>
          </Card>

          <Card title="Analysis">
            <label className="field">
              <span>Engine depth</span>
              <select value={settings.depth} onChange={(e) => setSettings({ depth: e.target.value as AnalysisDepthPreset })}>
                {(Object.keys(DEPTH_PRESETS) as AnalysisDepthPreset[]).map((k) => (
                  <option key={k} value={k}>{DEPTH_PRESETS[k].label} — depth {DEPTH_PRESETS[k].depth} ({DEPTH_PRESETS[k].note})</option>
                ))}
              </select>
            </label>
            <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.includePunishPuzzles}
                onChange={(e) => setSettings({ includePunishPuzzles: e.target.checked })}
                style={{ width: 'auto' }}
              />
              <span>Also make puzzles from your opponents' blunders</span>
            </label>
          </Card>

          <Card title="Appearance">
            <div className="seg" role="group" aria-label="Theme">
              {(['dark', 'light'] as const).map((t) => (
                <button key={t} className={`seg-item ${settings.theme === t ? 'on' : ''}`}
                  aria-pressed={settings.theme === t} onClick={() => setSettings({ theme: t })}>
                  {t === 'dark' ? 'Dark' : 'Light'}
                </button>
              ))}
            </div>
            <div className="small dim" style={{ margin: 'var(--space-4) 0 var(--space-2)' }}>Board</div>
            <div className="board-swatches" role="group" aria-label="Board colours">
              {BOARD_THEMES.map((b) => (
                <button
                  key={b.id}
                  className={`board-swatch ${(settings.board ?? 'green') === b.id ? 'on' : ''}`}
                  aria-pressed={(settings.board ?? 'green') === b.id}
                  onClick={() => setSettings({ board: b.id })}
                  title={b.label}
                >
                  <span className="board-swatch-grid" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} style={{ background: (i === 0 || i === 3) ? b.light : b.dark }} />
                    ))}
                  </span>
                  <span className="tiny">{b.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid">
          <Card title="Your data">
            <div className="small dim" style={{ marginBottom: 10 }}>
              {games.length} analysed game{games.length === 1 ? '' : 's'} stored in this browser's IndexedDB.
              {usage && usage.quota > 0 && (
                <> Using {(usage.usage / 1024 / 1024).toFixed(1)} MB of roughly {(usage.quota / 1024 / 1024).toFixed(0)} MB available.</>
              )}
            </div>
            <div className="row wrap">
              <button className="btn sm" onClick={exportData}>Export a backup</button>
              <button className="btn sm" onClick={() => restoreRef.current?.click()}>Restore a backup</button>
              <button
                className="btn sm danger"
                disabled={!games.length}
                onClick={() => { if (confirm(`Delete all ${games.length} games? This cannot be undone.`)) clearGames(); }}
              >
                Delete all games
              </button>
              <input
                ref={restoreRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => { void chooseBackup(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>

            {restoreError && (
              <div className="banner error" style={{ marginTop: 'var(--space-3)' }}>
                <div>
                  <div>{restoreError}</div>
                  <div className="small dim">Nothing has been changed.</div>
                </div>
              </div>
            )}

            {/*
              * Restoring replaces a library that cannot be got back, so the
              * question is asked in the page rather than through a browser
              * dialog — and it says what is in the file and what is here now,
              * which is the only way to answer it sensibly.
              */}
            {pending && (
              <div className="banner" style={{ marginTop: 'var(--space-3)' }}>
                <div>
                  <div className="bold">
                    Restore {pending.games} game{pending.games === 1 ? '' : 's'} from this backup?
                  </div>
                  <div className="small">
                    {pending.exportedAt
                      ? <>Exported {pending.exportedAt.slice(0, 10)}. </>
                      : <>This file carries no export date. </>}
                    {games.length > 0
                      ? <>It replaces the {games.length} game{games.length === 1 ? '' : 's'} in this browser,
                        along with your puzzle and lesson progress. That cannot be undone — export the
                        current ones first if you want to keep both.</>
                      : <>There is nothing in this browser to overwrite.</>}
                  </div>
                  <div className="row wrap" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    <button className="btn sm primary" onClick={applyRestore}>Restore it</button>
                    <button className="btn sm ghost" onClick={() => setPending(null)}>Cancel</button>
                    {games.length > 0 && (
                      <button className="btn sm" onClick={exportData}>Export the current ones first</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {restored && (
              <div className="banner ok" style={{ marginTop: 'var(--space-3)' }}>
                <div>
                  <div>Restored. You now have {games.length} game{games.length === 1 ? '' : 's'}.</div>
                  <button className="btn sm" style={{ marginTop: 8 }} onClick={() => navigate('/report')}>
                    Open the report
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card title="What is built in">
            <ul className="small" style={{ margin: 0 }}>
              <li><span className="bold">Stockfish 19</span> (lite, single-threaded WASM) runs entirely in this tab.</li>
              <li><span className="bold">{ALL_OPENINGS.length} opening courses</span> with step-by-step lessons, variations and traps.</li>
              <li><span className="bold">{ALL_LESSONS.length} lessons</span>, one for every weakness the analyser can detect.</li>
              <li><span className="bold">{STARTER_PUZZLES.length} starter puzzles</span>, so the puzzle modes work before you import anything.</li>
            </ul>
          </Card>

          <Banner kind="info">
            Stockfish is licensed under the GPL v3. The licence text ships with the app at
            {' '}<span className="mono tiny">public/engine/STOCKFISH-LICENSE-GPLv3.txt</span>.
            If you distribute this app, its source must be available under a compatible licence.
          </Banner>
        </div>
      </div>
    </div>
  );
}
