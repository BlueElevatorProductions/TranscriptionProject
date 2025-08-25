/**
 * AudioAppState.ts - Centralized state management for audio editing
 * 
 * Single source of truth for all audio, timeline, and UI state
 */

import { Clip, Word } from '../types';

export interface TimelinePosition {
  editedTime: number;    // Time in the edited timeline (after reordering/deletions)
  originalTime: number;  // Time in the original audio file
  clipId: string;
  wordIndex: number;     // Global word index across all clips
  localWordIndex: number; // Word index within the specific clip
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;        // Current position in edited timeline
  duration: number;          // Total duration of edited timeline
  volume: number;            // 0.0 to 1.0
  playbackRate: number;      // 0.25 to 4.0
  isReady: boolean;          // Audio loaded and ready
  currentWordId: string | null; // Currently highlighted word ID
  currentClipId: string | null; // Currently playing clip
}

export interface TimelineState {
  clips: Clip[];
  activeClipIds: Set<string>;     // Clips that aren't deleted
  deletedWordIds: Set<string>;    // Individual deleted words
  reorderIndices: number[];       // Order to play clips (indices into clips array)
  totalDuration: number;          // Total duration of edited timeline
}

export interface UIState {
  mode: 'listen' | 'edit';
  selectedClipId: string | null;
  cursorPosition: TimelinePosition | null;
  selectedWordIds: Set<string>;
  isSelectingText: boolean;
}

export interface AudioAppState {
  playback: PlaybackState;
  timeline: TimelineState;
  ui: UIState;
  error: string | null;
  isInitialized: boolean;
}

// Action types for state updates
export type AudioAppAction =
  | { type: 'INITIALIZE_AUDIO'; payload: { audioUrl: string; clips: Clip[] } }
  | { type: 'UPDATE_PLAYBACK'; payload: Partial<PlaybackState> }
  | { type: 'UPDATE_CLIPS'; payload: Clip[] }
  | { type: 'REORDER_CLIPS'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'DELETE_CLIP'; payload: string } // clipId
  | { type: 'RESTORE_CLIP'; payload: string } // clipId
  | { type: 'DELETE_WORDS'; payload: string[] } // wordIds
  | { type: 'RESTORE_WORDS'; payload: string[] } // wordIds
  | { type: 'SPLIT_CLIP'; payload: { clipId: string; wordIndex: number } }
  | { type: 'UPDATE_WORD'; payload: { clipId: string; wordIndex: number; newText: string } }
  | { type: 'UPDATE_SPEAKER'; payload: { clipId: string; speaker: string } }
  | { type: 'SET_MODE'; payload: 'listen' | 'edit' }
  | { type: 'SET_CURSOR'; payload: TimelinePosition | null }
  | { type: 'SELECT_WORDS'; payload: string[] }
  | { type: 'SET_ERROR'; payload: string | null };

// Utility functions
export const createInitialState = (): AudioAppState => ({
  playback: {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    playbackRate: 1.0,
    isReady: false,
    currentWordId: null,
    currentClipId: null,
  },
  timeline: {
    clips: [],
    activeClipIds: new Set(),
    deletedWordIds: new Set(),
    reorderIndices: [],
    totalDuration: 0,
  },
  ui: {
    mode: 'listen',
    selectedClipId: null,
    cursorPosition: null,
    selectedWordIds: new Set(),
    isSelectingText: false,
  },
  error: null,
  isInitialized: false,
});

export const generateWordId = (clipId: string, wordIndex: number): string => {
  return `${clipId}-word-${wordIndex}`;
};

export const generateClipId = (baseId: string = 'clip'): string => {
  return `${baseId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};