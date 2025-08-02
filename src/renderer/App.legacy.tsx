import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import PlaybackModeContainer from './components/PlaybackMode/PlaybackModeContainer';
import TranscriptEditContainer from './components/TranscriptEdit/TranscriptEditContainer';
import SpeakerIdentification from './components/SpeakerIdentification/SpeakerIdentification';
import ImportDialog from './components/ImportDialog/ImportDialog';
import ProjectImportDialog from './components/ImportDialog/ProjectImportDialog';
import ApiSettings from './components/Settings/ApiSettings';
import BottomAudioPlayer from './components/shared/BottomAudioPlayer';
import SaveButton from './components/shared/SaveButton';

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
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [version, setVersion] = useState<string>('1.0.0');
  const [platform, setPlatform] = useState<string>('unknown');
  const [transcriptionJobs, setTranscriptionJobs] = useState<TranscriptionJob[]>([]);
  
  // Simple state management for polling approach
  const [currentView, setCurrentView] = useState<'home' | 'transcription-progress' | 'speaker-identification' | 'playback'>('home');
  const [selectedJob, setSelectedJob] = useState<TranscriptionJob | null>(null);
  const [showImportDialog, setShowImportDialog] = useState<boolean>(false);
  const [showProjectImportDialog, setShowProjectImportDialog] = useState<boolean>(false);
  const [showApiSettings, setShowApiSettings] = useState<boolean>(false);
  
  // Project file management state
  const [projectData, setProjectData] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  const [currentApiKeys, setCurrentApiKeys] = useState<{ [service: string]: string }>({});
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState<string | null>(null);
  const [progressData, setProgressData] = useState({
    fileName: '',
    progress: 0,
    status: 'Starting...'
  });
  
  // Mode switching state
  const [playbackMode, setPlaybackMode] = useState<'playback' | 'transcript-edit'>('playback');
  
  // Shared speaker state management
  const [globalSpeakers, setGlobalSpeakers] = useState<{[key: string]: string}>({});
  
  // Shared audio state management
  const [sharedAudioState, setSharedAudioState] = useState({
    currentTime: 0,
    isPlaying: false,
    volume: 0.7,
    playbackSpeed: 1.0
  });

  // Safe audio state update function that preserves all properties
  const handleAudioStateUpdate = useCallback((updates: Partial<typeof sharedAudioState>) => {
    setSharedAudioState(prevState => {
      const newState = {
        ...prevState,
        ...updates
      };
      
      // Ensure isPlaying is always a boolean
      if (typeof newState.isPlaying !== 'boolean') {
        newState.isPlaying = false;
      }
      
      // Ensure other values are valid numbers
      if (isNaN(newState.currentTime) || newState.currentTime === null || newState.currentTime === undefined) {
        newState.currentTime = prevState.currentTime || 0;
      }
      if (isNaN(newState.volume) || newState.volume === null || newState.volume === undefined) {
        newState.volume = prevState.volume || 0.7;
      }
      if (isNaN(newState.playbackSpeed) || newState.playbackSpeed === null || newState.playbackSpeed === undefined) {
        newState.playbackSpeed = prevState.playbackSpeed || 1.0;
      }
      
      console.log('App - Audio state update:', { prevState, updates, newState });
      return newState;
    });
  }, []);
  
  // Shared edited segments state management
  const [editedSegments, setEditedSegments] = useState<any[]>([]);
  
  // Audio source management
  const currentAudioPath = selectedJob ? selectedJob.filePath : null;

  // Project file management functions - defined early to avoid dependency issues
  const handleSave = useCallback(async () => {
    if (!selectedJob || !projectData) {
      console.log('No project data to save');
      return;
    }

    try {
      // Prepare project data for saving
      const saveData = {
        project: {
          ...projectData.project,
          lastModified: new Date().toISOString(),
          transcription: {
            ...projectData.project.transcription,
            status: 'completed'
          },
          ui: {
            currentMode: playbackMode,
            sidebarWidth: 300,
            playbackSpeed: sharedAudioState.playbackSpeed,
            volume: sharedAudioState.volume,
            currentTime: sharedAudioState.currentTime,
            selectedSegmentId: null
          }
        },
        transcription: {
          version: '1.0',
          segments: editedSegments,
          speakers: globalSpeakers,
          globalMetadata: {
            totalSegments: editedSegments.length,
            totalWords: editedSegments.reduce((sum, seg) => sum + (seg.words?.length || 0), 0),
            averageConfidence: 0.95,
            processingTime: 0,
            editCount: 0
          }
        },
        speakers: {
          version: '1.0',
          speakers: globalSpeakers,
          speakerMappings: globalSpeakers,
          defaultSpeaker: 'SPEAKER_00'
        },
        clips: {
          version: '1.0',
          clips: [],
          clipSettings: {
            defaultDuration: 30.0,
            autoExport: false,
            exportFormat: 'mp3'
          }
        }
      };

      let filePath = currentProjectPath;
      
      if (!filePath) {
        // Show save dialog for new projects
        const result = await (window as any).electronAPI.saveProjectDialog(
          `${projectData.project.name || 'Untitled'}.transcript`
        );
        
        if (result.canceled || !result.filePath) {
          return;
        }
        
        filePath = result.filePath;
        setCurrentProjectPath(filePath);
      }

      // Save project file
      await (window as any).electronAPI.saveProject(saveData, filePath);
      
      setHasUnsavedChanges(false);
      console.log('Project saved successfully');
      
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    }
  }, [selectedJob, projectData, currentProjectPath, playbackMode, sharedAudioState, editedSegments, globalSpeakers]);

  const handleProjectLoaded = useCallback((loadedProjectData: any) => {
    console.log('Project loaded:', loadedProjectData);
    setProjectData(loadedProjectData);
    
    // Convert loaded project to transcription job format
    setSelectedJob({
      id: loadedProjectData.project.projectId,
      filePath: loadedProjectData.project.audio?.originalFile || '',
      fileName: loadedProjectData.project.audio?.originalName || loadedProjectData.project.name,
      status: 'completed',
      progress: 100,
      result: loadedProjectData.transcription,
      speakerNames: loadedProjectData.speakers?.speakerMappings || loadedProjectData.speakers?.speakers || {}
    });
    
    // Set up speakers and segments
    setGlobalSpeakers(loadedProjectData.speakers?.speakerMappings || loadedProjectData.speakers?.speakers || {});
    setEditedSegments(loadedProjectData.transcription?.segments || []);
    
    setHasUnsavedChanges(false);
    setCurrentProjectPath(null); // Will be set when user saves
    setCurrentView('playback');
  }, []);

  // Initialize app state
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const appVersion = await (window as any).electronAPI.getVersion();
        const appPlatform = await (window as any).electronAPI.getPlatform();
        setVersion(appVersion);
        setPlatform(appPlatform);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setInitError('Failed to initialize application');
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []);

  // Handle transcription completion
  useEffect(() => {
    const handleTranscriptionComplete = (completedJob: any) => {
      console.log('Transcription completed:', completedJob);
      console.log('Completed job result:', completedJob?.result);
      console.log('Completed job has segments?', completedJob?.result?.segments?.length > 0);
      
      if (!completedJob) {
        console.error('Completed job is undefined');
        return;
      }
      
      if (completedJob && completedJob.id) {
        setTranscriptionJobs(prev => prev.map(job => 
          job.id === completedJob.id 
            ? { 
                ...job, 
                status: 'completed', 
                progress: 100, 
                result: completedJob.result,
                speakerNames: completedJob.result?.speakers || {}
              }
            : job
        ));
        
        setCurrentTranscriptionId(completedJob.id);
        console.log('DEBUG: Setting currentView to speaker-identification');
        console.log('DEBUG: Setting selectedJob to:', completedJob);
        setSelectedJob(completedJob);
        setCurrentView('speaker-identification');
      }
    };

    const handleTranscriptionProgress = (progressJob: any) => {
      console.log('Transcription progress received:', progressJob);
      
      if (!progressJob) {
        console.error('Progress job is undefined');
        return;
      }
      
      setProgressData({
        fileName: progressJob.fileName || '',
        progress: progressJob.progress || 0,
        status: progressJob.status || 'Processing...'
      });
      
      if (progressJob.id) {
        setTranscriptionJobs(prev => prev.map(job => 
          job.id === progressJob.id 
            ? { ...job, progress: progressJob.progress || 0, status: progressJob.status || 'processing' }
            : job
        ));
      }
    };

    const handleTranscriptionError = (error: any) => {
      console.error('Transcription error:', error);
      
      if (!error) {
        console.error('Error object is undefined');
        return;
      }
      
      if (error.transcriptionId || error.id) {
        const errorId = error.transcriptionId || error.id;
        setTranscriptionJobs(prev => prev.map(job => 
          job.id === errorId 
            ? { ...job, status: 'error', error: error.message || 'Unknown error' }
            : job
        ));
      }
    };

    (window as any).electronAPI?.onTranscriptionComplete?.(handleTranscriptionComplete);
    (window as any).electronAPI?.onTranscriptionProgress?.(handleTranscriptionProgress);
    (window as any).electronAPI?.onTranscriptionError?.(handleTranscriptionError);

    // Debug event listener
    const handleDebugLog = (message: string) => {
      console.log('🔧 DEBUG FROM MAIN:', message);
    };
    (window as any).electronAPI?.onDebugLog?.(handleDebugLog);

    return () => {
      (window as any).electronAPI?.removeAllListeners?.('transcription-complete');
      (window as any).electronAPI?.removeAllListeners?.('transcription-progress');
      (window as any).electronAPI?.removeAllListeners?.('transcription-error');
    };
  }, []);

  // Polling for transcription updates - fallback mechanism
  useEffect(() => {
    const interval = setInterval(async () => {
      if (transcriptionJobs.length > 0) {
        try {
          const updates = await (window as any).electronAPI.getTranscriptionUpdates();
          if (updates && updates.length > 0) {
            setTranscriptionJobs(prevJobs => {
              const updatedJobs = [...prevJobs];
              updates.forEach((update: any) => {
                const jobIndex = updatedJobs.findIndex(job => job.id === update.id);
                if (jobIndex !== -1) {
                  updatedJobs[jobIndex] = { ...updatedJobs[jobIndex], ...update };
                }
              });
              return updatedJobs;
            });
          }
        } catch (error) {
          console.error('Error polling for updates:', error);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [transcriptionJobs.length]);

  // Event handlers
  const handleFileImport = async (filePath: string, modelSize: string) => {
    console.log('DEBUG: handleFileImport called with:', { filePath, modelSize });
    try {
      const fileName = filePath.split('/').pop() || 'Unknown';
      
      const job: TranscriptionJob = {
        id: Date.now().toString(),
        filePath: filePath,
        fileName: fileName,
        status: 'pending',
        progress: 0
      };

      console.log('DEBUG: Created job:', job);
      setTranscriptionJobs(prev => [...prev, job]);
      setCurrentView('transcription-progress');
      
      console.log('DEBUG: Calling startTranscription...');
      const result = await (window as any).electronAPI.startTranscription(filePath, modelSize);
      console.log('DEBUG: startTranscription result:', result);
      
      // Update the job with the actual jobId from main process
      if (result.success && result.jobId) {
        console.log('DEBUG: Updating job ID from', job.id, 'to', result.jobId);
        setTranscriptionJobs(prev => prev.map(j => 
          j.id === job.id 
            ? { ...j, id: result.jobId }
            : j
        ));
      }
    } catch (error) {
      console.error('Error starting transcription:', error);
    }
  };

  const handleJobSelect = (job: TranscriptionJob) => {
    console.log('DEBUG: Job selected:', job);
    console.log('DEBUG: Job has result?', !!job.result);
    console.log('DEBUG: Job result:', job.result);
    setSelectedJob(job);
    setCurrentView('speaker-identification');
  };

  const handleSpeakerIdentificationComplete = (result: { speakerNames: { [key: string]: string }, speakerMerges?: { [key: string]: string } }) => {
    if (selectedJob) {
      const updatedJob = {
        ...selectedJob,
        speakerNames: result.speakerNames,
        speakerMerges: result.speakerMerges
      };
      
      setSelectedJob(updatedJob);
      setGlobalSpeakers(result.speakerNames);
      
      if (updatedJob.result && updatedJob.result.segments) {
        setEditedSegments(updatedJob.result.segments);
      }
      
      setHasUnsavedChanges(true);
      setCurrentView('playback');
    }
  };

  const handleModeSwitch = (mode: 'playback' | 'transcript-edit') => {
    setPlaybackMode(mode);
  };

  const handleSegmentUpdate = (updatedSegments: any[]) => {
    setEditedSegments(updatedSegments);
    setHasUnsavedChanges(true);
  };

  const handleSpeakerUpdate = (updatedSpeakers: { [key: string]: string }) => {
    setGlobalSpeakers(updatedSpeakers);
    setHasUnsavedChanges(true);
  };

  const handleApiKeysUpdate = (apiKeys: { [service: string]: string }) => {
    setCurrentApiKeys(apiKeys);
  };

  const handleOpenApiSettings = async () => {
    try {
      // Load current API keys when opening settings
      const existingKeys = await (window as any).electronAPI.getApiKeys();
      setCurrentApiKeys(existingKeys || {});
      setShowApiSettings(true);
    } catch (error) {
      console.error('Failed to load API keys:', error);
      setShowApiSettings(true);
    }
  };

  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <h2>Loading TranscriptionProject...</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="error-screen">
        <div className="error-content">
          <h2>Initialization Error</h2>
          <p>{initError}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header with Save Button and Project Import */}
      <div className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">🎙️ TranscriptionProject</h1>
          {projectData && (
            <span className="project-name">
              {projectData.project?.name || 'Untitled Project'}
            </span>
          )}
        </div>
        
        <div className="app-header-right">
          <button 
            className="import-project-btn"
            onClick={() => setShowProjectImportDialog(true)}
            title="Import existing project"
          >
            📁 Import Project
          </button>
          
          {selectedJob && (
            <SaveButton
              onSave={handleSave}
              hasUnsavedChanges={hasUnsavedChanges}
              projectName={projectData?.project?.name}
            />
          )}
          
          <button 
            className="settings-btn"
            onClick={handleOpenApiSettings}
            title="API Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="app-content">
        {console.log('DEBUG: Current view is:', currentView)}
        {console.log('DEBUG: Selected job is:', selectedJob)}
        {currentView === 'home' && (
          <div className="home-screen">
            <div className="home-content">
              <div className="import-section">
                <h2>Import Audio File</h2>
                <p>Get started by importing an audio file for transcription</p>
                <button 
                  className="import-btn primary"
                  onClick={() => setShowImportDialog(true)}
                >
                  📁 Import Audio File
                </button>
              </div>

              {transcriptionJobs.length > 0 && (
                <div className="recent-jobs">
                  <h3>Recent Transcriptions</h3>
                  <div className="jobs-list">
                    {transcriptionJobs.map(job => (
                      <div key={job.id} className="job-item" onClick={() => handleJobSelect(job)}>
                        <div className="job-info">
                          <h4>{job.fileName}</h4>
                          <p className={`status ${job.status}`}>{job.status}</p>
                        </div>
                        <div className="job-progress">
                          {job.status === 'processing' && (
                            <div className="progress-bar">
                              <div 
                                className="progress-fill" 
                                style={{ width: `${job.progress}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'transcription-progress' && (
          <div className="transcription-progress">
            <h2>Transcribing Audio</h2>
            <div className="progress-info">
              <h3>{progressData.fileName}</h3>
              <p>{progressData.status}</p>
              <div className="progress-bar-large">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progressData.progress}%` }}
                ></div>
              </div>
              <p>{Math.round(progressData.progress)}% complete</p>
            </div>
            <button 
              className="back-btn secondary"
              onClick={() => setCurrentView('home')}
            >
              ← Back to Home
            </button>
          </div>
        )}

        {currentView === 'speaker-identification' && selectedJob && (
          <SpeakerIdentification
            transcriptionJob={selectedJob}
            onComplete={handleSpeakerIdentificationComplete}
            onSkip={() => setCurrentView('home')}
          />
        )}

        {currentView === 'playback' && selectedJob && (
          <div className="playback-container">
            <div className="mode-switcher">
              <button 
                className={playbackMode === 'playback' ? 'active' : ''}
                onClick={() => handleModeSwitch('playback')}
              >
                🎵 Playback Mode
              </button>
              <button 
                className={playbackMode === 'transcript-edit' ? 'active' : ''}
                onClick={() => handleModeSwitch('transcript-edit')}
              >
                ✏️ Transcript Edit
              </button>
            </div>

            {playbackMode === 'playback' ? (
              <PlaybackModeContainer
                transcriptionJob={selectedJob}
                editedSegments={editedSegments}
                speakers={globalSpeakers}
                onSpeakersUpdate={handleSpeakerUpdate}
                onBack={() => setCurrentView('home')}
                onSwitchToTranscriptEdit={() => handleModeSwitch('transcript-edit')}
                sharedAudioState={sharedAudioState}
                onAudioStateUpdate={handleAudioStateUpdate}
              />
            ) : (
              <TranscriptEditContainer
                transcriptionJob={selectedJob}
                editedSegments={editedSegments}
                onEditedSegmentsUpdate={handleSegmentUpdate}
                speakers={globalSpeakers}
                onSpeakersUpdate={handleSpeakerUpdate}
                onBack={() => setCurrentView('home')}
                onSwitchToPlayback={() => handleModeSwitch('playback')}
                sharedAudioState={sharedAudioState}
                onAudioStateUpdate={handleAudioStateUpdate}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom Audio Player */}
      {selectedJob && currentAudioPath && (
        <BottomAudioPlayer
          audioSrc={currentAudioPath}
          fileName={selectedJob.fileName}
          sharedAudioState={sharedAudioState}
          onAudioStateUpdate={handleAudioStateUpdate}
        />
      )}

      {/* Dialogs */}
      {showImportDialog && (
        <ImportDialog
          onClose={() => setShowImportDialog(false)}
          onImport={handleFileImport}
          onOpenApiSettings={handleOpenApiSettings}
        />
      )}

      {showProjectImportDialog && (
        <ProjectImportDialog
          isOpen={showProjectImportDialog}
          onClose={() => setShowProjectImportDialog(false)}
          onProjectLoaded={handleProjectLoaded}
        />
      )}

      {showApiSettings && (
        <ApiSettings
          onSave={(keys) => {
            handleApiKeysUpdate(keys);
            setShowApiSettings(false);
          }}
          onCancel={() => setShowApiSettings(false)}
          currentKeys={currentApiKeys}
        />
      )}
    </div>
  );
};

export default App;