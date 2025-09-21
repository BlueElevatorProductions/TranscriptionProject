/**
 * TranscriptionContext - Centralized transcription job management
 * Handles transcription job lifecycle, progress tracking, and job selection
 */

import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { TranscriptionState, TranscriptionAction, TranscriptionJob, TranscriptionResult, ProgressData, UseTranscriptionReturn, SpeakerSegmentSummary } from '../types';
import { useNotifications } from './NotificationContext';
import { ErrorHandler } from '../services/errorHandling';

// ==================== Initial State ====================

const initialTranscriptionState: TranscriptionState = {
  jobs: [],
  selectedJob: null,
  currentTranscriptionId: null,
  progressData: {
    fileName: '',
    progress: 0,
    status: 'Starting...',
  },
  isProcessing: false,
  speakerDirectory: {},
  speakerSegments: [],
};

// ==================== Reducer ====================

function transcriptionReducer(state: TranscriptionState, action: TranscriptionAction): TranscriptionState {
  switch (action.type) {
    case 'ADD_JOB': {
      const newJob = {
        ...action.payload,
        normalizedAt: action.payload.normalizedAt ?? null,
      };
      console.log('TranscriptionContext - Adding job:', newJob.fileName);

      return {
        ...state,
        jobs: [...state.jobs, newJob],
        selectedJob: newJob, // Auto-select new job
        currentTranscriptionId: newJob.id,
        isProcessing: true,
      };
    }

    case 'UPDATE_JOB_PROGRESS': {
      const { id, progress, status } = action.payload;
      
      const updatedJobs = state.jobs.map(job => 
        job.id === id 
          ? { 
              ...job, 
              progress, 
              status: status ? (status === 'completed' ? 'completed' : 'processing') : job.status 
            }
          : job
      );

      // Update progress data if this is the current job
      let updatedProgressData = state.progressData;
      if (state.currentTranscriptionId === id) {
        const currentJob = updatedJobs.find(job => job.id === id);
        if (currentJob) {
          updatedProgressData = {
            fileName: currentJob.fileName,
            progress: progress,
            status: status || state.progressData.status,
          };
        }
      }

      return {
        ...state,
        jobs: updatedJobs,
        progressData: updatedProgressData,
      };
    }

    case 'COMPLETE_JOB': {
      const { id, result } = action.payload;
      console.log('TranscriptionContext - Job completed:', id);

      let completedSpeakerMap: { [key: string]: string } | null = null;
      let completedSpeakerSegments: SpeakerSegmentSummary[] | undefined;

      const updatedJobs = state.jobs.map(job => {
        if (job.id !== id) {
          return job;
        }

        const incomingSpeakers = result?.speakers || {};
        const existingSpeakers = job.speakerNames || job.result?.speakers || {};
        const mergedSpeakers = { ...incomingSpeakers, ...existingSpeakers };
        const normalizedResult: TranscriptionResult = {
          ...job.result,
          ...result,
          speakers: mergedSpeakers,
          speakerSegments: result?.speakerSegments || job.result?.speakerSegments,
        };

        completedSpeakerMap = mergedSpeakers;
        completedSpeakerSegments = normalizedResult.speakerSegments;

        return {
          ...job,
          status: 'completed' as const,
          progress: 100,
          result: normalizedResult,
          speakerNames: mergedSpeakers,
          speakerSegments: normalizedResult.speakerSegments,
        };
      });

      const completedJob = updatedJobs.find(job => job.id === id);

      // IMPORTANT: Only update selectedJob if it's the currently selected job
      // or if no job is currently selected
      const shouldUpdateSelectedJob = !state.selectedJob || state.selectedJob.id === id;

      const updatedSpeakerDirectory = { ...state.speakerDirectory };
      if (completedSpeakerMap) {
        Object.entries(completedSpeakerMap).forEach(([speakerId, speakerName]) => {
          if (speakerName && speakerName.trim().length > 0) {
            updatedSpeakerDirectory[speakerId] = speakerName;
          } else if (!(speakerId in updatedSpeakerDirectory)) {
            updatedSpeakerDirectory[speakerId] = speakerName;
          }
        });
      }

      const nextSpeakerSegments = completedSpeakerSegments ?? state.speakerSegments;

      return {
        ...state,
        jobs: updatedJobs,
        selectedJob: shouldUpdateSelectedJob ? completedJob : state.selectedJob,
        isProcessing: state.currentTranscriptionId === id ? false : state.isProcessing,
        speakerDirectory: updatedSpeakerDirectory,
        speakerSegments: nextSpeakerSegments,
      };
    }

    case 'ERROR_JOB': {
      const { id, error } = action.payload;
      console.error('TranscriptionContext - Job error:', id, error);
      
      const updatedJobs = state.jobs.map(job =>
        job.id === id
          ? {
              ...job,
              status: 'error' as const,
              error,
            }
          : job
      );

      return {
        ...state,
        jobs: updatedJobs,
        isProcessing: state.currentTranscriptionId === id ? false : state.isProcessing,
        currentTranscriptionId: state.currentTranscriptionId === id ? null : state.currentTranscriptionId,
      };
    }

    case 'SELECT_JOB': {
      const selectedJob = action.payload;
      console.log('TranscriptionContext - Selecting job:', selectedJob?.fileName || 'none');
      
      return {
        ...state,
        selectedJob,
      };
    }

    case 'REMOVE_JOB': {
      const jobId = action.payload;
      console.log('TranscriptionContext - Removing job:', jobId);
      
      const updatedJobs = state.jobs.filter(job => job.id !== jobId);
      const wasSelected = state.selectedJob?.id === jobId;
      const wasCurrent = state.currentTranscriptionId === jobId;

      return {
        ...state,
        jobs: updatedJobs,
        selectedJob: wasSelected ? null : state.selectedJob,
        currentTranscriptionId: wasCurrent ? null : state.currentTranscriptionId,
        isProcessing: wasCurrent ? false : state.isProcessing,
      };
    }

    case 'SET_PROGRESS_DATA': {
      return {
        ...state,
        progressData: action.payload,
      };
    }

    case 'SET_PROCESSING': {
      return {
        ...state,
        isProcessing: action.payload,
      };
    }

    case 'MARK_JOB_NORMALIZED': {
      const { id, normalizedAt } = action.payload;
      const timestamp = normalizedAt ?? new Date().toISOString();
      console.log('TranscriptionContext - Marking job normalized:', id, timestamp);

      const updatedJobs = state.jobs.map(job =>
        job.id === id ? { ...job, normalizedAt: timestamp } : job
      );

      const updatedSelectedJob =
        state.selectedJob?.id === id
          ? { ...state.selectedJob, normalizedAt: timestamp }
          : state.selectedJob;

      return {
        ...state,
        jobs: updatedJobs,
        selectedJob: updatedSelectedJob,
      };
    }

    default:
      return state;
  }
}

// ==================== Context Creation ====================

interface TranscriptionContextType {
  state: TranscriptionState;
  dispatch: React.Dispatch<TranscriptionAction>;
}

const TranscriptionContext = createContext<TranscriptionContextType | undefined>(undefined);

// ==================== Provider Component ====================

interface TranscriptionProviderProps {
  children: ReactNode;
}

export const TranscriptionProvider: React.FC<TranscriptionProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(transcriptionReducer, initialTranscriptionState);

  const value = {
    state,
    dispatch,
  };

  return (
    <TranscriptionContext.Provider value={value}>
      {children}
    </TranscriptionContext.Provider>
  );
};

// ==================== Custom Hook ====================

export const useTranscription = (): UseTranscriptionReturn => {
  const context = useContext(TranscriptionContext);
  
  if (context === undefined) {
    throw new Error('useTranscription must be used within a TranscriptionProvider');
  }

  const { state, dispatch } = context;

  // Action creators
  const actions = {
    addJob: useCallback((job: TranscriptionJob) => {
      dispatch({ type: 'ADD_JOB', payload: job });
    }, [dispatch]),

    updateJobProgress: useCallback((id: string, progress: number, status?: string) => {
      dispatch({ type: 'UPDATE_JOB_PROGRESS', payload: { id, progress, status } });
    }, [dispatch]),

    completeJob: useCallback((id: string, result: TranscriptionResult) => {
      dispatch({ type: 'COMPLETE_JOB', payload: { id, result } });
    }, [dispatch]),

    errorJob: useCallback((id: string, error: string) => {
      dispatch({ type: 'ERROR_JOB', payload: { id, error } });
    }, [dispatch]),

    selectJob: useCallback((job: TranscriptionJob | null) => {
      dispatch({ type: 'SELECT_JOB', payload: job });
    }, [dispatch]),

    removeJob: useCallback((id: string) => {
      dispatch({ type: 'REMOVE_JOB', payload: id });
    }, [dispatch]),

    setProgressData: useCallback((progressData: ProgressData) => {
      dispatch({ type: 'SET_PROGRESS_DATA', payload: progressData });
    }, [dispatch]),

    setProcessing: useCallback((isProcessing: boolean) => {
      dispatch({ type: 'SET_PROCESSING', payload: isProcessing });
    }, [dispatch]),

    markJobNormalized: useCallback((id: string, normalizedAt?: string | null) => {
      dispatch({ type: 'MARK_JOB_NORMALIZED', payload: { id, normalizedAt } });
    }, [dispatch]),

    // Complex operations
    startTranscription: useCallback(async (filePath: string, modelSize: string): Promise<TranscriptionJob> => {
      const fileName = filePath.split('/').pop() || 'Unknown';

      const job: TranscriptionJob = {
        id: Date.now().toString(),
        filePath: filePath,
        fileName: fileName,
        status: 'pending',
        progress: 0,
        normalizedAt: null,
      };

      console.log('TranscriptionContext - Starting transcription:', job);
      dispatch({ type: 'ADD_JOB', payload: job });
      
      try {
        const result = await (window as any).electronAPI.startTranscription(filePath, modelSize);
        
        if (result.success && result.jobId) {
          // Update job with actual ID from main process
          const updatedJob = { ...job, id: result.jobId };
          dispatch({ type: 'REMOVE_JOB', payload: job.id });
          dispatch({ type: 'ADD_JOB', payload: updatedJob });
          return updatedJob;
        } else {
          dispatch({ type: 'ERROR_JOB', payload: { id: job.id, error: result.error || 'Unknown error' } });
          throw new Error(result.error || 'Failed to start transcription');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start transcription';
        dispatch({ type: 'ERROR_JOB', payload: { id: job.id, error: errorMessage } });
        throw error;
      }
    }, [dispatch]),
  };

  return {
    state,
    actions,
  };
};

// ==================== Selector Hooks ====================

/**
 * Hook for components that only need job list data
 */
export const useTranscriptionJobs = () => {
  const { state, actions } = useTranscription();
  
  return {
    jobs: state.jobs,
    isProcessing: state.isProcessing,
    addJob: actions.addJob,
    removeJob: actions.removeJob,
    selectJob: actions.selectJob,
  };
};

/**
 * Hook for components that only need selected job data
 */
export const useSelectedJob = () => {
  const { state, actions } = useTranscription();
  
  return {
    selectedJob: state.selectedJob,
    selectJob: actions.selectJob,
    hasSelectedJob: state.selectedJob !== null,
  };
};

/**
 * Hook for components that need progress data
 */
export const useTranscriptionProgress = () => {
  const { state, actions } = useTranscription();
  
  return {
    progressData: state.progressData,
    isProcessing: state.isProcessing,
    currentTranscriptionId: state.currentTranscriptionId,
    updateJobProgress: actions.updateJobProgress,
    setProgressData: actions.setProgressData,
  };
};

// ==================== Legacy Compatibility ====================

/**
 * Temporary hook for backward compatibility with existing components
 * @deprecated Use useTranscription(), useTranscriptionJobs(), or useSelectedJob() instead
 */
export const useLegacyTranscriptionState = () => {
  const { state, actions } = useTranscription();
  
  return {
    // Legacy state format
    transcriptionJobs: state.jobs,
    selectedJob: state.selectedJob,
    currentTranscriptionId: state.currentTranscriptionId,
    progressData: state.progressData,
    
    // Legacy action format
    setTranscriptionJobs: (jobs: TranscriptionJob[]) => {
      // This is a simplified version for compatibility
      // In reality, jobs should be added/updated individually
      console.warn('useLegacyTranscriptionState.setTranscriptionJobs is deprecated');
    },
    setSelectedJob: actions.selectJob,
    setCurrentTranscriptionId: (id: string | null) => {
      // This is handled automatically by the context
      console.warn('useLegacyTranscriptionState.setCurrentTranscriptionId is deprecated');
    },
    setProgressData: actions.setProgressData,
    handleFileImport: actions.startTranscription,
    handleJobSelect: actions.selectJob,
  };
};