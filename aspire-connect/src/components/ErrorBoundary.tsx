import { Component, ErrorInfo, ReactNode } from 'react';
import { isChunkLoadError, reloadOnce } from '@/lib/staleChunk';

interface Props {
  children: ReactNode;
  /** When this value changes (for example the URL path) a previous error is cleared. */
  resetKey?: string;
  /** Render inside the page (keeps the header and footer) instead of taking over the whole screen. */
  inline?: boolean;
}
interface State {
  error: Error | null;
}

/** Catches render errors and failed page loads so the user never sees a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A failed page load after a deploy fixes itself with a fresh load, so do that automatically (once per deploy).
    if (isChunkLoadError(error) && reloadOnce()) return;
    // eslint-disable-next-line no-console
    console.error('UI error:', error.message, '\n', error.stack, '\n', info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    // Navigating somewhere else gives the user a fresh start instead of a stuck error screen.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const stale = isChunkLoadError(error);
    const title = stale ? 'This page has been updated.' : 'Something went wrong loading this page.';
    const detail = stale ? 'A newer version of the site is available. Reload to continue.' : error.message;
    return (
      <div
        role="alert"
        className={`flex flex-col items-center justify-center gap-3 p-6 text-center ${this.props.inline ? 'min-h-[50vh] bg-white' : 'h-screen bg-slate-50'}`}
      >
        <p className="text-base font-semibold text-slate-800">{title}</p>
        <p className="max-w-md text-sm text-slate-500">{detail}</p>
        <details className="max-w-lg text-left text-xs text-slate-400">
          <summary className="cursor-pointer text-center">Technical details (send these to the developer)</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words">{`Page: ${typeof window !== 'undefined' ? window.location.pathname : ''}\n${error.name}: ${error.message}\n${(error.stack ?? '').split('\n').slice(1, 4).join('\n')}`}</pre>
        </details>
        <div className="flex items-center gap-4">
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.location.reload()}>
            Reload
          </button>
          {/* A normal link does a full page load, which also fetches the newest version of the site. */}
          <a href="/" className="text-sm font-medium text-slate-600 underline">Go to the home page</a>
        </div>
      </div>
    );
  }
}
