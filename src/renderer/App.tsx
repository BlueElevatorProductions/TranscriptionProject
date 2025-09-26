/**
 * Main App Component v2.0
 *
 * Simplified app using v2.0 architecture:
 * - ProjectContextV2 as thin cache that dispatches to main process
 * - Clean error boundaries
 * - Segment-based data model
 */

import React, { useState, useEffect } from 'react';
import './App.css';
import './styles/glass-dialogs.css';

// v2.0 Context
import { ProjectProvider as ProjectProviderV2, useProjectV2 } from './contexts/ProjectContextV2';

// UI Components
import NewUIShellV2 from './components/ui/NewUIShellV2';
import ToastContainer from './components/Notifications/ToastContainer';
import { useNotifications } from './contexts';

// v2.0 Dialogs
import NewProjectDialogV2 from './dialogs/NewProjectDialogV2';
import ImportDialogV2 from './dialogs/ImportDialogV2';

// Other providers that are still compatible
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './components/theme-provider';

// Error boundary for v2.0
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('🔥 App v2.0 Error Boundary Caught:', error);
    console.error('🔥 Error Info:', errorInfo);
    console.error('🔥 Component Stack:', errorInfo.componentStack);
    console.error('🔥 Error Stack:', error.stack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-red-50">
          <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Application Error</h2>
            <p className="text-gray-700 mb-4">
              TranscriptionProject v2.0 encountered an error.
            </p>
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

// Main app content
const AppContent: React.FC = () => {
  const { state: notificationState, dismissToast } = useNotifications() as any;
  const { actions: projectActions } = useProjectV2();

  // Dialog state
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Ensure transport log forwarding is visible in the renderer console
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onTransportLog) {
      console.warn('[TransportLog][Renderer] electronAPI.onTransportLog unavailable — forwarded backend logs will be missing');
      return;
    }

    const seenSources = new Set<string>();
    console.log('[TransportLog][Renderer] Attaching transport log monitor');

    const detach = api.onTransportLog((entry: any) => {
      if (!entry || typeof entry.message !== 'string') {
        return;
      }

      const bracketMatch = entry.message.match(/^\[([^\]]+)\]/);
      const source = entry.source || (bracketMatch ? bracketMatch[1] : undefined);

      if (source && !seenSources.has(source)) {
        seenSources.add(source);
        console.log('[TransportLog][Renderer] First forwarded log received', {
          source,
          message: entry.message,
        });
      }
    });

    return () => {
      if (typeof detach === 'function') {
        detach();
      }
    };
  }, []);

  // Initialize app and set up menu listeners
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const appVersion = await (window as any).electronAPI?.getVersion();
        console.log('🚀 TranscriptionProject v2.0 initialized:', appVersion);
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };
    initializeApp();

    // Menu event listeners
    const handleNewProject = () => {
      console.log('📄 New project requested');
      setShowNewProjectDialog(true);
    };

    const handleImportAudio = () => {
      console.log('🎵 Import audio requested');
      setShowImportDialog(true);
    };

    // Set up event listeners
    window.addEventListener('open-new-project', handleNewProject);
    window.addEventListener('open-import-audio', handleImportAudio);

    // Menu listeners from Electron
    (window as any).electronAPI?.onMenuNewProject?.(handleNewProject);
    (window as any).electronAPI?.onMenuImportAudio?.(handleImportAudio);

    return () => {
      window.removeEventListener('open-new-project', handleNewProject);
      window.removeEventListener('open-import-audio', handleImportAudio);
    };
  }, []);

  // Handle project creation
  const handleProjectCreated = (projectName: string, projectPath: string) => {
    console.log('✅ Project created:', { projectName, projectPath });

    // Set the current project path in the context so it's available throughout the app
    projectActions.setCurrentProjectPath(projectPath);

    setShowNewProjectDialog(false);
    // After project creation, show import dialog
    setShowImportDialog(true);
  };

  // Handle audio import
  const handleAudioImported = async (filePath: string, settings: any) => {
    console.log('🎬 App.tsx.handleAudioImported called with:', { filePath, settings });
    setShowImportDialog(false);

    try {
      const transcriptionOptions = {
        method: settings.transcriptionMethod,
        language: 'en',
        model: 'whisper-1',
        quality: settings.quality
      };

      console.log('🔧 App.tsx: About to call projectActions.startTranscription with:', transcriptionOptions);

      const success = await projectActions.startTranscription(filePath, transcriptionOptions);

      console.log('📊 App.tsx: projectActions.startTranscription returned:', success);

      if (success) {
        console.log('✅ App.tsx: Transcription started successfully');
      } else {
        console.error('❌ App.tsx: Failed to start transcription (returned false)');
      }
    } catch (error) {
      console.error('❌ App.tsx: Exception during transcription start:', error);
    }
  };

  return (
    <AppErrorBoundary>
      <div className="app-container">
        {/* Main UI Shell v2.0 */}
        <NewUIShellV2 />

        {/* v2.0 Dialogs */}
        {showNewProjectDialog && (
          <NewProjectDialogV2
            onClose={() => setShowNewProjectDialog(false)}
            onCreateProject={handleProjectCreated}
          />
        )}

        {showImportDialog && (
          <ImportDialogV2
            onClose={() => setShowImportDialog(false)}
            onImport={handleAudioImported}
          />
        )}

        {/* Global Toasts */}
        <ToastContainer
          toasts={(notificationState?.toasts) || []}
          position="top-right"
          maxToasts={5}
          onDismiss={(id: string) => dismissToast?.(id)}
        />
      </div>
    </AppErrorBoundary>
  );
};

// v2.0 Providers
const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider defaultTheme="system" storageKey="transcript-ui-theme">
      <NotificationProvider>
        <ProjectProviderV2>
          {children}
        </ProjectProviderV2>
      </NotificationProvider>
    </ThemeProvider>
  );
};

// Main App component
const App: React.FC = () => {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
};

export default App;