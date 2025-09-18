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
  edlApplying?: boolean;        // JUCE EDL is updating; defer seeks/sync
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
    edlApplying: false,
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

/**
 * Generate audio-only gap clips to ensure continuous playback
 * Creates gaps for intro, between clips, and outro sections
 */
export const generateGapClips = (speechClips: Clip[], audioDuration: number): Clip[] => {
  const gaps: Clip[] = [];
  const eps = 0.0005; // Small epsilon to avoid tiny gaps
  
  console.log('generateGapClips called:', { speechClipCount: speechClips.length, audioDuration });
  
  // Sort speech clips by start time
  const sorted = speechClips
    .filter(c => c.type !== 'audio-only') // Only process speech clips
    .slice()
    .sort((a, b) => a.startTime - b.startTime);
  
  let cursor = 0;
  let order = 0;
  
  // Create gaps between speech clips
  for (const speechClip of sorted) {
    // Gap before this speech clip
    if (speechClip.startTime - cursor > eps) {
      gaps.push({
        id: generateClipId('gap'),
        speaker: '',
        startTime: cursor,
        endTime: speechClip.startTime,
        startWordIndex: 0,
        endWordIndex: -1,
        words: [],
        text: '',
        confidence: 1.0,
        type: 'audio-only' as const,
        duration: speechClip.startTime - cursor,
        order: order++,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        status: 'active' as const,
      });
    }
    cursor = Math.max(cursor, speechClip.endTime);
  }
  
  // Gap after the last speech clip (outro)
  if (audioDuration > cursor + eps) {
    gaps.push({
      id: generateClipId('gap'),
      speaker: '',
      startTime: cursor,
      endTime: audioDuration,
      startWordIndex: 0,
      endWordIndex: -1,
      words: [],
      text: '',
      confidence: 1.0,
      type: 'audio-only' as const,
      duration: audioDuration - cursor,
      order: order++,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      status: 'active' as const,
    });
  }
  
  console.log('generateGapClips result:', { gapCount: gaps.length, gaps: gaps.map(g => `${g.startTime.toFixed(2)}-${g.endTime.toFixed(2)}`) });
  return gaps;
};

/**
 * Merge speech and gap clips, ensuring continuous timeline coverage
 */
export const createContinuousClips = (speechClips: Clip[], audioDuration: number): Clip[] => {
  const gaps = generateGapClips(speechClips, audioDuration);
  
  // Merge and sort by start time, then assign sequential order
  const merged = [...speechClips.filter(c => c.type !== 'audio-only'), ...gaps]
    .sort((a, b) => a.startTime - b.startTime)
    .map((clip, index) => ({ ...clip, order: index }));
  
  return merged;
};
