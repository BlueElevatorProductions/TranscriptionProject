import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import WaveSurferMinimal from './components/audio/WaveSurferMinimal';
import './index.css';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#f5f5f5',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '20px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: '600', color: '#333' }}>
            Application Error
          </h1>
          <p style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#666', textAlign: 'center' }}>
            The application encountered an error and cannot continue.
          </p>
          <details style={{ 
            backgroundColor: '#fff', 
            padding: '15px', 
            borderRadius: '8px', 
            border: '1px solid #ddd',
            maxWidth: '600px',
            width: '100%'
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
              Error Details
            </summary>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              fontSize: '12px', 
              color: '#d32f2f',
              margin: 0,
              wordBreak: 'break-word'
            }}>
              {this.state.error?.stack || this.state.error?.message || 'Unknown error'}
            </pre>
          </details>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

console.log('React main.tsx initializing...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const params = new URLSearchParams(window.location.search);
const isAudioEditor = params.get('audioEditor') === '1';
const audioSrc = params.get('src') || undefined; // already URL-encoded from main

function AudioEditorWindow() {
  const src = audioSrc; // use encoded URL directly
  return (
    <div style={{ padding: 16, color: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' }}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Audio Editor (Isolated Window)</h3>
      {src ? (
        <>
          <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 8 }}>Source: {src}</div>
          <WaveSurferMinimal src={src} />
        </>
      ) : (
        <p>No audio source provided.</p>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {isAudioEditor ? <AudioEditorWindow /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);

console.log('React application mounted successfully');
