import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 14, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 44 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Cette section a rencontré une erreur</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 520 }}>
            Le reste de l'application reste utilisable. Détail technique ci-dessous.
          </div>
          <pre style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', maxWidth: 600, overflow: 'auto', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button onClick={this.reset} style={{ marginTop: 4, padding: '10px 24px', background: 'var(--brand, #0d3d6e)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
