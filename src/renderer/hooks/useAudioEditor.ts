/**
 * useAudioEditor.ts - Unified React hook for audio editing
 * 
 * Provides a clean, simple interface for all audio operations
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Clip } from '../types';
import { AudioManager } from '../audio/AudioManager';
import JuceAudioManager from '../audio/JuceAudioManager';
import { AudioAppState, TimelinePosition, generateWordId } from '../audio/AudioAppState';

export interface AudioEditorState {
  // Core state
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Playback state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isReady: boolean;
  
  // Timeline state  
  mode: 'listen' | 'edit';
  clips: Clip[];
  activeClipIds: Set<string>;
  deletedWordIds: Set<string>;
  totalDuration: number;
  
  // UI state
  currentWordId: string | null;
  currentClipId: string | null;
  selectedClipId: string | null;
  cursorPosition: TimelinePosition | null;
  selectedWordIds: Set<string>;
}

export interface AudioEditorActions {
  // Initialization
  initialize: (audioUrl: string, clips: Clip[]) => Promise<void>;
  
  // Playback controls
  play: () => Promise<void>;
  pause: () => void;
  togglePlayPause: () => Promise<void>;
  seekToTime: (editedTime: number) => void;
  seekToOriginalTime: (originalTime: number) => void;
  seekToWord: (clipId: string, wordIndex: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  
  // Mode switching
  setMode: (mode: 'listen' | 'edit') => void;
  
  // Editing operations
  updateClips: (clips: Clip[]) => void;
  reorderClips: (fromIndex: number, toIndex: number) => void;
  deleteClip: (clipId: string) => void;
  restoreClip: (clipId: string) => void;
  deleteWords: (wordIds: string[]) => void;
  restoreWords: (wordIds: string[]) => void;
  
  // UI operations
  setCursor: (position: TimelinePosition | null) => void;
  selectWords: (wordIds: string[]) => void;
  selectClip: (clipId: string | null) => void;
  
  // Utilities
  getClipAtTime: (editedTime: number) => Clip | null;
  getWordAtTime: (editedTime: number) => { clipId: string; wordIndex: number } | null;
  isWordDeleted: (clipId: string, wordIndex: number) => boolean;
  isClipActive: (clipId: string) => boolean;
  getEditedClips: () => Clip[]; // Clips in edited order, excluding deleted ones
  getVisibleClips: () => Clip[]; // Clips visible in current mode
  /** Get the internal reorderIndices array for undo/redo. */
  getReorderIndices: () => number[];
}

export interface UseAudioEditorOptions {
  onError?: (error: string) => void;
  onWordHighlight?: (wordId: string | null) => void;
  onClipChange?: (clipId: string | null) => void;
  onStateChange?: (state: AudioEditorState) => void;
}

export const useAudioEditor = (options: UseAudioEditorOptions = {}): [AudioEditorState, AudioEditorActions] => {
  // Keep this quiet by default. Only emit traces when VITE_AUDIO_TRACE=true
  const AUDIO_TRACE = (import.meta as any).env?.VITE_AUDIO_TRACE === 'true';
  const managerRef = useRef<AudioManager | null>(null);
  const optionsRef = useRef(options);
  
  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const [state, setState] = useState<AudioEditorState>({
    isInitialized: false,
    isLoading: false,
    error: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    playbackRate: 1.0,
    isReady: false,
    mode: 'listen',
    clips: [],
    activeClipIds: new Set(),
    deletedWordIds: new Set(),
    totalDuration: 0,
    currentWordId: null,
    currentClipId: null,
    selectedClipId: null,
    cursorPosition: null,
    selectedWordIds: new Set(),
  });

  // Convert AudioAppState to AudioEditorState
  const convertState = useCallback((appState: AudioAppState): AudioEditorState => {
    return {
      isInitialized: appState.isInitialized,
      isLoading: false,
      error: appState.error,
      isPlaying: appState.playback.isPlaying,
      currentTime: appState.playback.currentTime,
      duration: appState.playback.duration,
      volume: appState.playback.volume,
      playbackRate: appState.playback.playbackRate,
      isReady: appState.playback.isReady,
      mode: appState.ui.mode,
      clips: appState.timeline.clips,
      activeClipIds: appState.timeline.activeClipIds,
      deletedWordIds: appState.timeline.deletedWordIds,
      totalDuration: appState.timeline.totalDuration,
      currentWordId: appState.playback.currentWordId,
      currentClipId: appState.playback.currentClipId,
      selectedClipId: appState.ui.selectedClipId,
      cursorPosition: appState.ui.cursorPosition,
      selectedWordIds: appState.ui.selectedWordIds,
    };
  }, []);

  // Stable callbacks using refs
  const stableOnError = useCallback((error: string) => {
    setState(prev => ({ ...prev, error }));
    optionsRef.current.onError?.(error);
  }, []);

  const stableOnStateChange = useCallback((appState: AudioAppState) => {
    if (AUDIO_TRACE) console.log('[useAudioEditor] AudioManager state change received:', {
      clipCount: appState.timeline.clips.length,
      clipTypes: appState.timeline.clips.map(c => c.type),
      activeClipIds: Array.from(appState.timeline.activeClipIds),
      currentTime: appState.playback.currentTime,
      isPlaying: appState.playback.isPlaying,
      mode: appState.ui.mode,
      firstClipPreview: appState.timeline.clips[0] ? {
        id: appState.timeline.clips[0].id,
        type: appState.timeline.clips[0].type,
        wordCount: appState.timeline.clips[0].words?.length || 0,
        text: appState.timeline.clips[0].text?.substring(0, 50) + (appState.timeline.clips[0].text?.length > 50 ? '...' : '')
      } : null
    });
    
    const newState = convertState(appState);
    setState(newState);
    optionsRef.current.onStateChange?.(newState);
  }, [convertState]);

  const stableOnWordHighlight = useCallback((wordId: string | null) => {
    optionsRef.current.onWordHighlight?.(wordId);
  }, []);

  const stableOnClipChange = useCallback((clipId: string | null) => {
    optionsRef.current.onClipChange?.(clipId);
  }, []);

  // Initialize manager lazily when actually needed
  const getOrCreateManager = useCallback(() => {
    if (!managerRef.current) {
      const useJuce = (import.meta as any).env?.VITE_USE_JUCE === 'true' && (window as any).juceTransport;
      if (AUDIO_TRACE) console.log('Creating new', useJuce ? 'JuceAudioManager' : 'AudioManager');
      managerRef.current = (useJuce ? new JuceAudioManager({
        onStateChange: stableOnStateChange,
        onError: stableOnError,
        onWordHighlight: stableOnWordHighlight,
        onClipChange: stableOnClipChange,
      }) : new AudioManager({
        onStateChange: stableOnStateChange,
        onError: stableOnError,
        onWordHighlight: stableOnWordHighlight,
        onClipChange: stableOnClipChange,
      })) as any;
    }
    return managerRef.current;
  }, [stableOnStateChange, stableOnError, stableOnWordHighlight, stableOnClipChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        if (AUDIO_TRACE) console.log('Destroying AudioManager');
        managerRef.current.destroy();
        managerRef.current = null;
      }
    };
  }, []);

  // Actions
  const actions: AudioEditorActions = {
    // Initialization
    initialize: async (audioUrl: string, clips: Clip[]) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        const manager = getOrCreateManager();
        await manager.initialize(audioUrl, clips);
        setState(prev => ({ ...prev, isLoading: false }));
      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: `Failed to initialize: ${error}` 
        }));
        throw error;
      }
    },

    // Playback controls
    play: async () => {
      if (!managerRef.current) return;
      try {
        await managerRef.current.play();
      } catch (error) {
        options.onError?.(`Playback failed: ${error}`);
      }
    },

    pause: () => {
      managerRef.current?.pause();
    },

    togglePlayPause: async () => {
      if (AUDIO_TRACE) console.log('[useAudioEditor] togglePlayPause called');
      if (AUDIO_TRACE) console.log('[useAudioEditor] managerRef.current exists:', !!managerRef.current);
      if (!managerRef.current) {
        if (AUDIO_TRACE) console.log('[useAudioEditor] No manager found, creating one...');
        const manager = getOrCreateManager();
        if (AUDIO_TRACE) console.log('[useAudioEditor] Manager created:', !!manager);
        return;
      }
      try {
        if (AUDIO_TRACE) console.log('[useAudioEditor] Calling manager.togglePlayPause...');
        await managerRef.current.togglePlayPause();
        if (AUDIO_TRACE) console.log('[useAudioEditor] manager.togglePlayPause completed');
      } catch (error) {
        console.error('[useAudioEditor] Toggle playback failed:', error);
        options.onError?.(`Toggle playback failed: ${error}`);
      }
    },

    seekToTime: (editedTime: number) => {
      managerRef.current?.seekToEditedTime(editedTime);
    },
    // New: seek using original time
    seekToOriginalTime: (originalTime: number) => {
      (managerRef.current as any)?.seekToOriginalTime?.(originalTime);
    },

    seekToWord: (clipId: string, wordIndex: number) => {
      managerRef.current?.seekToWord(clipId, wordIndex);
    },

    setVolume: (volume: number) => {
      managerRef.current?.setVolume(volume);
    },

    setPlaybackRate: (rate: number) => {
      managerRef.current?.setPlaybackRate(rate);
    },

    // Mode switching
    setMode: (mode: 'listen' | 'edit') => {
      managerRef.current?.setMode(mode);
    },

    // Editing operations
    updateClips: (clips: Clip[]) => {
      if (AUDIO_TRACE) console.log('[useAudioEditor] updateClips called with:', {
        clipCount: clips.length,
        clipTypes: clips.map(c => c.type),
        clipIds: clips.map(c => c.id),
        hasTranscribedClips: clips.some(c => c.type === 'transcribed'),
        firstClipPreview: clips[0] ? {
          id: clips[0].id,
          type: clips[0].type,
          wordCount: clips[0].words?.length || 0,
          text: clips[0].text?.substring(0, 100) + (clips[0].text?.length > 100 ? '...' : '')
        } : null
      });
      
      if (managerRef.current) {
        if (AUDIO_TRACE) console.log('[useAudioEditor] Calling AudioManager.updateClips...');
        managerRef.current.updateClips(clips);
        if (AUDIO_TRACE) console.log('[useAudioEditor] AudioManager.updateClips completed');
      } else {
        if (AUDIO_TRACE) console.warn('[useAudioEditor] No AudioManager instance available for updateClips');
      }
    },

    reorderClips: (fromIndex: number, toIndex: number) => {
      managerRef.current?.reorderClips(fromIndex, toIndex);
    },

    deleteClip: (clipId: string) => {
      managerRef.current?.deleteClip(clipId);
    },

    restoreClip: (clipId: string) => {
      managerRef.current?.restoreClip(clipId);
    },

    deleteWords: (wordIds: string[]) => {
      managerRef.current?.deleteWords(wordIds);
    },

    restoreWords: (wordIds: string[]) => {
      managerRef.current?.restoreWords(wordIds);
    },

    // UI operations
    setCursor: (position: TimelinePosition | null) => {
      managerRef.current?.setCursor(position);
    },

    selectWords: (wordIds: string[]) => {
      managerRef.current?.selectWords(wordIds);
    },

    selectClip: (clipId: string | null) => {
      if (managerRef.current) {
        const appState = managerRef.current.getState();
        const newState = {
          ...appState,
          ui: { ...appState.ui, selectedClipId: clipId }
        };
        setState(convertState(newState));
      }
    },

    // Utilities
    getClipAtTime: (editedTime: number) => {
      if (!managerRef.current) return null;
      
      const appState = managerRef.current.getState();
      // Simple linear search through active clips
      const activeClips = appState.timeline.reorderIndices
        .map(i => appState.timeline.clips[i])
        .filter(clip => appState.timeline.activeClipIds.has(clip.id));

      let accumulatedTime = 0;
      for (const clip of activeClips) {
        const clipDuration = clip.duration;
        if (editedTime >= accumulatedTime && editedTime <= accumulatedTime + clipDuration) {
          return clip;
        }
        accumulatedTime += clipDuration;
      }
      
      return null;
    },

    getWordAtTime: (editedTime: number) => {
      const clip = actions.getClipAtTime(editedTime);
      if (!clip) return null;

      // Find word within clip
      // This is a simplified implementation - you might need to adjust based on your exact timing logic
      const relativeTime = editedTime; // You'll need to calculate the relative time within the clip
      
      for (let i = 0; i < clip.words.length; i++) {
        const word = clip.words[i];
        if (relativeTime >= word.start && relativeTime <= word.end) {
          return { clipId: clip.id, wordIndex: i };
        }
      }
      
      return null;
    },

    isWordDeleted: (clipId: string, wordIndex: number) => {
      const wordId = generateWordId(clipId, wordIndex);
      return state.deletedWordIds.has(wordId);
    },

    isClipActive: (clipId: string) => {
      return state.activeClipIds.has(clipId);
    },

    getEditedClips: () => {
      if (!managerRef.current) return [];
      
      const appState = managerRef.current.getState();
      return appState.timeline.reorderIndices
        .map(i => appState.timeline.clips[i])
        .filter(clip => appState.timeline.activeClipIds.has(clip.id));
    },

    getVisibleClips: () => {
      const editedClips = actions.getEditedClips();
      
      // Get fresh state from AudioManager to avoid stale state issues
      const currentState = managerRef.current?.getState();
      const activeClipIds = currentState?.timeline.activeClipIds || state.activeClipIds;
      const currentMode = currentState?.ui.mode || state.mode;
      
      if (currentMode === 'listen') {
        // In listen mode, hide deleted clips entirely
        return editedClips.filter(clip => activeClipIds.has(clip.id));
      } else {
        // In edit mode, show all clips (deleted ones will be styled differently)
        return editedClips;
      }
    },
    getReorderIndices: () => {
      const appState = managerRef.current?.getState();
      return appState?.timeline.reorderIndices || [];
    },
  };

  return [state, actions];
};
