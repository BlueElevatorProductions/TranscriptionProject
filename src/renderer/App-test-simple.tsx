import React from 'react';
import './App.css';

const App: React.FC = () => {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>🎙️ TranscriptionProject</h1>
      <p>Testing basic render...</p>
      <div style={{ 
        background: '#f0f0f0', 
        padding: '20px', 
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h2>Basic App Loading Test</h2>
        <p>If you can see this, React is working correctly.</p>
        <button onClick={() => alert('Button works!')}>
          Test Button
        </button>
      </div>
    </div>
  );
};

export default App;