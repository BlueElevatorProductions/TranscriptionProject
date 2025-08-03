/**
 * Refactored App.tsx - Centralized using Context providers and modular views
 * This version demonstrates the improved architecture with separated concerns
 */

import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// Error boundary for transcription crashes
class TranscriptionErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Transcription Error Boundary caught an error:', error, errorInfo);
    
    // Try to reset app state
    if ((window as any).electronAPI?.resetTranscriptionState) {
      (window as any).electronAPI.resetTranscriptionState();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <div className="error-content">
            <h2>Transcription Error</h2>
            <p>The transcription process encountered an error and needs to restart.</p>
            <p><strong>Error:</strong> {this.state.error?.message || 'Unknown error'}</p>
            <button onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}>
              Restart App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Context providers and hooks
import { AppProviders, useTranscription, useProject, useSelectedJob, useAudio, useNotifications } from './contexts';

// Custom hooks
import { useTranscriptionErrorHandler } from './hooks/useTranscriptionErrorHandler';

// View components
import { HomeView, TranscriptionProgressView, SpeakerIdentificationView, PlaybackView, NewLayoutView } from './views';

// Dialogs and shared components
import ImportDialog from './components/ImportDialog/ImportDialog';
import ProjectImportDialog from './components/ImportDialog/ProjectImportDialog';
import ApiSettings from './components/Settings/ApiSettings';
import BottomAudioPlayer from './components/shared/BottomAudioPlayer';
import SaveButton from './components/shared/SaveButton';
import ToastContainer from './components/Notifications/ToastContainer';
import ErrorModal from './components/Modals/ErrorModal';
import NewProjectDialog from './components/NewProject/NewProjectDialog';

// Types
import { ViewType, TranscriptionJob, ProjectData } from './types';

// ==================== Core App Component ====================

const AppCore: React.FC = () => {
  // Local UI state (minimal - most state is now in contexts)
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [version, setVersion] = useState<string>('1.0.0');
  const [platform, setPlatform] = useState<string>('unknown');
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [showNewLayout, setShowNewLayout] = useState<boolean>(false);
  
  // Dialog state
  const [showImportDialog, setShowImportDialog] = useState<boolean>(false);
  const [showProjectImportDialog, setShowProjectImportDialog] = useState<boolean>(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState<boolean>(false);
  const [showApiSettings, setShowApiSettings] = useState<boolean>(false);
  const [currentApiKeys, setCurrentApiKeys] = useState<{ [service: string]: string }>({});

  // Context hooks
  const { actions: transcriptionActions } = useTranscription();
  const { actions: projectActions, state: projectState } = useProject();
  const { selectedJob } = useSelectedJob();
  const { state: audioState, actions: audioActions } = useAudio();
  const { state: notificationState, dismissToast } = useNotifications();
  
  // Error handling
  const { handleTranscriptionError, handleApiKeyError } = useTranscriptionErrorHandler();

  // ==================== Initialization ====================

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const appVersion = await (window as any).electronAPI.getVersion();
        const appPlatform = await (window as any).electronAPI.getPlatform();
        setVersion(appVersion);
        setPlatform(appPlatform);
        setIsInitialized(true);
        console.log('App initialized:', { version: appVersion, platform: appPlatform });
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setInitError('Failed to initialize application');
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []);

  // ==================== IPC Event Handlers ====================

  useEffect(() => {
    const handleTranscriptionComplete = (completedJob: any) => {
      console.log('=== TRANSCRIPTION COMPLETE DEBUG START ===');
      console.log('Job ID:', completedJob?.id);
      console.log('Job status:', completedJob?.status);
      console.log('Has result:', !!completedJob?.result);
      console.log('Segments count:', completedJob?.result?.segments?.length || 0);
      console.log('Speakers:', Object.keys(completedJob?.result?.speakers || {}));
      
      try {
        if (completedJob?.id && completedJob?.result) {
          console.log('Calling transcriptionActions.completeJob...');
          transcriptionActions.completeJob(completedJob.id, completedJob.result);
          console.log('Successfully completed job, switching to speaker-identification...');
          setCurrentView('speaker-identification');
          console.log('View switch completed');
        } else {
          console.error('Invalid completed job data:', completedJob);
        }
      } catch (error) {
        console.error('Error in handleTranscriptionComplete:', error);
        console.error('Error stack:', error.stack);
      }
      
      console.log('=== TRANSCRIPTION COMPLETE DEBUG END ===');
    };

    const handleTranscriptionProgress = (progressJob: any) => {
      console.log('App - Transcription progress:', progressJob);
      
      if (progressJob?.id) {
        transcriptionActions.updateJobProgress(
          progressJob.id, 
          progressJob.progress || 0, 
          progressJob.status
        );
      }
    };

    const handleTranscriptionError = (error: any) => {
      console.error('App - Transcription error:', error);
      
      if (error?.id || error?.transcriptionId) {
        const errorId = error.id || error.transcriptionId;
        // Update job with error status
        transcriptionActions.updateJobProgress(errorId, 0, 'error');
      }

      // Handle the error with notifications
      if (error?.errorData) {
        // Structured error from backend
        handleTranscriptionError(error.errorData, 'transcription');
      } else if (error?.message || error?.error) {
        // Simple error message
        const errorObj = {
          message: error.message || error.error || 'Transcription failed',
          code: error.code || 'TRANSCRIPTION_FAILED'
        };
        handleTranscriptionError(errorObj, 'transcription');
      }
    };

    // Set up IPC listeners
    (window as any).electronAPI?.onTranscriptionComplete?.(handleTranscriptionComplete);
    (window as any).electronAPI?.onTranscriptionProgress?.(handleTranscriptionProgress);
    (window as any).electronAPI?.onTranscriptionError?.(handleTranscriptionError);

    return () => {
      (window as any).electronAPI?.removeAllListeners?.('transcription-complete');
      (window as any).electronAPI?.removeAllListeners?.('transcription-progress');
      (window as any).electronAPI?.removeAllListeners?.('transcription-error');
    };
  }, [transcriptionActions, handleTranscriptionError]);

  // ==================== Custom Event Listeners ====================

  useEffect(() => {
    // Listen for API settings requests from error notifications
    const handleApiSettingsRequest = () => {
      setCurrentView('home'); // Navigate to home first
      handleOpenApiSettings();
    };

    const handleTranscriptionRetry = (event: CustomEvent) => {
      const { errorInfo, originalError } = event.detail;
      console.log('Retry requested for transcription error:', errorInfo);
      
      // Here we could implement retry logic
      // For now, just log the retry attempt
      if (selectedJob) {
        console.log('Retrying transcription for job:', selectedJob.fileName);
        // Could call transcriptionActions.startTranscription again
      }
    };

    // Add event listeners
    window.addEventListener('open-api-settings', handleApiSettingsRequest as EventListener);
    window.addEventListener('transcription-retry', handleTranscriptionRetry as EventListener);

    return () => {
      window.removeEventListener('open-api-settings', handleApiSettingsRequest as EventListener);
      window.removeEventListener('transcription-retry', handleTranscriptionRetry as EventListener);
    };
  }, [selectedJob, transcriptionActions]);

  // ==================== Event Handlers ====================

  const handleFileImport = useCallback(async (filePath: string, modelSize: string) => {
    console.log('App - File import requested:', { filePath, modelSize });
    
    try {
      // DO NOT create project structure here - just start transcription
      // Project creation will happen AFTER transcription and speaker identification complete
      console.log('Starting transcription without project creation (crash fix)');
      
      await transcriptionActions.startTranscription(filePath, modelSize);
      setCurrentView('transcription-progress');
      setShowImportDialog(false);
    } catch (error) {
      console.error('App - Failed to start transcription:', error);
    }
  }, [transcriptionActions]);

  const handleJobSelect = useCallback((job: TranscriptionJob) => {
    console.log('App - Job selected:', job.fileName);
    transcriptionActions.selectJob(job);
    
    if (job.status === 'completed' && job.result) {
      setCurrentView('speaker-identification');
    } else {
      setCurrentView('transcription-progress');
    }
  }, [transcriptionActions]);

  const handleSpeakerIdentificationComplete = useCallback(async (result: { 
    speakerNames: { [key: string]: string }, 
    speakerMerges?: { [key: string]: string } 
  }) => {
    console.log('App - Speaker identification complete:', result);
    
    if (selectedJob) {
      // CREATE PROJECT STRUCTURE ONLY NOW - AFTER EVERYTHING IS READY
      try {
        console.log('Creating project structure after transcription completion...');
        
        const projectData = {
          project: {
            version: '1.0',
            projectId: Date.now().toString(),
            name: selectedJob.fileName.replace(/\.[^/.]+$/, ""), // Remove extension
            description: '',
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            author: 'User',
            
            audio: {
              originalFile: selectedJob.filePath,
              originalName: selectedJob.fileName,
              duration: 0,
              sampleRate: 44100,
              channels: 2,
              format: selectedJob.fileName.split('.').pop() || 'wav',
              checksum: '',
              processedFile: null
            },
            
            transcription: {
              provider: 'completed',
              model: 'unknown',
              language: 'en',
              timestamp: new Date().toISOString(),
              status: 'completed',
              confidence: 0.95,
              dataFile: 'transcription.json'
            },
            
            ui: {
              currentMode: 'playback',
              sidebarWidth: 300,
              playbackSpeed: 1.0,
              volume: 0.8,
              currentTime: 0,
              selectedSegmentId: null
            }
          },
          
          transcription: {
            version: '1.0',
            segments: selectedJob.result?.segments || [],
            speakers: result.speakerNames || {},
            globalMetadata: {
              totalSegments: selectedJob.result?.segments?.length || 0,
              totalWords: 0,
              averageConfidence: 0.95,
              processingTime: 0,
              editCount: 0
            }
          },
          
          speakers: {
            version: '1.0',
            speakers: result.speakerNames || {},
            speakerMappings: result.speakerNames || {},
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
        
        // Load this into project context WITHOUT saving to disk yet
        projectActions.loadProject(projectData);
        projectActions.setUnsavedChanges(true); // Mark as needing save
        
        console.log('Project structure created successfully');
        
      } catch (projectError) {
        console.error('Failed to create project structure:', projectError);
        // Continue to playback even if project creation fails
      }
      
      // Set audio source
      if (selectedJob.filePath) {
        audioActions.setAudioSource(selectedJob.filePath, 0);
      }
      
      setCurrentView('playback');
    }
  }, [selectedJob, projectActions, audioActions]);

  const handleProjectLoaded = useCallback((loadedProjectData: ProjectData) => {
    console.log('App - Project loaded:', loadedProjectData.project.name);
    
    projectActions.loadProject(loadedProjectData);
    
    // Convert to transcription job format for compatibility
    // Use resolvedPath for embedded audio, fallback to originalFile for compatibility
    const audioPath = loadedProjectData.project.audio?.resolvedPath || 
                     loadedProjectData.project.audio?.originalFile || '';
    
    const job: TranscriptionJob = {
      id: loadedProjectData.project.projectId,
      filePath: audioPath,
      fileName: loadedProjectData.project.audio?.originalName || loadedProjectData.project.name,
      status: 'completed',
      progress: 100,
      result: {
        segments: loadedProjectData.transcription?.segments || [],
        language: 'en',
        speakers: loadedProjectData.speakers?.speakerMappings || {},
      },
      speakerNames: loadedProjectData.speakers?.speakerMappings || {},
    };
    
    transcriptionActions.selectJob(job);
    
    // Set audio source
    if (job.filePath) {
      audioActions.setAudioSource(job.filePath, 0);
    }
    
    setCurrentView('playback');
    setShowProjectImportDialog(false);
  }, [projectActions, transcriptionActions, audioActions]);

  const handleOpenApiSettings = useCallback(async () => {
    try {
      const existingKeys = await (window as any).electronAPI.getApiKeys();
      setCurrentApiKeys(existingKeys || {});
      setShowApiSettings(true);
    } catch (error) {
      console.error('App - Failed to load API keys:', error);
      setShowApiSettings(true);
    }
  }, []);

  const handleApiKeysUpdate = useCallback((apiKeys: { [service: string]: string }) => {
    setCurrentApiKeys(apiKeys);
  }, []);

  // ==================== Project Management ====================

  const handleNewProject = useCallback(() => {
    setShowNewProjectDialog(true);
  }, []);

  const handleOpenExistingProject = useCallback(() => {
    setShowProjectImportDialog(true);
  }, []);

  const handleCreateProject = useCallback(async (projectName: string, projectPath: string) => {
    try {
      // Create a new project structure
      const newProject: ProjectData = {
        project: {
          projectId: Date.now().toString(),
          name: projectName,
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: '1.0',
          audio: null
        },
        transcription: {
          segments: [],
          language: 'en'
        },
        speakers: {
          speakerMappings: {},
          speakerClips: {}
        }
      };

      // Save the empty project package
      await (window as any).electronAPI.saveProject(newProject, projectPath);
      
      // Load the project into the app with the path
      projectActions.loadProject(newProject);
      projectActions.setProjectPath(projectPath);
      
      // Close dialog and show import dialog
      setShowNewProjectDialog(false);
      setShowImportDialog(true);

      console.log('New project package created:', projectName, 'at', projectPath);
    } catch (error) {
      console.error('Failed to create project package:', error);
      handleTranscriptionError(error, 'project creation');
    }
  }, [projectActions, handleTranscriptionError]);

  // ==================== New Layout Handler ====================

  const handleShowNewLayout = useCallback(() => {
    setShowNewLayout(true);
  }, []);

  const handleHideNewLayout = useCallback(() => {
    setShowNewLayout(false);
  }, []);

  // ==================== Audio Source Management ====================

  const currentAudioPath = selectedJob?.filePath || null;

  // Legacy compatibility wrapper for audio state updates
  const handleAudioStateUpdate = useCallback((updates: Partial<typeof audioState>) => {
    audioActions.updateAudioState(updates);
  }, [audioActions]);

  // ==================== Render Loading/Error States ====================

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

  // ==================== Main App Render ====================

  // If showing new layout, render it instead of main app
  if (showNewLayout) {
    return (
      <TranscriptionErrorBoundary>
        <NewLayoutView onBack={handleHideNewLayout} />
      </TranscriptionErrorBoundary>
    );
  }

  return (
    <TranscriptionErrorBoundary>
      <div className="app">
      {/* Header */}
      <div className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">🎙️ TranscriptionProject</h1>
          {projectState.projectData && (
            <span className="project-name">
              {projectState.projectData.project?.name || 'Untitled Project'}
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
              onSave={projectActions.saveProject}
              hasUnsavedChanges={projectState.hasUnsavedChanges}
              projectName={projectState.projectData?.project?.name}
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

      {/* Main Content - Route to Views */}
      <div className="app-content">
        {currentView === 'home' && (
          <HomeView
            onNewProject={handleNewProject}
            onOpenProject={handleOpenExistingProject}
            onJobSelect={handleJobSelect}
            onShowNewLayout={handleShowNewLayout}
          />
        )}

        {currentView === 'transcription-progress' && (
          <TranscriptionProgressView
            onBack={() => setCurrentView('home')}
          />
        )}

        {currentView === 'speaker-identification' && (
          <SpeakerIdentificationView
            onComplete={handleSpeakerIdentificationComplete}
            onSkip={() => setCurrentView('home')}
          />
        )}

        {currentView === 'playback' && (
          <PlaybackView
            onBack={() => setCurrentView('home')}
          />
        )}
      </div>

      {/* Bottom Audio Player */}
      {selectedJob && currentAudioPath && (
        <BottomAudioPlayer
          audioSrc={currentAudioPath}
          fileName={selectedJob.fileName}
          sharedAudioState={{
            currentTime: audioState.currentTime,
            isPlaying: audioState.isPlaying,
            volume: audioState.volume,
            playbackSpeed: audioState.playbackSpeed,
          }}
          onAudioStateUpdate={handleAudioStateUpdate}
        />
      )}

      {/* Dialogs */}
      {showNewProjectDialog && (
        <NewProjectDialog
          isOpen={showNewProjectDialog}
          onClose={() => setShowNewProjectDialog(false)}
          onCreateProject={handleCreateProject}
        />
      )}

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

      {/* Toast Notifications */}
      <ToastContainer
        toasts={notificationState.toasts}
        position="top-right"
        onDismiss={dismissToast}
      />
    </div>
    </TranscriptionErrorBoundary>
  );
};

// ==================== App with Providers ====================

const App: React.FC = () => {
  return (
    <AppProviders>
      <AppCore />
      {/* Uncomment for development debugging */}
      {/* <ContextDebugPanel /> */}
    </AppProviders>
  );
};

export default App;