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
  
  // Shared edited segments state management
  const [editedSegments, setEditedSegments] = useState<any[]>([]);
  
  // Audio source management
  const currentAudioPath = selectedJob ? selectedJob.filePath : null;
    
  // Debug logging for audio player visibility
  useEffect(() => {
    console.log('App - Debug audio player visibility:', {
      selectedJob: !!selectedJob,
      currentView,
      currentAudioPath,
      shouldShowPlayer: selectedJob && currentView === 'playback',
      selectedJobDetails: selectedJob ? {
        fileName: selectedJob.fileName,
        filePath: selectedJob.filePath,
        id: selectedJob.id,
        status: selectedJob.status
      } : null
    });
  }, [selectedJob, currentView, currentAudioPath]);


  // Sync speakers when selected job changes
  useEffect(() => {
    if (selectedJob?.speakerNames) {
      console.log('Loading speakers from job:', selectedJob.speakerNames);
      setGlobalSpeakers(selectedJob.speakerNames);
    }
  }, [selectedJob]);

  // Keyboard shortcuts for project file system
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        setShowProjectImportDialog(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedJob, projectData]);

  // Track changes to set unsaved changes indicator
  useEffect(() => {
    if (selectedJob && projectData) {
      setHasUnsavedChanges(true);
    }
  }, [editedSegments, globalSpeakers]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing app...');
        // Check if we're in Electron environment
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          console.log('Electron environment detected, setting up API listeners...');
          await setupElectronAPI();
        } else {
          console.log('Running in browser mode - Electron APIs not available');
          setVersion('1.0.0-dev');
          setPlatform('browser');
        }
        setIsInitialized(true);
        console.log('App initialization complete');
      } catch (error) {
        console.error('App initialization failed:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown initialization error');
        setIsInitialized(true); // Still show UI even with errors
      }
    };

    initializeApp();
  }, []);

  const setupElectronAPI = async () => {
    try {
      // Get app version and platform info
      const getAppInfo = async () => {
        try {
          const appVersion = await (window as any).electronAPI.getVersion();
          const appPlatform = await (window as any).electronAPI.getPlatform();
          setVersion(appVersion);
          setPlatform(appPlatform);
        } catch (error) {
          console.error('Failed to get app info:', error);
          setVersion('1.0.0-error');
          setPlatform('unknown');
        }
      };

      await getAppInfo();

      // Set up menu event listeners
      const handleSaveProject = () => {
        console.log('Save project requested');
        // TODO: Implement save project functionality
      };

      const handleImportAudio = () => {
        console.log('Import audio requested');
        setShowImportDialog(true);
      };

      // Remove all broken event listeners - using polling instead

      // Register menu event listeners
      (window as any).electronAPI.onMenuOpenProject(handleOpenProject);
      (window as any).electronAPI.onMenuSaveProject(handleSaveProject);
      (window as any).electronAPI.onMenuImportAudio(handleImportAudio);

      // Load existing transcription jobs
      loadTranscriptionJobs();
      
      // Load API keys
      loadApiKeys();

    } catch (error) {
      console.error('Failed to setup Electron API:', error);
    }
  };

  // Helper function for status messages
  const getStatusMessage = (status: string, progress: number): string => {
    if (status === 'processing') {
      if (progress < 25) return 'Loading audio file...';
      if (progress < 50) return 'Processing with WhisperX...';
      if (progress < 75) return 'Transcribing speech...';
      if (progress < 90) return 'Identifying speakers...';
      return 'Finalizing transcription...';
    }
    
    if (status === 'completed') return 'Transcription complete!';
    if (status === 'error') return 'Transcription failed';
    
    return 'Starting transcription...';
  };

  // Polling function to check transcription status
  const pollTranscriptionStatus = useCallback(async () => {
    if (!currentTranscriptionId || currentView !== 'transcription-progress') {
      return;
    }
    
    try {
      console.log('Polling transcription status for ID:', currentTranscriptionId);
      
      // Get all transcription jobs
      const jobs = await (window as any).electronAPI.getAllTranscriptions();
      const currentJob = jobs.find((job: TranscriptionJob) => job.id === currentTranscriptionId);
      
      if (currentJob) {
        console.log('Current job status:', currentJob.status, 'Progress:', currentJob.progress);
        
        // Update progress
        setProgressData(prev => ({
          ...prev,
          progress: currentJob.progress || 0,
          status: getStatusMessage(currentJob.status, currentJob.progress || 0)
        }));
        
        // Check if completed
        if (currentJob.status === 'completed') {
          console.log('✅ Transcription completed via polling, transitioning...');
          
          // Clear polling
          setCurrentTranscriptionId(null);
          
          // Set selected job
          setSelectedJob(currentJob);
          
          // Initialize edited segments with the transcription result
          const segments = currentJob.result?.segments || [];
          console.log('Initializing editedSegments with', segments.length, 'segments');
          setEditedSegments([...segments]); // Create a copy to avoid mutating original data
          
          // Determine next screen
          const speakers = new Set(segments.map((s: any) => s.speaker).filter(Boolean));
          
          if (speakers.size > 1 && !currentJob.speakerNames) {
            console.log('Multiple speakers detected, going to speaker identification');
            setCurrentView('speaker-identification');
          } else {
            console.log('Single speaker or names already set, going to playback');
            setCurrentView('playback');
          }
          
          return; // Stop polling
        }
        
        // Check if error
        if (currentJob.status === 'error') {
          console.error('❌ Transcription failed:', currentJob.error);
          alert(`Transcription failed: ${currentJob.error}`);
          setCurrentView('home');
          setCurrentTranscriptionId(null);
          return; // Stop polling
        }
      } else {
        console.warn('Job not found with ID:', currentTranscriptionId);
      }
    } catch (error) {
      console.error('Error polling transcription status:', error);
    }
  }, [currentTranscriptionId, currentView]);

  // Set up polling interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (currentTranscriptionId && currentView === 'transcription-progress') {
      console.log('🔄 Starting transcription polling for ID:', currentTranscriptionId);
      
      // Poll every 2 seconds
      interval = setInterval(pollTranscriptionStatus, 2000);
      
      // Also poll immediately
      pollTranscriptionStatus();
    }
    
    return () => {
      if (interval) {
        console.log('🛑 Stopping transcription polling');
        clearInterval(interval);
      }
    };
  }, [currentTranscriptionId, currentView, pollTranscriptionStatus]);

  const loadTranscriptionJobs = async () => {
    try {
      if ((window as any).electronAPI?.getAllTranscriptions) {
        const jobs = await (window as any).electronAPI.getAllTranscriptions();
        setTranscriptionJobs(jobs);
      }
    } catch (error) {
      console.error('Failed to load transcription jobs:', error);
    }
  };

  const loadApiKeys = async () => {
    try {
      if ((window as any).electronAPI?.getApiKeys) {
        const apiKeys = await (window as any).electronAPI.getApiKeys();
        setCurrentApiKeys(apiKeys || {});
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
      setCurrentApiKeys({});
    }
  };

  // Enhanced import workflow with model selection support
  const handleImport = async (filePath: string, modelSize: string) => {
    if (!(window as any).electronAPI) {
      alert('This feature is only available in the Electron app, not in the browser.');
      return;
    }

    try {
      console.log('🎵 Starting audio import...');
      console.log('File selected:', filePath);
      console.log('Model selected:', modelSize);
      
      const fileName = filePath.split('/').pop() || 'Unknown file';
      
      // Close import dialog
      setShowImportDialog(false);
      
      // Start transcription with selected model
      const transcriptionResult = await (window as any).electronAPI.startTranscription(
        filePath, 
        modelSize
      );
      
      if (transcriptionResult.success) {
        console.log('✅ Transcription started successfully');
        
        // Set up progress tracking
        setProgressData({
          fileName,
          progress: 0,
          status: modelSize.startsWith('cloud-') ? 'Connecting to cloud service...' : 'Starting transcription...'
        });
        
        // Get the transcription ID from the jobs list
        const jobs = await (window as any).electronAPI.getAllTranscriptions();
        const latestJob = jobs[jobs.length - 1]; // Get most recent job
        
        if (latestJob) {
          console.log('🆔 Setting current transcription ID:', latestJob.id);
          setCurrentTranscriptionId(latestJob.id);
        }
        
        // Switch to progress view
        setCurrentView('transcription-progress');
        
      } else {
        throw new Error(transcriptionResult.error || 'Failed to start transcription');
      }
    } catch (error) {
      console.error('❌ Import failed:', error);
      alert(`Failed to import audio: ${(error as any).message}`);
    }
  };

  // API Settings handlers
  const handleOpenApiSettings = async () => {
    // Refresh API keys before opening dialog
    await loadApiKeys();
    setShowApiSettings(true);
  };

  const handleSaveApiKeys = async (apiKeys: { [service: string]: string }) => {
    try {
      if ((window as any).electronAPI?.saveApiKeys) {
        const result = await (window as any).electronAPI.saveApiKeys(apiKeys);
        if (result.success) {
          console.log('✅ API keys saved successfully');
          setCurrentApiKeys(apiKeys);
          setShowApiSettings(false);
        } else {
          throw new Error(result.error || 'Failed to save API keys');
        }
      }
    } catch (error) {
      console.error('❌ Failed to save API keys:', error);
      alert(`Failed to save API keys: ${(error as any).message}`);
    }
  };

  const handleCancelApiSettings = () => {
    setShowApiSettings(false);
  };

  const handleOpenPlaybackMode = (job: TranscriptionJob) => {
    setSelectedJob(job);
    
    // Initialize edited segments with the original segments
    const segments = job.result?.segments || [];
    setEditedSegments([...segments]); // Create a copy to avoid mutating original data
    
    // Check if we need speaker identification
    const speakers = new Set(segments.map((s: any) => s.speaker).filter(Boolean));
    
    if (speakers.size > 1 && !job.speakerNames) {
      setCurrentView('speaker-identification');
    } else {
      setCurrentView('playback');
      setPlaybackMode('playback'); // Default to clean playback mode
    }
  };

  // Add mode switching handlers with audio state preservation
  const handleSwitchToTranscriptEdit = () => {
    console.log('Switching to Transcript Edit mode - preserving audio state:', sharedAudioState);
    setPlaybackMode('transcript-edit');
  };

  const handleSwitchToPlayback = () => {
    console.log('Switching to Playback mode - preserving audio state:', sharedAudioState);
    setPlaybackMode('playback');
  };

  // Handle edited segments updates
  const handleEditedSegmentsUpdate = useCallback((updatedSegments: any[]) => {
    setEditedSegments([...updatedSegments]); // Create a copy to trigger re-render
  }, []);
  
  // Shared audio control handlers
  const handleSharedAudioUpdate = (updates: Partial<typeof sharedAudioState>) => {
    setSharedAudioState(prev => ({ ...prev, ...updates }));
  };

  // Handle speaker updates from either mode
  const handleSpeakersUpdate = (newSpeakers: {[key: string]: string}) => {
    console.log('Updating speakers:', newSpeakers);
    setGlobalSpeakers(newSpeakers);
    
    // Update the selected job with new speaker names
    if (selectedJob) {
      const updatedJob = { 
        ...selectedJob, 
        speakerNames: newSpeakers
      };
      setSelectedJob(updatedJob);
      
      // Update transcription jobs list
      setTranscriptionJobs(prev => 
        prev.map(job => job.id === selectedJob.id ? updatedJob : job)
      );
    }
  };

  const handleSpeakerIdentificationComplete = (result: { speakerNames: { [key: string]: string }, speakerMerges?: { [key: string]: string } }) => {
    if (selectedJob) {
      const updatedJob = { 
        ...selectedJob, 
        speakerNames: result.speakerNames,
        speakerMerges: result.speakerMerges 
      };
      setSelectedJob(updatedJob);
      
      // Initialize edited segments if not already done
      const segments = updatedJob.result?.segments || [];
      if (editedSegments.length === 0 && segments.length > 0) {
        console.log('Initializing editedSegments from speaker identification with', segments.length, 'segments');
        setEditedSegments([...segments]);
      }
      
      setTranscriptionJobs(prev => 
        prev.map(job => job.id === selectedJob.id ? updatedJob : job)
      );
      
      setCurrentView('playback');
    }
  };

  const handleSpeakerIdentificationSkip = () => {
    // Initialize edited segments if not already done
    if (selectedJob && editedSegments.length === 0) {
      const segments = selectedJob.result?.segments || [];
      console.log('Initializing editedSegments from speaker identification skip with', segments.length, 'segments');
      setEditedSegments([...segments]);
    }
    
    setCurrentView('playback');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedJob(null);
  };

  const handleOpenProject = async () => {
    console.log('Open project requested');
    setShowProjectImportDialog(true);
  };

  // Project file management functions
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

  const handleOpenRecent = () => {
    const completedJobs = transcriptionJobs.filter((job: TranscriptionJob) => job.status === 'completed');
    if (completedJobs.length > 0) {
      const mostRecent = completedJobs.sort((a: TranscriptionJob, b: TranscriptionJob) => b.id.localeCompare(a.id))[0];
      console.log('Opening most recent project:', mostRecent.fileName);
      handleOpenPlaybackMode(mostRecent);
    } else {
      alert('No recent projects found. Import an audio file to get started.');
    }
  };

  // Handle transcription cancellation
  const handleTranscriptionCancel = () => {
    console.log('🛑 Transcription cancelled by user');
    setCurrentView('home');
    setCurrentTranscriptionId(null);
    setProgressData({
      fileName: '',
      progress: 0,
      status: 'Starting...'
    });
  };

  // Simple progress page component (inline for now)
  const renderProgressPage = () => {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '500px', padding: '2rem' }}>
          <h1 style={{ fontSize: '2rem', color: '#333', marginBottom: '0.5rem' }}>
            Transcribing Audio
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '2rem', fontFamily: 'Monaco, monospace' }}>
            {progressData.fileName}
          </p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid #e0e0e0',
              borderTop: '4px solid #4a9eff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }}></div>
          </div>
          
          <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#333', marginBottom: '0.5rem' }}>
            {progressData.progress}%
          </div>
          <div style={{ fontSize: '1rem', color: '#666', marginBottom: '2rem' }}>
            {progressData.status}
          </div>
          
          <div style={{ color: '#999', marginBottom: '2rem' }}>
            <p>Using WhisperX AI for accurate transcription...</p>
            <p>This may take several minutes depending on file length.</p>
            <p><strong>Polling every 2 seconds for updates...</strong></p>
          </div>
          
          <button 
            onClick={handleTranscriptionCancel}
            style={{
              background: 'transparent',
              border: '1px solid #e0e0e0',
              color: '#666',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Cancel Transcription
          </button>
        </div>
        
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  };

  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '20px'
        }}>🎙️</div>
        <h1 style={{
          margin: '0 0 10px 0',
          fontSize: '24px',
          fontWeight: '600',
          color: '#333'
        }}>PodcastTranscriber</h1>
        <p style={{
          margin: '0 0 30px 0',
          fontSize: '16px',
          color: '#666'
        }}>Initializing...</p>
        <div style={{
          width: '200px',
          height: '4px',
          backgroundColor: '#e0e0e0',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #007AFF 0%, #5856D6 50%, #007AFF 100%)',
            animation: 'loading 2s infinite linear',
            transform: 'translateX(-100%)'
          }}></div>
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
        {initError && (
          <div style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '4px',
            color: '#d32f2f',
            fontSize: '14px',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            Initialization Error: {initError}
          </div>
        )}
      </div>
    );
  }

  if (currentView === 'transcription-progress') {
    return renderProgressPage();
  }

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
    const playbackContent = playbackMode === 'playback' ? (
      <PlaybackModeContainer
        transcriptionJob={selectedJob}
        editedSegments={editedSegments}
        speakers={globalSpeakers}
        onSpeakersUpdate={handleSpeakersUpdate}
        onBack={handleBackToHome}
        onSwitchToTranscriptEdit={handleSwitchToTranscriptEdit}
        sharedAudioState={sharedAudioState}
        onAudioStateUpdate={handleSharedAudioUpdate}
      />
    ) : (
      <TranscriptEditContainer
        transcriptionJob={selectedJob}
        editedSegments={editedSegments}
        onEditedSegmentsUpdate={handleEditedSegmentsUpdate}
        speakers={globalSpeakers}
        onSpeakersUpdate={handleSpeakersUpdate}
        onBack={handleBackToHome}
        onSwitchToPlayback={handleSwitchToPlayback}
        sharedAudioState={sharedAudioState}
        onAudioStateUpdate={handleSharedAudioUpdate}
      />
    );

    return (
      <>
        {/* Header with save button for playback/transcript-edit modes */}
        {selectedJob && (
          <div className="app-header-bar">
            <div className="header-left">
              <button 
                className="import-button" 
                onClick={() => setShowProjectImportDialog(true)}
                title="Import Project (⌘O)"
              >
                📁 Import Project
              </button>
            </div>
            
            <div className="header-center">
              <h1 className="project-title">
                {projectData?.project?.name || selectedJob.fileName}
              </h1>
            </div>
            
            <div className="header-right">
              <SaveButton
                onSave={handleSave}
                hasUnsavedChanges={hasUnsavedChanges}
                projectName={projectData?.project?.name || selectedJob.fileName}
              />
            </div>
          </div>
        )}
        
        {playbackContent}
        
        {/* Bottom Fixed Audio Player - show when we have an active transcription job in playback or transcript-edit mode */}
        
        {/* Render audio player for both playback and transcript-edit modes */}
        {selectedJob && currentAudioPath && (
          <BottomAudioPlayer
            audioSrc={currentAudioPath}
            fileName={selectedJob.fileName || 'Test Audio'}
            sharedAudioState={sharedAudioState}
            onAudioStateUpdate={handleSharedAudioUpdate}
          />
        )}
      </>
    );
  }

  return (
    <>
      {showImportDialog && (
        <ImportDialog
          onClose={() => setShowImportDialog(false)}
          onImport={handleImport}
          onOpenApiSettings={handleOpenApiSettings}
        />
      )}
      {showApiSettings && (
        <ApiSettings
          onSave={handleSaveApiKeys}
          onCancel={handleCancelApiSettings}
          currentKeys={currentApiKeys}
        />
      )}
      {showProjectImportDialog && (
        <ProjectImportDialog
          isOpen={showProjectImportDialog}
          onClose={() => setShowProjectImportDialog(false)}
          onProjectLoaded={handleProjectLoaded}
        />
      )}
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
              <div className="action-card primary" onClick={() => setShowImportDialog(true)}>
                <div className="action-icon">🎵</div>
                <div className="action-title">Import Audio</div>
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
      
      {/* Bottom Fixed Audio Player - show when we have an active transcription job in playback or transcript-edit mode */}
      {/* Debug logging */}
      {console.log('App - Render check:', {
        selectedJob: !!selectedJob,
        currentView,
        playbackMode,
        currentAudioPath,
        fileName: selectedJob?.fileName,
        shouldRender: selectedJob && (currentView === 'playback') && currentAudioPath
      })}
      
      {/* Always show debug info */}
      <div style={{position: 'fixed', bottom: 0, left: 0, background: selectedJob && (currentView === 'playback') && currentAudioPath ? 'green' : 'red', color: 'white', padding: '5px', zIndex: 9999, fontSize: '12px'}}>
        selectedJob: {selectedJob ? 'YES' : 'NO'} | view: {currentView} | playbackMode: {playbackMode} | path: {currentAudioPath ? 'YES' : 'NONE'} | Should render: {(selectedJob && (currentView === 'playback') && currentAudioPath) ? 'YES' : 'NO'}
      </div>
      
      {/* Render audio player for both playback and transcript-edit modes */}
      {selectedJob && (currentView === 'playback') && currentAudioPath && (
        <BottomAudioPlayer
          audioSrc={currentAudioPath}
          fileName={selectedJob.fileName || 'Test Audio'}
          sharedAudioState={sharedAudioState}
          onAudioStateUpdate={handleSharedAudioUpdate}
        />
      )}
    </>
  );
};

export default App;