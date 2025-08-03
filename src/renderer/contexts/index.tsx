/**
 * Central context provider combining all application contexts
 * Provides a single provider component for the entire app
 */

import React, { ReactNode } from 'react';
import { AudioProvider, useAudio } from './AudioContext';
import { ProjectProvider, useProject } from './ProjectContext';
import { TranscriptionProvider, useTranscription } from './TranscriptionContext';
import { NotificationProvider } from './NotificationContext';

// Re-export all hooks for easy importing
export { useAudio, useLegacyAudioState, useAudioDebug } from './AudioContext';
export { useProject, useSpeakers, useSegments, useProjectMetadata, useLegacyProjectState } from './ProjectContext';
export { useTranscription, useTranscriptionJobs, useSelectedJob, useTranscriptionProgress, useLegacyTranscriptionState } from './TranscriptionContext';
export { useNotifications, useSuccessToast, useErrorToast, useWarningToast, useInfoToast, useApiErrorToast } from './NotificationContext';

// Re-export types
export type { UseAudioReturn, UseProjectReturn, UseTranscriptionReturn } from '../types';

// ==================== Combined Provider ====================

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Combined provider component that wraps all context providers
 * Use this as the root provider in your App component
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <NotificationProvider>
      <AudioProvider>
        <ProjectProvider>
          <TranscriptionProvider>
            {children}
          </TranscriptionProvider>
        </ProjectProvider>
      </AudioProvider>
    </NotificationProvider>
  );
};

// ==================== Debug Component ====================

/**
 * Debug component that displays current state from all contexts
 * Useful for development and debugging
 */
export const ContextDebugPanel: React.FC = () => {
  const audioState = useAudio();
  const projectState = useProject();
  const transcriptionState = useTranscription();

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      width: 300,
      maxHeight: 400,
      overflow: 'auto',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: 10,
      fontSize: 12,
      fontFamily: 'monospace',
      borderRadius: 5,
      zIndex: 9999,
    }}>
      <h4>Context Debug Panel</h4>
      
      <details>
        <summary>Audio State</summary>
        <pre>{JSON.stringify(audioState.state, null, 2)}</pre>
      </details>
      
      <details>
        <summary>Project State</summary>
        <pre>{JSON.stringify({
          hasProject: !!projectState.state.projectData,
          hasUnsavedChanges: projectState.state.hasUnsavedChanges,
          speakersCount: Object.keys(projectState.state.globalSpeakers).length,
          segmentsCount: projectState.state.editedSegments.length,
          isLoading: projectState.state.isLoading,
          error: projectState.state.error,
        }, null, 2)}</pre>
      </details>
      
      <details>
        <summary>Transcription State</summary>
        <pre>{JSON.stringify({
          jobsCount: transcriptionState.state.jobs.length,
          hasSelectedJob: !!transcriptionState.state.selectedJob,
          isProcessing: transcriptionState.state.isProcessing,
          progressData: transcriptionState.state.progressData,
        }, null, 2)}</pre>
      </details>
    </div>
  );
};