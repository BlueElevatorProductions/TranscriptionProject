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
  const [isImporting, setIsImporting] = useState<boolean>(false);

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
    window.electronAPI.onMenuOpenProject(handleOpenProject);
    window.electronAPI.onMenuSaveProject(handleSaveProject);
    window.electronAPI.onMenuImportAudio(handleImportAudio);

    // Load existing transcription jobs
    loadTranscriptionJobs();

    // Cleanup listeners on unmount
    return () => {
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
    if (isImporting) {
      console.log('Import already in progress, ignoring...');
      return;
    }

    try {
      setIsImporting(true);
      console.log('=== STARTING AUDIO IMPORT ===');
      console.log('electronAPI available:', !!window.electronAPI);
      console.log('importAudioDialog available:', !!window.electronAPI?.importAudioDialog);
      console.log('startTranscription available:', !!window.electronAPI?.startTranscription);
      console.log('Selected model size:', selectedModelSize);
      
      if (!window.electronAPI?.importAudioDialog) {
        throw new Error('Electron API importAudioDialog is not available. Please restart the application.');
      }

      if (!window.electronAPI?.startTranscription) {
        throw new Error('Electron API startTranscription is not available. Please restart the application.');
      }
      
      console.log('Opening file dialog...');
      const result = await window.electronAPI.importAudioDialog();
      console.log('Dialog result:', JSON.stringify(result, null, 2));
      
      if (result.success && result.filePath) {
        console.log('File selected:', result.filePath);
        console.log('File exists check:', (result as any).fileExists);
        console.log('File size:', (result as any).fileSize ? `${((result as any).fileSize / 1024 / 1024).toFixed(2)} MB` : 'Unknown');
        
        console.log('Starting transcription...');
        const transcriptionResult = await window.electronAPI.startTranscription(result.filePath, selectedModelSize);
        console.log('Transcription result:', JSON.stringify(transcriptionResult, null, 2));
        
        if (transcriptionResult.success) {
          console.log('✅ Transcription started successfully');
          // Refresh the jobs list
          await loadTranscriptionJobs();
          console.log('Jobs list refreshed');
        } else {
          console.error('❌ Transcription failed:', transcriptionResult.error);
          alert(`Failed to start transcription:\n\n${transcriptionResult.error}\n\nPlease check the console for more details.`);
        }
      } else if ((result as any).cancelled) {
        console.log('User cancelled file selection');
      } else {
        console.log('No file selected or dialog failed:', result);
        if ((result as any).error) {
          alert(`File selection failed: ${(result as any).error}`);
        }
      }
    } catch (error) {
      console.error('❌ IMPORT AUDIO ERROR:', error);
      console.error('Error stack:', (error as any).stack);
      alert(`An unexpected error occurred while importing audio:\n\n${(error as any).message}\n\nPlease check the console for more details and try restarting the application.`);
    } finally {
      setIsImporting(false);
      console.log('=== AUDIO IMPORT COMPLETED ===');
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

  const handleOpenProject = async () => {
    console.log('Open project requested');
    // For now, show info about this feature
    alert('Open Project functionality is not yet implemented.\n\nThis feature will allow you to:\n• Open saved project files (.json)\n• Resume work on previous transcriptions\n• Import project data with settings\n\nCurrently, you can access recent projects from the left panel or use "Open Recent" to open the most recent completed project.');
  };

  const handleOpenRecent = () => {
    // Find the most recent completed job
    const completedJobs = transcriptionJobs.filter((job: TranscriptionJob) => job.status === 'completed');
    if (completedJobs.length > 0) {
      // Sort by ID (which should be chronological) and get the most recent
      const mostRecent = completedJobs.sort((a: TranscriptionJob, b: TranscriptionJob) => b.id.localeCompare(a.id))[0];
      console.log('Opening most recent project:', mostRecent.fileName);
      handleOpenPlaybackMode(mostRecent);
    } else {
      alert('No recent projects found. Import an audio file to get started.');
    }
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
    <div className="launch-container">
      {/* Left Panel - Recent Projects */}
      <div className="left-panel">
        <div className="panel-header">
          <div className="panel-title">Recent Projects</div>
          <div className="panel-subtitle">Continue where you left off</div>
        </div>
        <div className="recent-projects">
          {transcriptionJobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <div className="empty-text">No recent projects</div>
              <div className="empty-hint">Import audio to get started</div>
            </div>
          ) : (
            transcriptionJobs.map((job) => (
              <div key={job.id} className="project-item" onClick={() => handleOpenPlaybackMode(job)}>
                <div className="project-name">{job.fileName}</div>
                <div className="project-meta">
                  {job.result?.segments?.length || 0} segments • {job.result?.language || 'Unknown language'}
                </div>
                <div className={`project-status status-${job.status}`}>
                  {job.status === 'completed' ? 'Completed' : 
                   job.status === 'processing' ? `Processing ${job.progress}%` : 
                   job.status === 'error' ? 'Error' : job.status}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Center Panel - Main Content */}
      <div className="center-panel">
        <div className="center-content">
          <div className="app-header">
            <div className="app-logo">
              <div className="logo-icon">🎙️</div>
              <div>
                <h1 className="app-title">PodcastTranscriber</h1>
                <p className="app-subtitle">Professional podcast transcript editor</p>
              </div>
            </div>
          </div>

          <div className="quick-actions">
            <div className={`action-card primary ${isImporting ? 'loading' : ''}`} onClick={importAudio}>
              <div className="action-icon">{isImporting ? '⏳' : '🎵'}</div>
              <div className="action-title">{isImporting ? 'Importing Audio...' : 'Import Audio'}</div>
              <div className="keyboard-hint">⌘I</div>
            </div>
            <div className="action-card" onClick={handleOpenProject}>
              <div className="action-icon">📂</div>
              <div className="action-title">Open Project</div>
              <div className="keyboard-hint">⌘O</div>
            </div>
            <div className="action-card" onClick={handleOpenRecent}>
              <div className="action-icon">🔄</div>
              <div className="action-title">Open Recent</div>
              <div className="keyboard-hint">⌘R</div>
            </div>
          </div>
        </div>

        <div className="app-footer">
          <div className="footer-text">
            Built with ❤️ for professional podcast production workflows
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Help</a>
            <a href="#" className="footer-link">Tutorials</a>
            <a href="#" className="footer-link">Feedback</a>
          </div>
        </div>
      </div>

      {/* Right Panel - Settings */}
      <div className="right-panel">
        <div className="panel-header">
          <div className="panel-title">Settings</div>
          <div className="panel-subtitle">Configure your workspace</div>
        </div>
        <div className="settings-section">
          <div className="setting-item">
            <label className="setting-label" htmlFor="model-size">WhisperX Model</label>
            <select 
              id="model-size" 
              className="setting-select"
              value={selectedModelSize} 
              onChange={(e) => setSelectedModelSize(e.target.value)}
            >
              <option value="tiny">Tiny (fastest)</option>
              <option value="base">Base (balanced)</option>
              <option value="small">Small (better)</option>
              <option value="medium">Medium (good)</option>
              <option value="large">Large (best)</option>
            </select>
          </div>
          <div className="setting-item">
            <label className="setting-label" htmlFor="startup-action">Startup Action</label>
            <select id="startup-action" className="setting-select">
              <option value="ask">Show this screen</option>
              <option value="recent">Open recent project</option>
              <option value="import">Import audio dialog</option>
            </select>
          </div>
          <div className="setting-item">
            <label className="setting-label" htmlFor="auto-save">Auto-save Interval</label>
            <select id="auto-save" className="setting-select">
              <option value="5">Every 5 minutes</option>
              <option value="10">Every 10 minutes</option>
              <option value="0">Disabled</option>
            </select>
          </div>
        </div>
        <div className="system-info">
          <div className="info-item">
            <span className="info-label">Version</span>
            <span className="info-value">{version}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Platform</span>
            <span className="info-value">{platform}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;