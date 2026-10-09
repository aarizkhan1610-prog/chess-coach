import { Component, type ErrorInfo, type ReactNode } from 'react';
import { downloadBackup } from '../state/backup';
import { useStore } from '../state/store';

/*
 * The last thing between a thrown render and a white screen.
 *
 * There was none, which mattered more here than in most apps: every analysed
 * game lives in this browser and nowhere else, so the page that crashed was
 * also the only route to the button that exports them. The fallback therefore
 * carries that button itself rather than pointing at Settings — the whole
 * point is that navigation may be what is broken.
 *
 * Scoped to the routed page, not the shell, so the navigation survives and the
 * crash is one panel rather than the end of the session.
 */

interface Props {
  children: ReactNode;
  /** Changing this clears the error — the router passes the current path. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Nothing is uploaded anywhere, so the console is the whole report.
    console.error('Page crashed:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="card crash">
        <h2 style={{ marginTop: 0 }}>This page stopped working</h2>
        <p className="small">
          Something in the page threw an error. Your games are still in this browser — the
          failure is in what was being drawn, not in what was stored. Take a backup before
          anything else, because it is the only copy.
        </p>
        <pre className="crash-detail mono tiny">{error.message || String(error)}</pre>
        <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
          <button
            className="btn primary"
            onClick={() => downloadBackup(useStore.getState() as unknown as Record<string, unknown>)}
          >
            Download a backup
          </button>
          <button className="btn" onClick={() => this.setState({ error: null })}>Try again</button>
          <button className="btn ghost" onClick={() => window.location.reload()}>Reload the app</button>
        </div>
      </div>
    );
  }
}
