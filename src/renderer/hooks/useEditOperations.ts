/**
 * useEditOperations - React hook for atomic edit operations
 *
 * This hook provides a clean interface for performing edit operations
 * that are validated and applied through the main process.
 *
 * Key features:
 * - All edits go through ProjectDataStore validation
 * - Optimistic UI updates with rollback on failure
 * - Loading states and error handling
 * - Undo/redo support through operation history
 */

import { useState, useCallback } from 'react';
import { useProjectV2 } from '../contexts/ProjectContextV2';
import {
  EditOperation,
  Clip,
  Segment,
  WordSegment,
  SpacerSegment
} from '../../shared/types';

// ==================== Types ====================

export interface EditOperationResult {
  success: boolean;
  error?: string;
  operation?: EditOperation;
}

export interface EditOperationState {
  isLoading: boolean;
  error: string | null;
  lastOperation: EditOperation | null;
}

export interface UseEditOperationsReturn {
  // State
  operationState: EditOperationState;

  // Word editing
  editWord: (clipId: string, segmentIndex: number, newText: string) => Promise<EditOperationResult>;

  // Clip operations
  splitClip: (clipId: string, segmentIndex: number) => Promise<EditOperationResult>;
  mergeClips: (clipIds: string[]) => Promise<EditOperationResult>;
  deleteClip: (clipId: string) => Promise<EditOperationResult>;
  reorderClips: (clipId: string, newOrder: number) => Promise<EditOperationResult>;
  changeSpeaker: (clipId: string, newSpeaker: string) => Promise<EditOperationResult>;

  // Spacer operations
  insertSpacer: (clipId: string, segmentIndex: number, duration: number) => Promise<EditOperationResult>;
  deleteSpacer: (clipId: string, segmentIndex: number) => Promise<EditOperationResult>;

  // Advanced operations
  nudgeBoundary: (clipId: string, boundary: 'start' | 'end', deltaSeconds: number) => Promise<EditOperationResult>;

  // Utilities
  clearError: () => void;
  canSplitClip: (clipId: string, segmentIndex: number) => boolean;
  canMergeClips: (clipIds: string[]) => boolean;
}

// ==================== Hook Implementation ====================

export function useEditOperations(): UseEditOperationsReturn {
  const { state: projectState, actions: projectActions } = useProjectV2();

  const [operationState, setOperationState] = useState<EditOperationState>({
    isLoading: false,
    error: null,
    lastOperation: null
  });

  // ==================== Utilities ====================

  const setLoading = useCallback((isLoading: boolean) => {
    setOperationState(prev => ({ ...prev, isLoading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setOperationState(prev => ({ ...prev, error }));
  }, []);

  const setLastOperation = useCallback((operation: EditOperation | null) => {
    setOperationState(prev => ({ ...prev, lastOperation: operation }));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  // ==================== Word Editing ====================

  const editWord = useCallback(async (
    clipId: string,
    segmentIndex: number,
    newText: string
  ): Promise<EditOperationResult> => {
    try {
      setLoading(true);
      setError(null);

      const success = await projectActions.editWord(clipId, segmentIndex, newText);

      setLoading(false);

      if (success) {
        return { success: true };
      } else {
        const error = 'Word edit operation failed';
        setError(error);
        return { success: false, error };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoading(false);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [projectActions, setLoading, setError]);

  // ==================== Clip Operations ====================

  const splitClip = useCallback(async (
    clipId: string,
    segmentIndex: number
  ): Promise<EditOperationResult> => {
    try {
      // Validate before attempting
      if (!canSplitClip(clipId, segmentIndex)) {
        const error = 'Cannot split clip at this position';
        setError(error);
        return { success: false, error };
      }

      setLoading(true);
      setError(null);

      const success = await projectActions.splitClip(clipId, segmentIndex);

      setLoading(false);

      if (success) {
        return { success: true };
      } else {
        const error = 'Clip split operation failed';
        setError(error);
        return { success: false, error };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoading(false);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [projectActions, setLoading, setError]);

  const mergeClips = useCallback(async (
    clipIds: string[]
  ): Promise<EditOperationResult> => {
    try {
      // Validate before attempting
      if (!canMergeClips(clipIds)) {
        const error = 'Cannot merge the selected clips';
        setError(error);
        return { success: false, error };
      }

      setLoading(true);
      setError(null);

      const success = await projectActions.mergeClips(clipIds);

      setLoading(false);

      if (success) {
        return { success: true };
      } else {
        const error = 'Clip merge operation failed';
        setError(error);
        return { success: false, error };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoading(false);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [projectActions, setLoading, setError]);

  const deleteClip = useCallback(async (
    clipId: string
  ): Promise<EditOperationResult> => {
    try {
      setLoading(true);
      setError(null);

      const success = await projectActions.deleteClip(clipId);

      setLoading(false);

      if (success) {
        return { success: true };
      } else {
        const error = 'Clip deletion failed';
        setError(error);
        return { success: false, error };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoading(false);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [projectActions, setLoading, setError]);

  const reorderClips = useCallback(async (
    clipId: string,
    newOrder: number
  ): Promise<EditOperationResult> => {
    try {
      setLoading(true);
      setError(null);

      const success = await projectActions.reorderClips(clipId, newOrder);

      setLoading(false);

      if (success) {
        return { success: true };
      } else {
        const error = 'Clip reorder operation failed';
        setError(error);
        return { success: false, error };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoading(false);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [projectActions, setLoading, setError]);

  const changeSpeaker = useCallback(async (
    clipId: string,
    newSpeaker: string
  ): Promise<EditOperationResult> => {
    try {
      setLoading(true);
      setError(null);

      const success = await projectActions.changeSpeaker(clipId, newSpeaker);

      setLoading(false);

      if (success) {
        return { success: true };
      } else {
        const error = 'Speaker change operation failed';
        setError(error);
        return { success: false, error };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoading(false);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [projectActions, setLoading, setError]);

  // ==================== Spacer Operations ====================

  const insertSpacer = useCallback(async (
    clipId: string,
    segmentIndex: number,
    duration: number
  ): Promise<EditOperationResult> => {
    try {
      if (duration <= 0) {
        const error = 'Spacer duration must be positive';
        setError(error);
        return { success: false, error };
      }

      setLoading(true);
      setError(null);

      const success = await projectActions.insertSpacer(clipId, segmentIndex, duration);

      setLoading(false);

      if (success) {
        return { success: true };
      } else {
        const error = 'Spacer insertion failed';
        setError(error);
        return { success: false, error };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoading(false);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [projectActions, setLoading, setError]);

  const deleteSpacer = useCallback(async (
    clipId: string,
    segmentIndex: number
  ): Promise<EditOperationResult> => {
    try {
      // For now, implement as zero-duration spacer insertion
      // In a full implementation, this would be a separate operation type
      setLoading(true);
      setError(null);

      // This is a simplified implementation
      // A full implementation would have a dedicated "deleteSpacer" operation
      const success = await projectActions.insertSpacer(clipId, segmentIndex, 0);

      setLoading(false);

      if (success) {
        return { success: true };
      } else {
        const error = 'Spacer deletion failed';
        setError(error);
        return { success: false, error };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoading(false);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [projectActions, setLoading, setError]);

  // ==================== Advanced Operations ====================

  const nudgeBoundary = useCallback(async (
    clipId: string,
    boundary: 'start' | 'end',
    deltaSeconds: number
  ): Promise<EditOperationResult> => {
    try {
      setLoading(true);
      setError(null);

      // For now, this is a placeholder
      // A full implementation would add this to the operations system
      console.log(`Would nudge ${boundary} boundary of clip ${clipId} by ${deltaSeconds}s`);

      setLoading(false);
      const error = 'Boundary nudging not yet implemented';
      setError(error);
      return { success: false, error };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoading(false);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError]);

  // ==================== Validation Utilities ====================

  const canSplitClip = useCallback((clipId: string, segmentIndex: number): boolean => {
    const clip = projectState.clips.find(c => c.id === clipId);
    if (!clip || clip.status !== 'active') return false;

    // Must have at least 2 segments and split point must be valid
    return clip.segments.length >= 2 &&
           segmentIndex > 0 &&
           segmentIndex < clip.segments.length;
  }, [projectState.clips]);

  const canMergeClips = useCallback((clipIds: string[]): boolean => {
    if (clipIds.length < 2) return false;

    const clips = clipIds.map(id => projectState.clips.find(c => c.id === id))
                        .filter((c): c is Clip => c !== undefined && c.status === 'active');

    if (clips.length !== clipIds.length) return false;

    // Check if clips are contiguous (adjacent orders)
    const orders = clips.map(c => c.order).sort((a, b) => a - b);
    for (let i = 1; i < orders.length; i++) {
      if (orders[i] !== orders[i-1] + 1) {
        return false; // Not contiguous
      }
    }

    return true;
  }, [projectState.clips]);

  // ==================== Return Hook Interface ====================

  return {
    operationState,

    // Word editing
    editWord,

    // Clip operations
    splitClip,
    mergeClips,
    deleteClip,
    reorderClips,
    changeSpeaker,

    // Spacer operations
    insertSpacer,
    deleteSpacer,

    // Advanced operations
    nudgeBoundary,

    // Utilities
    clearError,
    canSplitClip,
    canMergeClips,
  };
}

// ==================== Higher-level Utility Hooks ====================

/**
 * Hook for common editing patterns
 */
export function useCommonEdits() {
  const editOps = useEditOperations();

  const splitAtCurrentPosition = useCallback(async (clipId: string, time: number) => {
    // Find segment index at the given time
    // This would need to be implemented with segment timing logic
    console.log(`Would split clip ${clipId} at time ${time}`);
    return { success: false, error: 'Not implemented' };
  }, []);

  const mergeSelectedClips = useCallback(async (selectedClipIds: string[]) => {
    return editOps.mergeClips(selectedClipIds);
  }, [editOps]);

  const deleteSelectedClips = useCallback(async (selectedClipIds: string[]) => {
    const results = await Promise.all(
      selectedClipIds.map(id => editOps.deleteClip(id))
    );

    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      return { success: false, error: `Failed to delete ${failures.length} clips` };
    }

    return { success: true };
  }, [editOps]);

  return {
    ...editOps,
    splitAtCurrentPosition,
    mergeSelectedClips,
    deleteSelectedClips,
  };
}