/**
 * Refactored App.tsx - Centralized using Context providers and modular views
 * This version demonstrates the improved architecture with separated concerns
 */

import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// Context providers and hooks
import { AppProviders, useTranscription, useProject, useSelectedJob, useAudio } from './contexts';

// View components
import { HomeView, TranscriptionProgressView, SpeakerIdentificationView, PlaybackView } from './views';

// Dialogs and shared components
import ImportDialog from './components/ImportDialog/ImportDialog';
import ProjectImportDialog from './components/ImportDialog/ProjectImportDialog';
import ApiSettings from './components/Settings/ApiSettings';
import BottomAudioPlayer from './components/shared/BottomAudioPlayer';
import SaveButton from './components/shared/SaveButton';

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
  
  // Dialog state
  const [showImportDialog, setShowImportDialog] = useState<boolean>(false);
  const [showProjectImportDialog, setShowProjectImportDialog] = useState<boolean>(false);
  const [showApiSettings, setShowApiSettings] = useState<boolean>(false);
  const [currentApiKeys, setCurrentApiKeys] = useState<{ [service: string]: string }>({});

  // Context hooks
  const { actions: transcriptionActions } = useTranscription();
  const { actions: projectActions, state: projectState } = useProject();
  const { selectedJob } = useSelectedJob();
  const { state: audioState, actions: audioActions } = useAudio();

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
      console.log('App - Transcription completed:', completedJob);
      
      if (completedJob?.id && completedJob?.result) {
        transcriptionActions.completeJob(completedJob.id, completedJob.result);
        setCurrentView('speaker-identification');
      }
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
        transcriptionActions.errorJob(errorId, error.message || 'Unknown error');
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
  }, [transcriptionActions]);

  // ==================== Event Handlers ====================

  const handleFileImport = useCallback(async (filePath: string, modelSize: string) => {
    console.log('App - File import requested:', { filePath, modelSize });
    
    try {
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

  const handleSpeakerIdentificationComplete = useCallback((result: { 
    speakerNames: { [key: string]: string }, 
    speakerMerges?: { [key: string]: string } 
  }) => {
    console.log('App - Speaker identification complete:', result);
    
    if (selectedJob) {
      // Update project with speaker data and segments
      projectActions.updateSpeakers(result.speakerNames);
      
      if (selectedJob.result?.segments) {
        projectActions.updateSegments(selectedJob.result.segments);
      }
      
      // Set audio source
      if (selectedJob.filePath) {
        audioActions.setAudioSource(selectedJob.filePath, 0); // Duration will be set by audio player
      }
      
      projectActions.setUnsavedChanges(true);
      setCurrentView('playback');
    }
  }, [selectedJob, projectActions, audioActions]);

  const handleProjectLoaded = useCallback((loadedProjectData: ProjectData) => {
    console.log('App - Project loaded:', loadedProjectData.project.name);
    
    projectActions.loadProject(loadedProjectData);
    
    // Convert to transcription job format for compatibility
    const job: TranscriptionJob = {
      id: loadedProjectData.project.projectId,
      filePath: loadedProjectData.project.audio?.originalFile || '',
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

  return (
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
            onImportClick={() => setShowImportDialog(true)}
            onJobSelect={handleJobSelect}
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

// ==================== App with Providers ====================

const AppRefactored: React.FC = () => {
  return (
    <AppProviders>
      <AppCore />
      {/* Uncomment for development debugging */}
      {/* <ContextDebugPanel /> */}
    </AppProviders>
  );
};

export default AppRefactored;