import React, { useState, useEffect } from 'react';
import './App.css';

const App: React.FC = () => {
  const [version, setVersion] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');

  useEffect(() => {
    // Get app version and platform info
    const getAppInfo = async () => {
      try {
        const appVersion = await window.electronAPI.getVersion();
        const appPlatform = await window.electronAPI.getPlatform();
        setVersion(appVersion);
        setPlatform(appPlatform);
      } catch (error) {
        console.error('Failed to get app info:', error);
      }
    };

    getAppInfo();

    // Set up menu event listeners
    const handleNewProject = () => {
      console.log('New project requested');
      // TODO: Implement new project functionality
    };

    const handleOpenProject = () => {
      console.log('Open project requested');
      // TODO: Implement open project functionality
    };

    const handleSaveProject = () => {
      console.log('Save project requested');
      // TODO: Implement save project functionality
    };

    const handleImportAudio = () => {
      console.log('Import audio requested');
      // TODO: Implement import audio functionality
    };

    // Register menu event listeners
    window.electronAPI.onMenuNewProject(handleNewProject);
    window.electronAPI.onMenuOpenProject(handleOpenProject);
    window.electronAPI.onMenuSaveProject(handleSaveProject);
    window.electronAPI.onMenuImportAudio(handleImportAudio);

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners('menu-new-project');
      window.electronAPI.removeAllListeners('menu-open-project');
      window.electronAPI.removeAllListeners('menu-save-project');
      window.electronAPI.removeAllListeners('menu-import-audio');
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🎙️ PodcastTranscriber</h1>
          <p>Your professional podcast transcript editor</p>
        </div>
      </header>

      <main className="app-main">
        <div className="welcome-section">
          <h2>Welcome to PodcastTranscriber</h2>
          <p>
            Create professional podcast transcripts with integrated audio editing.
            Get started by importing an audio file or creating a new project.
          </p>

          <div className="action-buttons">
            <button 
              className="btn btn-primary"
              onClick={() => console.log('New Project clicked')}
            >
              New Project
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => console.log('Import Audio clicked')}
            >
              Import Audio
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => console.log('Open Project clicked')}
            >
              Open Project
            </button>
          </div>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <h3>🤖 AI Transcription</h3>
            <p>Offline WhisperX processing with word-level timestamps and speaker detection</p>
          </div>
          <div className="feature-card">
            <h3>✂️ Audio Editing</h3>
            <p>Non-destructive cuts, fades, and volume control with Tracktion Engine</p>
          </div>
          <div className="feature-card">
            <h3>📝 Text Editor</h3>
            <p>Rich text editing with synchronized playback and timeline navigation</p>
          </div>
          <div className="feature-card">
            <h3>📤 Professional Export</h3>
            <p>Export to multiple formats including AAF/OMF for professional workflows</p>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <span>Version {version} • {platform}</span>
          <span>Built with ❤️ for the podcasting community</span>
        </div>
      </footer>
    </div>
  );
};

export default App;