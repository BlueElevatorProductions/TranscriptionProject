/**
 * AudioContext - Centralized audio state management
 * Handles playback state, audio source, and synchronization across components
 */

import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { AudioState, AudioAction, SharedAudioState, UseAudioReturn } from '../types';

// ==================== Initial State ====================

const initialAudioState: AudioState = {
  currentTime: 0,
  isPlaying: false,
  volume: 0.7,
  playbackSpeed: 1.0,
  currentAudioPath: null,
  duration: 0,
  isReady: false,
};

// ==================== Reducer ====================

function audioReducer(state: AudioState, action: AudioAction): AudioState {
  switch (action.type) {
    case 'UPDATE_AUDIO_STATE': {
      const updates = action.payload;
      const newState = { ...state };

      // Apply updates with validation
      if (updates.currentTime !== undefined) {
        newState.currentTime = isNaN(updates.currentTime) ? state.currentTime : updates.currentTime;
      }
      
      if (updates.isPlaying !== undefined) {
        newState.isPlaying = typeof updates.isPlaying === 'boolean' ? updates.isPlaying : false;
      }
      
      if (updates.volume !== undefined) {
        newState.volume = isNaN(updates.volume) ? state.volume : Math.max(0, Math.min(1, updates.volume));
      }
      
      if (updates.playbackSpeed !== undefined) {
        newState.playbackSpeed = isNaN(updates.playbackSpeed) ? state.playbackSpeed : Math.max(0.1, Math.min(4.0, updates.playbackSpeed));
      }

      console.log('AudioContext - State update:', { 
        previousState: state, 
        updates, 
        newState 
      });

      return newState;
    }

    case 'SET_AUDIO_SOURCE':
      return {
        ...state,
        currentAudioPath: action.payload.path,
        duration: action.payload.duration,
        currentTime: 0,
        isPlaying: false,
        isReady: false,
      };

    case 'SET_READY':
      return {
        ...state,
        isReady: action.payload,
      };

    case 'RESET_AUDIO':
      return {
        ...initialAudioState,
        volume: state.volume, // Preserve user volume preference
        playbackSpeed: state.playbackSpeed, // Preserve user speed preference
      };

    default:
      return state;
  }
}

// ==================== Context Creation ====================

interface AudioContextType {
  state: AudioState;
  dispatch: React.Dispatch<AudioAction>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

// ==================== Provider Component ====================

interface AudioProviderProps {
  children: ReactNode;
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(audioReducer, initialAudioState);

  const value = {
    state,
    dispatch,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};

// ==================== Custom Hook ====================

export const useAudio = (): UseAudioReturn => {
  const context = useContext(AudioContext);
  
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }

  const { state, dispatch } = context;

  // Action creators with validation and logging
  const actions = {
    updateAudioState: useCallback((updates: Partial<SharedAudioState>) => {
      dispatch({ type: 'UPDATE_AUDIO_STATE', payload: updates });
    }, [dispatch]),

    setAudioSource: useCallback((path: string, duration: number) => {
      console.log('AudioContext - Setting audio source:', { path, duration });
      dispatch({ type: 'SET_AUDIO_SOURCE', payload: { path, duration } });
    }, [dispatch]),

    resetAudio: useCallback(() => {
      console.log('AudioContext - Resetting audio state');
      dispatch({ type: 'RESET_AUDIO' });
    }, [dispatch]),

    play: useCallback(() => {
      console.log('AudioContext - Play action');
      dispatch({ type: 'UPDATE_AUDIO_STATE', payload: { isPlaying: true } });
    }, [dispatch]),

    pause: useCallback(() => {
      console.log('AudioContext - Pause action');
      dispatch({ type: 'UPDATE_AUDIO_STATE', payload: { isPlaying: false } });
    }, [dispatch]),

    seek: useCallback((time: number) => {
      console.log('AudioContext - Seek action:', time);
      dispatch({ type: 'UPDATE_AUDIO_STATE', payload: { currentTime: time } });
    }, [dispatch]),
  };

  // Helper to convert to legacy SharedAudioState format for backward compatibility
  const sharedAudioState: SharedAudioState = {
    currentTime: state.currentTime,
    isPlaying: state.isPlaying,
    volume: state.volume,
    playbackSpeed: state.playbackSpeed,
  };

  return {
    state: {
      ...state,
      // Legacy compatibility - can be removed once all components are migrated
      ...sharedAudioState,
    },
    actions,
  };
};

// ==================== Legacy Compatibility Hook ====================

/**
 * Temporary hook for backward compatibility with existing components
 * Returns the old handleAudioStateUpdate function signature
 * @deprecated Use useAudio() instead
 */
export const useLegacyAudioState = () => {
  const { state, actions } = useAudio();
  
  const sharedAudioState: SharedAudioState = {
    currentTime: state.currentTime,
    isPlaying: state.isPlaying,
    volume: state.volume,
    playbackSpeed: state.playbackSpeed,
  };

  const handleAudioStateUpdate = useCallback((updates: Partial<SharedAudioState>) => {
    actions.updateAudioState(updates);
  }, [actions]);

  return {
    sharedAudioState,
    handleAudioStateUpdate,
  };
};

// ==================== Debug Hook ====================

/**
 * Debug hook for development - provides detailed audio state information
 */
export const useAudioDebug = () => {
  const { state } = useAudio();
  
  return {
    state,
    isValid: {
      currentTime: !isNaN(state.currentTime) && isFinite(state.currentTime),
      isPlaying: typeof state.isPlaying === 'boolean',
      volume: !isNaN(state.volume) && state.volume >= 0 && state.volume <= 1,
      playbackSpeed: !isNaN(state.playbackSpeed) && state.playbackSpeed >= 0.1 && state.playbackSpeed <= 4.0,
      hasAudioSource: state.currentAudioPath !== null,
      isReady: state.isReady,
    },
    summary: {
      formatted: {
        currentTime: `${Math.floor(state.currentTime / 60)}:${Math.floor(state.currentTime % 60).toString().padStart(2, '0')}`,
        volume: `${Math.round(state.volume * 100)}%`,
        speed: `${state.playbackSpeed}x`,
      },
      status: state.isPlaying ? 'Playing' : 'Paused',
    },
  };
};