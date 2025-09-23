/**
 * ProjectContext v2.0 - Thin cache for main process authority
 *
 * This context no longer owns project state. Instead, it:
 * 1. Dispatches edit operations to main process
 * 2. Subscribes to authoritative updates from main
 * 3. Maintains only UI-specific state (selections, dirty flags)
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  ProjectData,
  Clip,
  EditOperation,
  ValidationResult
} from '../../shared/types';
import {
  createSplitClipOperation,
  createMergeClipsOperation,
  createDeleteClipOperation,
  createReorderClipsOperation,
  createInsertSpacerOperation,
  createEditWordOperation,
  createChangeSpeakerOperation,
  createRenameSpeakerOperation
} from '../../shared/operations';

// ==================== Types ====================

interface TranscriptionJob {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

interface ProjectContextState {
  // Cached state from main process
  projectData: ProjectData | null;
  clips: Clip[];

  // UI-specific state (not synced to main)
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  currentProjectPath: string | null;
  isConnected: boolean;

  // Transcription state
  currentTranscriptionJob: TranscriptionJob | null;
  isTranscribing: boolean;

  // UI selections and transient state
  selectedClipId: string | null;
  selectedSegmentIndex: number | null;
  isEditMode: boolean;
}

interface ProjectContextActions {
  // Edit operations (dispatched to main process)
  splitClip: (clipId: string, segmentIndex: number) => Promise<boolean>;
  mergeClips: (clipIds: string[]) => Promise<boolean>;
  deleteClip: (clipId: string) => Promise<boolean>;
  reorderClips: (clipId: string, newOrder: number) => Promise<boolean>;
  insertSpacer: (clipId: string, segmentIndex: number, duration: number) => Promise<boolean>;
  editWord: (clipId: string, segmentIndex: number, newText: string) => Promise<boolean>;
  changeSpeaker: (clipId: string, newSpeaker: string) => Promise<boolean>;
  renameSpeaker: (oldSpeakerName: string, newSpeakerName: string) => Promise<boolean>;

  // Project management
  loadProject: (projectData: ProjectData) => Promise<boolean>;
  saveProject: () => Promise<boolean>;
  validateProject: () => Promise<ValidationResult | null>;
  getOperationHistory: () => Promise<EditOperation[]>;

  // v2.0 Transcription operations
  startTranscription: (filePath: string, options: any) => Promise<boolean>;
  cancelTranscription: () => Promise<boolean>;

  // UI state management
  setSelectedClip: (clipId: string | null) => void;
  setSelectedSegment: (clipId: string | null, segmentIndex: number | null) => void;
  setEditMode: (isEdit: boolean) => void;
  setCurrentProjectPath: (path: string | null) => void;
  setUnsavedChanges: (hasChanges: boolean) => void;

  // Utilities
  refreshFromMain: () => Promise<void>;
}

interface ProjectContextValue {
  state: ProjectContextState;
  actions: ProjectContextActions;
}

// ==================== Context ====================

const ProjectContext = createContext<ProjectContextValue | null>(null);

// ==================== Provider ====================

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  // State
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Transcription state
  const [currentTranscriptionJob, setCurrentTranscriptionJob] = useState<TranscriptionJob | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionAudioPath, setTranscriptionAudioPath] = useState<string | null>(null);

  // UI selections
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // ==================== Main Process Communication ====================

  // Subscribe to main process updates and transcription events
  useEffect(() => {
    if (!window.electronAPI) return;

    // Handle project updates from main process
    const handleProjectUpdated = (updatedProjectData: ProjectData) => {
      console.log('📦 Project updated from main process');
      setProjectData(updatedProjectData);
      setClips(updatedProjectData.clips.clips);
      setError(null);
    };


    // Handle project errors
    const handleProjectError = (errorMessage: string) => {
      console.error('❌ Project error from main process:', errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    };

    // Handle operation results
    const handleOperationApplied = (operation: EditOperation) => {
      console.log('✅ Operation applied:', operation.type);
      // Main process will send project:updated event with new state
    };

    const handleOperationFailed = (operation: EditOperation, errorMessage: string) => {
      console.error('❌ Operation failed:', operation.type, errorMessage);
      setError(`Operation ${operation.type} failed: ${errorMessage}`);
    };

    // Subscribe to events
    window.electronAPI.onProjectUpdated(handleProjectUpdated);
    window.electronAPI.onProjectError(handleProjectError);
    window.electronAPI.onOperationApplied(handleOperationApplied);
    window.electronAPI.onOperationFailed(handleOperationFailed);

    // Subscribe to transcription events
    const handleTranscriptionProgress = (job: any) => {
      console.log('🔄 ProjectContextV2: Transcription progress event:', job);
      setCurrentTranscriptionJob({
        id: job.id,
        fileName: job.fileName,
        status: job.status,
        progress: job.progress,
        error: job.error,
      });
    };

    const handleTranscriptionComplete = async (job: any) => {
      console.log('✅ ProjectContextV2: Transcription complete event:', job);

      // Import segments directly to ProjectDataStore
      try {
        const importResult = await (window as any).electronAPI?.transcriptionImportV2?.(
          job.segments || [],
          job.speakers || {},
          {
            fileName: job.fileName,
            duration: 0,
            audioPath: transcriptionAudioPath // Include the stored audio path
          }
        );

        if (importResult?.success) {
          setIsTranscribing(false);
          setIsLoading(false);
          setCurrentTranscriptionJob(null);
          setTranscriptionAudioPath(null); // Clear stored audio path
          // Refresh state from main process
          await refreshFromMain();
          console.log('✅ ProjectContextV2: Transcription imported successfully');
        } else {
          throw new Error('Failed to import transcription result');
        }
      } catch (error) {
        console.error('❌ ProjectContextV2: Failed to import transcription:', error);
        setError(error instanceof Error ? error.message : 'Failed to import transcription');
        setIsTranscribing(false);
        setIsLoading(false);
        setTranscriptionAudioPath(null); // Clear stored audio path on error
      }
    };

    const handleTranscriptionError = (job: any) => {
      console.log('❌ ProjectContextV2: Transcription error event:', job);
      setCurrentTranscriptionJob({
        id: job.id,
        fileName: job.fileName,
        status: job.status,
        progress: job.progress,
        error: job.error,
      });
      setError(job.error || 'Transcription failed');
      setIsTranscribing(false);
      setIsLoading(false);
      setTranscriptionAudioPath(null); // Clear stored audio path on error
    };

    // Set up transcription event listeners if available
    if (window.electronAPI.onTranscriptionProgress) {
      window.electronAPI.onTranscriptionProgress(handleTranscriptionProgress);
    }
    if (window.electronAPI.onTranscriptionComplete) {
      window.electronAPI.onTranscriptionComplete(handleTranscriptionComplete);
    }
    if (window.electronAPI.onTranscriptionError) {
      window.electronAPI.onTranscriptionError(handleTranscriptionError);
    }

    // Cleanup function would go here if electronAPI supported it
    return () => {
      // Note: Current electronAPI doesn't support unsubscribing
      // This is acceptable for now since this context lives for the app lifetime
    };
  }, []);

  // ==================== Edit Operation Actions ====================

  const splitClip = useCallback(async (clipId: string, segmentIndex: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      const operation = createSplitClipOperation(clipId, segmentIndex);
      const result = await window.electronAPI.projectApplyEdit(operation);
      setIsLoading(false);

      if (result.success) {
        return true;
      } else {
        setError(result.error || 'Split clip operation failed');
        return false;
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Split clip failed: ${error.message}`);
      return false;
    }
  }, []);

  const mergeClips = useCallback(async (clipIds: string[]): Promise<boolean> => {
    try {
      setIsLoading(true);
      const operation = createMergeClipsOperation(clipIds);
      const result = await window.electronAPI.projectApplyEdit(operation);
      setIsLoading(false);

      if (result.success) {
        return true;
      } else {
        setError(result.error || 'Merge clips operation failed');
        return false;
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Merge clips failed: ${error.message}`);
      return false;
    }
  }, []);

  const deleteClip = useCallback(async (clipId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const operation = createDeleteClipOperation(clipId);
      const result = await window.electronAPI.projectApplyEdit(operation);
      setIsLoading(false);

      if (result.success) {
        // Clear selection if deleted clip was selected
        if (selectedClipId === clipId) {
          setSelectedClipId(null);
          setSelectedSegmentIndex(null);
        }
        return true;
      } else {
        setError(result.error || 'Delete clip operation failed');
        return false;
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Delete clip failed: ${error.message}`);
      return false;
    }
  }, [selectedClipId]);

  const reorderClips = useCallback(async (clipId: string, newOrder: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      const operation = createReorderClipsOperation(clipId, newOrder);
      const result = await window.electronAPI.projectApplyEdit(operation);
      setIsLoading(false);

      if (result.success) {
        return true;
      } else {
        setError(result.error || 'Reorder clips operation failed');
        return false;
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Reorder clips failed: ${error.message}`);
      return false;
    }
  }, []);

  const insertSpacer = useCallback(async (clipId: string, segmentIndex: number, duration: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      const operation = createInsertSpacerOperation(clipId, segmentIndex, duration);
      const result = await window.electronAPI.projectApplyEdit(operation);
      setIsLoading(false);

      if (result.success) {
        return true;
      } else {
        setError(result.error || 'Insert spacer operation failed');
        return false;
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Insert spacer failed: ${error.message}`);
      return false;
    }
  }, []);

  const editWord = useCallback(async (clipId: string, segmentIndex: number, newText: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const operation = createEditWordOperation(clipId, segmentIndex, newText);
      const result = await window.electronAPI.projectApplyEdit(operation);
      setIsLoading(false);

      if (result.success) {
        return true;
      } else {
        setError(result.error || 'Edit word operation failed');
        return false;
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Edit word failed: ${error.message}`);
      return false;
    }
  }, []);

  const changeSpeaker = useCallback(async (clipId: string, newSpeaker: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const operation = createChangeSpeakerOperation(clipId, newSpeaker);
      const result = await window.electronAPI.projectApplyEdit(operation);
      setIsLoading(false);

      if (result.success) {
        return true;
      } else {
        setError(result.error || 'Change speaker operation failed');
        return false;
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Change speaker failed: ${error.message}`);
      return false;
    }
  }, []);

  const renameSpeaker = useCallback(async (oldSpeakerName: string, newSpeakerName: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const operation = createRenameSpeakerOperation(oldSpeakerName, newSpeakerName);
      const result = await window.electronAPI.projectApplyEdit(operation);
      setIsLoading(false);

      if (result.success) {
        return true;
      } else {
        setError(result.error || 'Rename speaker operation failed');
        return false;
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Rename speaker failed: ${error.message}`);
      return false;
    }
  }, []);

  // ==================== Project Management Actions ====================

  const loadProject = useCallback(async (newProjectData: ProjectData): Promise<boolean> => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI.projectLoadIntoStore(newProjectData);
      setIsLoading(false);

      if (result.success) {
        // State will be updated via onProjectUpdated event
        return true;
      } else {
        setError(result.error || 'Failed to load project');
        return false;
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Load project failed: ${error.message}`);
      return false;
    }
  }, []);

  const validateProject = useCallback(async (): Promise<ValidationResult | null> => {
    try {
      const result = await window.electronAPI.projectValidate();

      if (result.success && result.data) {
        return result.data;
      } else {
        setError(result.error || 'Project validation failed');
        return null;
      }
    } catch (error) {
      setError(`Project validation failed: ${error.message}`);
      return null;
    }
  }, []);

  const getOperationHistory = useCallback(async (): Promise<EditOperation[]> => {
    try {
      const result = await window.electronAPI.projectGetHistory();

      if (result.success && result.data) {
        return result.data;
      } else {
        setError(result.error || 'Failed to get operation history');
        return [];
      }
    } catch (error) {
      setError(`Get operation history failed: ${error.message}`);
      return [];
    }
  }, []);

  const refreshFromMain = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI.projectGetState();
      setIsLoading(false);

      if (result.success && result.data) {
        setProjectData(result.data);
        setClips(result.data.clips.clips);
        setError(null);
      } else {
        setError(result.error || 'Failed to refresh from main process');
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Refresh failed: ${error.message}`);
    }
  }, []);

  // ==================== v2.0 Transcription Actions ====================

  const startTranscription = useCallback(async (filePath: string, options: any): Promise<boolean> => {
    try {
      console.log('🎬 ProjectContextV2.startTranscription called with:', { filePath, options });

      setIsLoading(true);
      setIsTranscribing(true);
      setError(null);
      setTranscriptionAudioPath(filePath);

      console.log('🔧 ProjectContextV2: State updated, calling electronAPI.transcriptionStartV2...');

      // Check if electronAPI is available
      if (!(window as any).electronAPI?.transcriptionStartV2) {
        throw new Error('electronAPI.transcriptionStartV2 is not available');
      }

      // Start v2.0 transcription via IPC
      const result = await (window as any).electronAPI.transcriptionStartV2(filePath, options);

      console.log('✅ ProjectContextV2: transcriptionStartV2 returned:', result);

      if (result?.success && result.jobId) {
        const job: TranscriptionJob = {
          id: result.jobId,
          fileName: filePath.split('/').pop() || 'Unknown file',
          status: 'pending',
          progress: 0,
        };

        setCurrentTranscriptionJob(job);

        // Set up progress monitoring
        monitorTranscriptionProgress(result.jobId);

        return true;
      } else {
        throw new Error(result?.error || 'Failed to start transcription');
      }
    } catch (error) {
      console.error('Transcription failed to start:', error);
      setError(error instanceof Error ? error.message : 'Failed to start transcription');
      setIsTranscribing(false);
      setIsLoading(false);
      setTranscriptionAudioPath(null); // Clear stored audio path on error
      return false;
    }
  }, []);

  const cancelTranscription = useCallback(async (): Promise<boolean> => {
    if (!currentTranscriptionJob) return false;

    try {
      const result = await (window as any).electronAPI?.transcriptionCancelV2?.(currentTranscriptionJob.id);

      if (result?.success) {
        setCurrentTranscriptionJob(null);
        setIsTranscribing(false);
        setIsLoading(false);
        setTranscriptionAudioPath(null); // Clear stored audio path on cancel
        return true;
      } else {
        throw new Error(result?.error || 'Failed to cancel transcription');
      }
    } catch (error) {
      console.error('Failed to cancel transcription:', error);
      setError(error instanceof Error ? error.message : 'Failed to cancel transcription');
      setTranscriptionAudioPath(null); // Clear stored audio path on error
      return false;
    }
  }, [currentTranscriptionJob]);

  const saveProject = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const result = await (window as any).electronAPI?.saveProject?.(currentProjectPath, projectData);
      setIsLoading(false);

      if (result?.success) {
        setHasUnsavedChanges(false);
        return true;
      } else {
        throw new Error(result?.error || 'Failed to save project');
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      setError(error instanceof Error ? error.message : 'Failed to save project');
      setIsLoading(false);
      return false;
    }
  }, [currentProjectPath, projectData]);

  // Monitor transcription progress
  const monitorTranscriptionProgress = useCallback((jobId: string) => {
    const checkProgress = async () => {
      try {
        const result = await (window as any).electronAPI?.transcriptionGetJobV2?.(jobId);

        if (result?.success && result.data) {
          const job = result.data;

          setCurrentTranscriptionJob({
            id: job.id,
            fileName: job.fileName,
            status: job.status,
            progress: job.progress,
            error: job.error,
          });

          if (job.status === 'completed') {
            console.log('✅ Transcription completed, importing segments');

            // Import segments directly to ProjectDataStore
            const importResult = await (window as any).electronAPI?.transcriptionImportV2?.(
              job.segments || [],
              job.speakers || {},
              { fileName: job.fileName, duration: 0 }
            );

            if (importResult?.success) {
              setIsTranscribing(false);
              setIsLoading(false);
              // Refresh state from main process
              await refreshFromMain();
            } else {
              throw new Error('Failed to import transcription result');
            }

          } else if (job.status === 'error') {
            setError(job.error || 'Transcription failed');
            setIsTranscribing(false);
            setIsLoading(false);

          } else if (job.status === 'processing' || job.status === 'pending') {
            // Continue monitoring
            setTimeout(checkProgress, 1000);
          }
        }
      } catch (error) {
        console.error('Failed to check transcription progress:', error);
        setError('Failed to monitor transcription progress');
        setIsTranscribing(false);
        setIsLoading(false);
      }
    };

    // Start monitoring
    checkProgress();
  }, [refreshFromMain]);


  // ==================== UI State Actions ====================

  const setSelectedClip = useCallback((clipId: string | null) => {
    setSelectedClipId(clipId);
    if (!clipId) {
      setSelectedSegmentIndex(null);
    }
  }, []);

  const setSelectedSegment = useCallback((clipId: string | null, segmentIndex: number | null) => {
    setSelectedClipId(clipId);
    setSelectedSegmentIndex(segmentIndex);
  }, []);

  // ==================== Context Value ====================

  const contextValue: ProjectContextValue = {
    state: {
      projectData,
      clips,
      isLoading,
      error,
      hasUnsavedChanges,
      currentProjectPath,
      isConnected,
      currentTranscriptionJob,
      isTranscribing,
      selectedClipId,
      selectedSegmentIndex,
      isEditMode,
    },
    actions: {
      // Edit operations
      splitClip,
      mergeClips,
      deleteClip,
      reorderClips,
      insertSpacer,
      editWord,
      changeSpeaker,
      renameSpeaker,

      // Project management
      loadProject,
      saveProject,
      validateProject,
      getOperationHistory,

      // v2.0 Transcription operations
      startTranscription,
      cancelTranscription,

      // UI state
      setSelectedClip,
      setSelectedSegment,
      setEditMode: setIsEditMode,
      setCurrentProjectPath,
      setUnsavedChanges: setHasUnsavedChanges,

      // Utilities
      refreshFromMain,
    },
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

// ==================== Hook ====================

export function useProjectV2(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectV2 must be used within a ProjectProvider');
  }
  return context;
}

// ==================== Utilities ====================

/**
 * Get clip by ID with validation
 */
export function useClipById(clipId: string | null): Clip | null {
  const { state } = useProjectV2();

  if (!clipId || !state.clips) return null;

  return state.clips.find(clip => clip.id === clipId) || null;
}

/**
 * Get active (non-deleted) clips
 */
export function useActiveClips(): Clip[] {
  const { state } = useProjectV2();

  return state.clips.filter(clip => clip.status === 'active');
}

/**
 * Get speakers from project data
 */
export function useProjectSpeakers(): { [key: string]: string } {
  const { state } = useProjectV2();

  return state.projectData?.speakers?.speakers || {};
}