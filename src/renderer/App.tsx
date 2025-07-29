import React, { useState, useEffect } from 'react';
import './App.css';
import PlaybackModeContainer from './components/PlaybackMode/PlaybackModeContainer';
import SpeakerIdentification from './components/SpeakerIdentification/SpeakerIdentification';

interface TranscriptionJob {
  id: string;
  filePath: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: any;
  error?: string;
  speakerNames?: { [key: string]: string };
  speakerMerges?: { [key: string]: string };
}

const App: React.FC = () => {
  const [version, setVersion] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');
  const [transcriptionJobs, setTranscriptionJobs] = useState<TranscriptionJob[]>([]);
  const [selectedModelSize, setSelectedModelSize] = useState<string>('base');
  const [currentView, setCurrentView] = useState<'home' | 'speaker-identification' | 'playback'>('home');
  const [selectedJob, setSelectedJob] = useState<TranscriptionJob | null>(null);

  console.log('React App component rendering...');

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

    const handleImportAudio = async () => {
      console.log('Import audio requested');
      await importAudio();
    };

    // Set up transcription event listeners
    window.electronAPI.onTranscriptionProgress((job: TranscriptionJob) => {
      setTranscriptionJobs(prev => 
        prev.map(j => j.id === job.id ? job : j)
      );
    });

    window.electronAPI.onTranscriptionComplete((job: TranscriptionJob) => {
      setTranscriptionJobs(prev => 
        prev.map(j => j.id === job.id ? job : j)
      );
    });

    // Register menu event listeners
    window.electronAPI.onMenuNewProject(handleNewProject);
    window.electronAPI.onMenuOpenProject(handleOpenProject);
    window.electronAPI.onMenuSaveProject(handleSaveProject);
    window.electronAPI.onMenuImportAudio(handleImportAudio);

    // Load existing transcription jobs
    loadTranscriptionJobs();

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners('menu-new-project');
      window.electronAPI.removeAllListeners('menu-open-project');
      window.electronAPI.removeAllListeners('menu-save-project');
      window.electronAPI.removeAllListeners('menu-import-audio');
      window.electronAPI.removeAllListeners('transcription-progress');
      window.electronAPI.removeAllListeners('transcription-complete');
    };
  }, []);

  const loadTranscriptionJobs = async () => {
    try {
      const jobs = await window.electronAPI.getAllTranscriptions();
      setTranscriptionJobs(jobs);
    } catch (error) {
      console.error('Failed to load transcription jobs:', error);
    }
  };

  const importAudio = async () => {
    try {
      console.log('Starting audio import...');
      console.log('electronAPI available:', !!window.electronAPI);
      console.log('importAudioDialog available:', !!window.electronAPI?.importAudioDialog);
      
      if (!window.electronAPI?.importAudioDialog) {
        throw new Error('importAudioDialog is not available');
      }
      
      const result = await window.electronAPI.importAudioDialog();
      console.log('Dialog result:', result);
      
      if (result.success && result.filePath) {
        console.log('Starting transcription for:', result.filePath);
        const transcriptionResult = await window.electronAPI.startTranscription(result.filePath, selectedModelSize);
        console.log('Transcription result:', transcriptionResult);
        
        if (transcriptionResult.success) {
          console.log('Transcription started successfully, refreshing jobs...');
          // Refresh the jobs list
          await loadTranscriptionJobs();
        } else {
          // Show error message
          console.error('Transcription failed:', transcriptionResult.error);
          alert(`Failed to start transcription: ${transcriptionResult.error}`);
        }
      } else {
        console.log('User cancelled dialog or no file selected');
      }
    } catch (error) {
      console.error('Failed to import audio:', error);
      alert(`An unexpected error occurred while importing audio: ${error.message}`);
    }
  };

  const handleOpenPlaybackMode = (job: TranscriptionJob) => {
    setSelectedJob(job);
    
    // Check if we need speaker identification
    const segments = job.result?.segments || [];
    const speakers = new Set(segments.map(s => s.speaker).filter(Boolean));
    
    console.log('=== Speaker Detection Debug ===');
    console.log('Total segments:', segments.length);
    console.log('Unique speakers found:', speakers);
    console.log('Speaker count:', speakers.size);
    console.log('Job already has speaker names:', !!job.speakerNames);
    console.log('First few segments:', segments.slice(0, 3).map(s => ({ speaker: s.speaker, text: s.text?.substring(0, 50) })));
    
    if (speakers.size > 1 && !job.speakerNames) {
      console.log('✅ Triggering speaker identification workflow');
      setCurrentView('speaker-identification');
    } else {
      console.log('❌ Skipping speaker identification - going to playback');
      console.log('Reason:', speakers.size <= 1 ? 'Only one speaker' : 'Speaker names already exist');
      setCurrentView('playback');
    }
  };

  const handleSpeakerIdentificationComplete = (result: { speakerNames: { [key: string]: string }, speakerMerges?: { [key: string]: string } }) => {
    if (selectedJob) {
      // Update the job with speaker names and merge mapping
      const updatedJob = { 
        ...selectedJob, 
        speakerNames: result.speakerNames,
        speakerMerges: result.speakerMerges 
      };
      setSelectedJob(updatedJob);
      
      // Update the job in the list
      setTranscriptionJobs(prev => 
        prev.map(job => job.id === selectedJob.id ? updatedJob : job)
      );
      
      // Proceed to playback mode
      setCurrentView('playback');
    }
  };

  const handleSpeakerIdentificationSkip = () => {
    // Skip speaker identification and go to playback
    setCurrentView('playback');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedJob(null);
  };

  if (currentView === 'speaker-identification' && selectedJob) {
    return (
      <SpeakerIdentification
        transcriptionJob={selectedJob}
        onComplete={handleSpeakerIdentificationComplete}
        onSkip={handleSpeakerIdentificationSkip}
      />
    );
  }

  if (currentView === 'playback' && selectedJob) {
    return (
      <PlaybackModeContainer
        transcriptionJob={selectedJob}
        onBack={handleBackToHome}
      />
    );
  }

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
              onClick={importAudio}
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

          <div className="model-selection">
            <label htmlFor="model-size">WhisperX Model:</label>
            <select 
              id="model-size" 
              value={selectedModelSize} 
              onChange={(e) => setSelectedModelSize(e.target.value)}
            >
              <option value="tiny">Tiny (fastest, least accurate)</option>
              <option value="base">Base (balanced)</option>
              <option value="small">Small (better accuracy)</option>
              <option value="medium">Medium (good accuracy)</option>
              <option value="large">Large (best accuracy, slowest)</option>
            </select>
          </div>
        </div>

        {transcriptionJobs.length > 0 && (
          <div className="transcription-jobs">
            <h3>Transcription Jobs</h3>
            {transcriptionJobs.map((job) => (
              <div key={job.id} className={`job-card job-${job.status}`}>
                <div className="job-header">
                  <h4>{job.fileName}</h4>
                  <span className="job-status">{job.status}</span>
                </div>
                
                {job.status === 'processing' && (
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${job.progress}%` }}
                    ></div>
                    <span className="progress-text">{job.progress}%</span>
                  </div>
                )}
                
                {job.status === 'error' && (
                  <div className="error-message">
                    Error: {job.error}
                  </div>
                )}
                
                {job.status === 'completed' && job.result && (
                  <div className="transcription-result">
                    <div className="result-header">
                      <div className="result-stats">
                        <p><strong>Language:</strong> {job.result.language}</p>
                        <p><strong>Segments:</strong> {job.result.segments?.length || 0}</p>
                      </div>
                      <button 
                        className="btn btn-primary"
                        onClick={() => handleOpenPlaybackMode(job)}
                        style={{ fontSize: '14px', padding: '8px 16px' }}
                      >
                        Open in Playback Mode
                      </button>
                    </div>
                    <details>
                      <summary>View Raw Transcription</summary>
                      <div className="transcription-text">
                        {job.result.segments?.map((segment: any, index: number) => (
                          <div key={index} className="segment">
                            <span className="timestamp">
                              [{Math.floor(segment.start / 60)}:{(segment.start % 60).toFixed(1).padStart(4, '0')} - {Math.floor(segment.end / 60)}:{(segment.end % 60).toFixed(1).padStart(4, '0')}]
                            </span>
                            <span className="text">{segment.text}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

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