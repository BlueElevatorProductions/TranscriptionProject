/**
 * Main App Component
 * Root component that provides context and renders the new UI
 */

import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// New UI components
import NewUIShell from './components/ui/NewUIShell';

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
import ImportDialog from './components/ImportDialog/ImportDialog';
import ProjectImportDialog from './components/ImportDialog/ProjectImportDialog';
import NewProjectDialog from './components/NewProject/NewProjectDialog';

// Types
import { TranscriptionJob, ProjectData } from './types';

// ==================== Main App Component ====================

const AppMain: React.FC = () => {
  // Dialog state
  const [showImportDialog, setShowImportDialog] = useState<boolean>(false);
  const [showProjectImportDialog, setShowProjectImportDialog] = useState<boolean>(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState<boolean>(false);

  // Context hooks
  const { actions: transcriptionActions } = useTranscription();
  const { actions: projectActions } = useProject();
  
  // Error handling
  const { handleTranscriptionError } = useTranscriptionErrorHandler();

  // Project creation handler
  const handleCreateProject = useCallback(async (projectName: string, projectPath: string) => {
    try {
      // Clear any existing transcription state to prevent data contamination
      transcriptionActions.selectJob(null);
      
      // Create a new project structure
      const newProject: ProjectData = {
        project: {
          name: projectName,
          description: '',
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
            language: 'en',
            editCount: 0,
          },
        },
        speakers: {
          speakerMappings: {},
        },
        clips: [],
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
    const handleTranscriptionComplete = (completedJob: any) => {
      try {
        if (completedJob?.id && completedJob?.result) {
          transcriptionActions.completeJob(completedJob.id, completedJob.result);
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
        }
      } catch (error) {
        console.error('Error in handleTranscriptionComplete:', error);
      }
    };

    const handleTranscriptionProgress = (progressData: any) => {
      if (progressData?.id && progressData?.progress !== undefined) {
        transcriptionActions.updateProgress(progressData.id, progressData.progress, progressData.status);
      }
    };

    const handleTranscriptionErrorEvent = (errorData: any) => {
      handleTranscriptionError(errorData?.error || errorData, 'transcription');
    };

    // Set up IPC listeners
    (window as any).electronAPI?.onTranscriptionComplete?.(handleTranscriptionComplete);
    (window as any).electronAPI?.onTranscriptionProgress?.(handleTranscriptionProgress);
    (window as any).electronAPI?.onTranscriptionError?.(handleTranscriptionErrorEvent);

    return () => {
      (window as any).electronAPI?.removeAllListeners?.('transcription-complete');
      (window as any).electronAPI?.removeAllListeners?.('transcription-progress');
      (window as any).electronAPI?.removeAllListeners?.('transcription-error');
    };
  }, [transcriptionActions, handleTranscriptionError]);

  return (
    <TranscriptionErrorBoundary>
      <NewUIShell />
      
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
        <ImportDialog
          onClose={() => setShowImportDialog(false)}
          onImport={async (files, transcriptionService) => {
            try {
              console.log('Starting import:', { files, transcriptionService });
              setShowImportDialog(false);
              // TODO: Implement actual import logic
            } catch (error) {
              console.error('Import failed:', error);
              handleTranscriptionError(error);
            }
          }}
          onOpenApiSettings={() => {
            console.log('Opening API settings');
            // TODO: Implement API settings dialog
          }}
        />
      )}
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