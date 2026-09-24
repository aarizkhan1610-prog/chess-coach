import { useEffect, useState } from 'react';
import { useGames, useStore } from '../state/store';
import { Card, Banner, navigate } from '../components/ui';
import { DEPTH_PRESETS, type AnalysisDepthPreset } from '../types';
import { estimateUsage } from '../state/idb';
import { STARTER_PUZZLES } from '../coach/starterPuzzles';
import { ALL_OPENINGS } from '../openings';
import { ALL_LESSONS } from '../coach/lessons';

export function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const clearGames = useStore((s) => s.clearGames);
  const games = useGames();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => { estimateUsage().then(setUsage); }, [games.length]);

  function exportData() {
    const blob = new Blob([JSON.stringify(useStore.getState(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chess-coach-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
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
            <div className="row">
              {(['dark', 'light'] as const).map((t) => (
                <button key={t} className={`btn ${settings.theme === t ? 'primary' : ''}`} onClick={() => setSettings({ theme: t })}>
                  {t === 'dark' ? 'Dark' : 'Light'}
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
              <button
                className="btn sm danger"
                disabled={!games.length}
                onClick={() => { if (confirm(`Delete all ${games.length} games? This cannot be undone.`)) clearGames(); }}
              >
                Delete all games
              </button>
            </div>
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
