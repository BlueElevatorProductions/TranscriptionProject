/**
 * Main App Component
 * Root component that provides context and renders the new UI
 */

import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// New UI components
import NewUIShell from './components/ui/NewUIShell';
import ToastContainer from './components/Notifications/ToastContainer';
import { useNotifications } from './contexts';

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
    console.error('Transcription crashed:', error, errorInfo);
    
    // Try to reset app state
    if ((window as any).electronAPI?.resetTranscriptionState) {
      (window as any).electronAPI.resetTranscriptionState();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-red-50">
          <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Transcription Error</h2>
            <p className="text-gray-700 mb-4">The transcription process encountered an error.</p>
            <details className="mb-4">
              <summary className="cursor-pointer text-sm text-gray-500">Error details</summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                {this.state.error?.toString()}
              </pre>
            </details>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Restart Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ==================== Import all necessary components ====================

// Contexts
import { 
  AppProviders,
  useProject,
  useTranscription,
  useTranscriptionErrorHandler
} from './contexts';

// Components
import EnhancedImportDialog from './components/ImportDialog/EnhancedImportDialog';
import ProjectImportDialog from './components/ImportDialog/ProjectImportDialog';
import NewProjectDialog from './components/NewProject/NewProjectDialog';
import { GlassProgressOverlay } from './components/ui/GlassProgressOverlay';

// Types
import { TranscriptionJob, ProjectData } from './types';

// ==================== Main App Component ====================

const AppMain: React.FC = () => {
  // Notifications
  const { state: notificationState, dismissToast } = useNotifications() as any;
  // Dialog state
  const [showImportDialog, setShowImportDialog] = useState<boolean>(false);
  const [showProjectImportDialog, setShowProjectImportDialog] = useState<boolean>(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState<boolean>(false);

  // Context hooks
  const { state: transcriptionState, actions: transcriptionActions } = useTranscription();
  const { state: projectState, actions: projectActions } = useProject();
  
  // Error handling
  const { handleTranscriptionError } = useTranscriptionErrorHandler();

  // Project creation handler
  const handleCreateProject = useCallback(async (projectName: string, projectPath: string) => {
    try {
      // Clear any existing transcription state to prevent data contamination
      transcriptionActions.selectJob(null);
      
      // Create a new project structure
      const newProject: any = {
        project: {
          name: projectName,
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: '1.0.0',
          type: 'transcription',
        },
        transcription: {
          segments: [],
          globalMetadata: {
            totalSegments: 0,
            totalWords: 0,
            averageConfidence: 0,
            processingTime: 0,
            editCount: 0,
          },
        },
        speakers: {
          version: '1.0.0',
          speakers: {},
          defaultSpeaker: 'SPEAKER_00'
        },
        clips: {
          version: '1.0.0',
          clips: [],
          clipSettings: {
            autoClipOnSpeakerChange: true,
            maxClipDuration: 300
          }
        },
      };
      
      // Load the project into the app with the path
      projectActions.loadProject(newProject);
      projectActions.setProjectPath(projectPath);
      
      // Close dialog and show import dialog
      setShowNewProjectDialog(false);
      setShowImportDialog(true);

      console.log('New project created:', projectName, 'at', projectPath);
    } catch (error) {
      console.error('Failed to create project:', error);
      handleTranscriptionError(error);
    }
  }, [projectActions, transcriptionActions, handleTranscriptionError]);

  // Initialize app and set up event listeners
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const appVersion = await (window as any).electronAPI?.getVersion();
        const appPlatform = await (window as any).electronAPI?.getPlatform();
        console.log('App initialized:', { version: appVersion, platform: appPlatform });
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };
    initializeApp();
  }, []);

  // Event listeners for project actions
  useEffect(() => {
    const handleNewProject = () => {
      setShowNewProjectDialog(true);
    };
    
    const handleOpenProject = () => {
      setShowProjectImportDialog(true);
    };
    
    window.addEventListener('open-new-project', handleNewProject);
    window.addEventListener('open-project-import', handleOpenProject);
    
    return () => {
      window.removeEventListener('open-new-project', handleNewProject);
      window.removeEventListener('open-project-import', handleOpenProject);
    };
  }, []);

  // IPC event handlers for transcription
  useEffect(() => {
    const handleTranscriptionComplete = async (completedJob: any) => {
      console.log('=== RENDERER: TRANSCRIPTION COMPLETE EVENT RECEIVED ===');
      console.log('Renderer: Received transcription-complete event with data:', {
        hasJob: !!completedJob,
        jobId: completedJob?.id,
        hasResult: !!completedJob?.result,
        resultType: typeof completedJob?.result,
        segmentCount: completedJob?.result?.segments?.length || 0,
        jobKeys: completedJob ? Object.keys(completedJob) : []
      });
      
      try {
        if (completedJob?.id && completedJob?.result) {
          console.log('Renderer: Processing completed job:', completedJob.id);
          console.log('Renderer: Job result structure:', {
            segments: completedJob.result.segments?.length || 0,
            language: completedJob.result.language,
            hasWordSegments: !!completedJob.result.word_segments
          });
          
          transcriptionActions.completeJob(completedJob.id, completedJob.result);
          console.log('Renderer: Called completeJob action');
          
          const jobData: TranscriptionJob = {
            id: completedJob.id,
            filePath: completedJob.filePath,
            fileName: completedJob.fileName,
            status: 'completed',
            progress: 100,
            result: completedJob.result,
            speakerNames: completedJob.result?.speakers || {}
          };
          
          transcriptionActions.selectJob(jobData);
          console.log('Renderer: Called selectJob action');
          
          // Auto-save the project after transcription completes
          try {
            await projectActions.saveProject();
            console.log('Renderer: Project auto-saved after transcription completion');
          } catch (saveError) {
            console.error('Renderer: Failed to auto-save project after transcription:', saveError);
            // Don't throw - transcription completed successfully, save is just a bonus
          }
          
          console.log('=== RENDERER: TRANSCRIPTION COMPLETION HANDLING DONE ===');
        } else {
          console.error('Renderer: Invalid completion data - missing ID or result:', {
            hasId: !!completedJob?.id,
            hasResult: !!completedJob?.result
          });
        }
      } catch (error) {
        console.error('Error in handleTranscriptionComplete:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      }
    };

    const handleTranscriptionProgress = (progressData: any) => {
      console.log('Renderer: Received transcription progress:', {
        id: progressData?.id,
        progress: progressData?.progress,
        status: progressData?.status
      });
      if (progressData?.id && progressData?.progress !== undefined) {
        transcriptionActions.updateJobProgress(progressData.id, progressData.progress, progressData.status);
      }
    };

    const handleTranscriptionErrorEvent = (errorData: any) => {
      console.log('Renderer: Received transcription error:', errorData);
      
      // Update the transcription job status to error
      if (errorData?.id) {
        transcriptionActions.errorJob(errorData.id, errorData.error || 'Transcription failed');
        console.log('Renderer: Called errorJob action for job ID:', errorData.id);
      }
      
      // Show error notification to user
      handleTranscriptionError(errorData?.error || errorData, 'transcription');
    };

    const handleDebugLog = (message: string) => {
      console.log('🔍 DEBUG (from main):', message);
    };

    // Set up IPC listeners
    (window as any).electronAPI?.onTranscriptionComplete?.(handleTranscriptionComplete);
    (window as any).electronAPI?.onTranscriptionProgress?.(handleTranscriptionProgress);
    (window as any).electronAPI?.onTranscriptionError?.(handleTranscriptionErrorEvent);
    (window as any).electronAPI?.onDebugLog?.(handleDebugLog);

    return () => {
      (window as any).electronAPI?.removeAllListeners?.('transcription-complete');
      (window as any).electronAPI?.removeAllListeners?.('transcription-progress');
      (window as any).electronAPI?.removeAllListeners?.('transcription-error');
      (window as any).electronAPI?.removeAllListeners?.('debug-log');
    };
  }, [transcriptionActions, handleTranscriptionError]);

  // Get current processing job for progress overlay
  const currentJob = transcriptionState.jobs.find(job => 
    job.status === 'processing' || job.status === 'pending'
  ) || transcriptionState.selectedJob;

  const getProviderFromJob = (job: TranscriptionJob | null) => {
    if (!job) return undefined;
    // Extract provider from model size if it's a cloud transcription
    if (job.result && typeof job.result === 'object' && 'modelSize' in job.result) {
      const modelSize = (job.result as any).modelSize;
      if (typeof modelSize === 'string' && modelSize.startsWith('cloud-')) {
        return modelSize.split('-')[1];
      }
    }
    return undefined;
  };

  return (
    <TranscriptionErrorBoundary>
      <NewUIShell />
      
      {/* Progress Overlay */}
      <GlassProgressOverlay
        isVisible={transcriptionState.isProcessing && !!currentJob}
        progress={currentJob?.progress || 0}
        status={currentJob?.status || 'pending'}
        message={
          currentJob?.status === 'processing' ? 'Transcribing your audio file...' :
          currentJob?.status === 'pending' ? 'Preparing transcription...' :
          currentJob?.status === 'completed' ? 'Transcription complete!' :
          currentJob?.status === 'error' ? 'Transcription failed' :
          'Processing...'
        }
        fileName={currentJob?.fileName}
        provider={getProviderFromJob(currentJob)}
        onCancel={async () => {
          if (currentJob?.id) {
            console.log('Cancelling transcription:', currentJob.id);
            try {
              const result = await (window as any).electronAPI?.cancelTranscription?.(currentJob.id);
              console.log('Cancel result:', result);
              if (result?.success) {
                // The error event will be sent from main process to update the UI
                console.log('Transcription cancelled successfully');
              } else {
                console.error('Failed to cancel transcription:', result?.error);
                handleTranscriptionError(result?.error || 'Failed to cancel transcription');
              }
            } catch (error) {
              console.error('Error cancelling transcription:', error);
              handleTranscriptionError(error);
            }
          }
        }}
        onClose={() => {
          if (currentJob?.status === 'completed' || currentJob?.status === 'error') {
            transcriptionActions.selectJob(null);
          }
        }}
        error={currentJob?.error}
      />
      
      {/* Dialogs */}
      {showNewProjectDialog && (
        <NewProjectDialog
          isOpen={showNewProjectDialog}
          onClose={() => setShowNewProjectDialog(false)}
          onCreateProject={handleCreateProject}
        />
      )}

      {showProjectImportDialog && (
        <ProjectImportDialog
          isOpen={showProjectImportDialog}
          onClose={() => setShowProjectImportDialog(false)}
          onProjectLoaded={async (projectData: any, filePath?: string) => {
            try {
              console.log('Loading project:', { projectData, filePath });
              projectActions.loadProject(projectData);
              if (filePath) {
                projectActions.setProjectPath(filePath);
              }
              setShowProjectImportDialog(false);
            } catch (error) {
              console.error('Failed to load project:', error);
              handleTranscriptionError(error);
            }
          }}
        />
      )}

      {showImportDialog && (
        <EnhancedImportDialog
          onClose={() => setShowImportDialog(false)}
          onImport={async (filePath, audioSettings, transcriptionSettings) => {
            try {
              console.log('Starting enhanced import:', { filePath, audioSettings });
              setShowImportDialog(false);
              
              if (!filePath) {
                throw new Error('No file selected for import');
              }
              
              // Extract filename from path
              const fileName = filePath.split('/').pop() || 'unknown_file';
              console.log('Processing audio file:', fileName, 'with settings:', audioSettings);
              
              // First, convert/prepare the audio according to settings
              const conversionOptions = {
                action: audioSettings.storageFormat === 'flac' ? 'convert-to-flac' : 
                       audioSettings.storageFormat === 'always-convert' ? 'convert-to-flac' : 'keep-original',
                targetSampleRate: audioSettings.masterSampleRate,
                targetBitDepth: audioSettings.masterBitDepth
              };
              
              console.log('Converting audio with options:', conversionOptions);
              const conversionResult = await (window as any).electronAPI.convertAudio(filePath, conversionOptions);
              console.log('Audio conversion result:', conversionResult);
              
              // Update the project's audio information
              const currentProject = projectState.projectData;
              if (currentProject) {
                const audioMetadata = {
                  originalPath: filePath,
                  originalName: fileName,
                  originalFormat: filePath.split('.').pop()?.toLowerCase() || 'unknown',
                  originalSampleRate: audioSettings.masterSampleRate,
                  originalSize: conversionResult.originalSize,
                  embeddedFormat: conversionResult.outputPath.split('.').pop()?.toLowerCase() || 'flac',
                  embeddedSize: conversionResult.convertedSize,
                  duration: conversionResult.duration,
                  channels: 2, // Default, will be updated by analysis
                  compressionRatio: conversionResult.compressionRatio,
                  wasConverted: conversionResult.wasConverted,
                  conversionMethod: conversionOptions.action
                };
                
                // Create initial clip representing the entire audio file
                const initialClip = {
                  id: 'initial-clip',
                  startTime: 0,
                  endTime: conversionResult.duration,
                  startWordIndex: 0,
                  endWordIndex: 0,
                  words: [], // Empty until transcription
                  text: `Untranscribed audio (${Math.floor(conversionResult.duration / 60)}:${Math.floor(conversionResult.duration % 60).toString().padStart(2, '0')})`,
                  speaker: 'SPEAKER_00',
                  confidence: 1.0,
                  type: 'initial' as const,
                  duration: conversionResult.duration,
                  order: 0,
                  createdAt: Date.now(),
                  modifiedAt: Date.now(),
                };

                // Update project with audio information and initial clip
                const updatedProject = {
                  ...currentProject,
                  project: {
                    ...currentProject.project,
                    audio: {
                      embeddedPath: conversionResult.outputPath,
                      originalFile: filePath,
                      originalName: fileName,
                      format: audioMetadata.embeddedFormat,
                      duration: conversionResult.duration,
                      channels: 2,
                      embedded: true
                    }
                  },
                  audioMetadata,
                  clips: {
                    ...currentProject.clips,
                    clips: [initialClip]
                  }
                };
                
                projectActions.loadProject(updatedProject);
                console.log('Project updated with audio metadata');
              }
              
              // Get transcription service based on user selection
              const transcriptionService = await (window as any).electronAPI.getTranscriptionService(transcriptionSettings);
              console.log('Using transcription service:', transcriptionService, 'for method:', transcriptionSettings.method);
              
              // Now start transcription with converted audio
              const transcriptionResult = await (window as any).electronAPI.startTranscription(
                conversionResult.outputPath, 
                transcriptionService
              );
              
              if (transcriptionResult.success) {
                console.log('Transcription started successfully with job ID:', transcriptionResult.jobId);
                
                // Create and add the transcription job to the context
                const transcriptionJob: TranscriptionJob = {
                  id: transcriptionResult.jobId,
                  filePath: conversionResult.outputPath, // Use converted audio path
                  fileName: fileName,
                  status: 'pending',
                  progress: 0
                };
                
                transcriptionActions.addJob(transcriptionJob);
                transcriptionActions.selectJob(transcriptionJob);
                console.log('Job added to context:', transcriptionJob);
              } else {
                throw new Error(transcriptionResult.error || 'Failed to start transcription');
              }
              
            } catch (error) {
              console.error('Enhanced import failed:', error);
              handleTranscriptionError(error);
            }
          }}
          onOpenApiSettings={() => {
            console.log('Opening API settings');
            // TODO: Implement API settings dialog
          }}
          isDragDrop={false}
        />
      )}
      {/* Global Toasts */}
      <ToastContainer
        toasts={(notificationState?.toasts) || []}
        position="top-right"
        maxToasts={5}
        onDismiss={(id: string) => dismissToast?.(id)}
      />
    </TranscriptionErrorBoundary>
  );
};

// ==================== App with Providers ====================

const App: React.FC = () => {
  return (
    <AppProviders>
      <AppMain />
    </AppProviders>
  );
};

export default App;
