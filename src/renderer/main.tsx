import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import JuceEditorWindow from './components/audio/JuceEditorWindow';
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
          height: '100dvh',
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

// Lightweight console noise control
(() => {
  const level = (import.meta as any).env?.VITE_LOG_LEVEL || '';
  if (!level) return;
  const noop = () => {};
  if (level.toLowerCase() === 'error') {
    console.log = noop as any;
    console.info = noop as any;
    console.warn = noop as any;
  } else if (level.toLowerCase() === 'warn') {
    console.log = noop as any;
    console.info = noop as any;
  }
})();

if ((import.meta as any).env?.VITE_UI_DEBUG === 'true') console.log('React main.tsx initializing...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const params = new URLSearchParams(window.location.search);
const isAudioEditor = params.get('audioEditor') === '1';
const audioSrc = params.get('src') || undefined; // already URL-encoded from main
const peaksPort = params.get('peaksPort') || undefined;

function AudioEditorWindow() {
  const src = audioSrc; // encoded URL passed from main
  return <JuceEditorWindow src={src} peaksPort={peaksPort} />;
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {isAudioEditor ? <AudioEditorWindow /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);

if ((import.meta as any).env?.VITE_UI_DEBUG === 'true') console.log('React application mounted successfully');
