import { Component } from 'react';
import { Link } from 'react-router-dom';

function RouteFailureFallback({ onRetry }) {
  return (
    <main className="route-failure" role="alert">
      <p className="app-eyebrow">PAGE UNAVAILABLE</p>
      <h1>Something went wrong.</h1>
      <p>This page could not be displayed. Your saved progress has not been changed.</p>
      <div className="route-failure__actions">
        <button type="button" onClick={onRetry}>Try loading again</button>
        <Link to="/app/dashboard">Return to Dashboard</Link>
      </div>
    </main>
  );
}

export default class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error('[THE SYSTEM] Page render failed.', error, info);
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  retry = () => this.setState({ error: null });

  render() {
    if (this.state.error) return <RouteFailureFallback onRetry={this.retry} />;
    return this.props.children;
  }
}
