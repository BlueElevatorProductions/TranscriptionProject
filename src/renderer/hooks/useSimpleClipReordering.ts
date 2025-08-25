/**
 * useSimpleClipReordering.ts - Direct solution for clip reordering
 * 
 * Integrates with existing audio context to make reordering actually work
 */

import { useCallback, useRef, useEffect } from 'react';
import { Clip } from '../types';
import { SimpleClipSequencer } from '../audio/SimpleClipSequencer';

export interface SimpleReorderingActions {
  // Convert times between edited and original
  editedTimeToOriginal: (editedTime: number) => { originalTime: number; clipId: string } | null;
  originalTimeToEdited: (originalTime: number, clipId: string) => number | null;
  
  // Get edited timeline info  
  getTotalEditedDuration: () => number;
  getClipAtEditedTime: (editedTime: number) => Clip | null;
  getReorderedClips: () => Clip[];
  
  // Update when clips change
  updateClips: (clips: Clip[]) => void;
}

export const useSimpleClipReordering = (initialClips: Clip[]): SimpleReorderingActions => {
  const sequencerRef = useRef<SimpleClipSequencer>(new SimpleClipSequencer(initialClips));
  
  // Update sequencer when clips change
  useEffect(() => {
    sequencerRef.current.updateClips(initialClips);
  }, [initialClips]);
  
  const actions: SimpleReorderingActions = {
    editedTimeToOriginal: useCallback((editedTime: number) => {
      return sequencerRef.current.editedTimeToOriginalTime(editedTime);
    }, []),
    
    originalTimeToEdited: useCallback((originalTime: number, clipId: string) => {
      return sequencerRef.current.originalTimeToEditedTime(originalTime, clipId);
    }, []),
    
    getTotalEditedDuration: useCallback(() => {
      return sequencerRef.current.getTotalEditedDuration();
    }, []),
    
    getClipAtEditedTime: useCallback((editedTime: number) => {
      return sequencerRef.current.getClipAtEditedTime(editedTime);
    }, []),
    
    getReorderedClips: useCallback(() => {
      return sequencerRef.current.getReorderedClips();
    }, []),
    
    updateClips: useCallback((clips: Clip[]) => {
      sequencerRef.current.updateClips(clips);
    }, [])
  };
  
  return actions;
};