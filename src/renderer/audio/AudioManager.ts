/**
 * AudioManager.ts - Unified audio management system
 * 
 * Combines timeline management with simple, reliable audio playback
 */

import { Clip, Word } from '../types';
import { SimpleClipSequencer } from './SimpleClipSequencer';
import { 
  AudioAppState, 
  AudioAppAction, 
  TimelinePosition, 
  createInitialState, 
  generateWordId 
} from './AudioAppState';

export interface AudioManagerCallbacks {
  onStateChange: (state: AudioAppState) => void;
  onError: (error: string) => void;
  onWordHighlight: (wordId: string | null) => void;
  onClipChange: (clipId: string | null) => void;
}

export class AudioManager {
  private state: AudioAppState;
  private sequencer: SimpleClipSequencer;
  private audioElement: HTMLAudioElement;
  private callbacks: AudioManagerCallbacks;
  private updateInterval: number | null = null;
  private audioUrl: string | null = null;
  private errorCount: number = 0;
  private maxErrors: number = 5;

  constructor(callbacks: AudioManagerCallbacks) {
    this.state = createInitialState();
    this.callbacks = callbacks;
    this.sequencer = new SimpleClipSequencer([]);
    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    this.setupAudioElement();
  }

  private setupAudioElement(): void {
    this.audioElement.addEventListener('loadeddata', () => {
      this.errorCount = 0; // Reset error count on successful load
      this.dispatch({ 
        type: 'UPDATE_PLAYBACK', 
        payload: { 
          isReady: true,
          duration: this.sequencer.getTotalEditedDuration()
        }
      });
    });

    this.audioElement.addEventListener('play', () => {
      this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { isPlaying: true } });
      this.startTimeUpdates();
    });

    this.audioElement.addEventListener('pause', () => {
      this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { isPlaying: false } });
      this.stopTimeUpdates();
    });

    this.audioElement.addEventListener('ended', () => {
      this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { isPlaying: false } });
      this.stopTimeUpdates();
    });

    this.audioElement.addEventListener('error', (e) => {
      // Don't report errors if we don't have a source yet
      if (!this.audioElement.src || this.audioElement.src === '') {
        console.log('Audio error ignored - no source set yet');
        return;
      }

      this.errorCount++;
      if (this.errorCount > this.maxErrors) {
        console.warn('Too many audio errors, suppressing further error callbacks');
        return;
      }
      
      const errorMsg = e.error?.message || e.message || 'Audio loading/playback failed';
      console.error('Audio element error:', e, 'Source:', this.audioElement.src);
      this.callbacks.onError(`Audio playback error: ${errorMsg}`);
    });
  }

  private startTimeUpdates(): void {
    if (this.updateInterval) return;

    this.updateInterval = window.setInterval(() => {
      this.updateCurrentTime();
    }, 20); // 50fps updates for smooth highlighting
  }

  private stopTimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private updateCurrentTime(): void {
    if (!this.audioElement || !this.state.playback.isReady) return;

    const originalTime = this.audioElement.currentTime;
    const editedTime = this.convertOriginalToEditedTime(originalTime);

    if (editedTime !== null) {
      // Update current time
      this.dispatch({
        type: 'UPDATE_PLAYBACK',
        payload: { currentTime: editedTime }
      });

      // Update highlighted word
      const position = this.getPositionAtEditedTime(editedTime);
      if (position) {
        const wordId = generateWordId(position.clipId, position.localWordIndex);
        
        if (wordId !== this.state.playback.currentWordId) {
          // Debug logging for word highlighting
          if (process.env.NODE_ENV === 'development') {
            console.log('[AudioManager] Word highlight:', {
              originalTime,
              editedTime,
              clipId: position.clipId,
              wordIndex: position.localWordIndex,
              wordId,
              previousWordId: this.state.playback.currentWordId
            });
          }
          
          this.dispatch({ 
            type: 'UPDATE_PLAYBACK', 
            payload: { 
              currentWordId: wordId,
              currentClipId: position.clipId
            }
          });
          this.callbacks.onWordHighlight(wordId);
        }
      }
    }
  }

  private convertOriginalToEditedTime(originalTime: number): number | null {
    // Use sequencer to find which clip this time belongs to
    const activeClips = this.getActiveClipsInOrder();
    
    for (const clip of activeClips) {
      if (originalTime >= clip.startTime && originalTime <= clip.endTime) {
        return this.sequencer.originalTimeToEditedTime(originalTime, clip.id);
      }
    }
    
    return null;
  }

  private convertEditedToOriginalTime(editedTime: number): { originalTime: number; clipId: string } | null {
    return this.sequencer.editedTimeToOriginalTime(editedTime);
  }

  private getPositionAtEditedTime(editedTime: number): TimelinePosition | null {
    const result = this.convertEditedToOriginalTime(editedTime);
    if (!result) return null;

    const clip = this.state.timeline.clips.find(c => c.id === result.clipId);
    if (!clip) return null;

    // Find the word at this time
    const relativeTime = result.originalTime - clip.startTime;
    let wordIndex = 0;
    
    for (const word of clip.words) {
      const wordRelativeStart = word.start - clip.startTime;
      const wordRelativeEnd = word.end - clip.startTime;
      
      if (relativeTime >= wordRelativeStart && relativeTime <= wordRelativeEnd) {
        break;
      }
      wordIndex++;
    }

    // Clamp word index to valid range
    wordIndex = Math.max(0, Math.min(wordIndex, clip.words.length - 1));

    // Debug logging for word position calculation
    if (process.env.NODE_ENV === 'development' && clip.words[wordIndex]) {
      const word = clip.words[wordIndex];
      console.log('[AudioManager] Word position calc:', {
        editedTime,
        originalTime: result.originalTime,
        clipId: result.clipId,
        relativeTime,
        wordIndex,
        word: word.word,
        wordStart: word.start,
        wordEnd: word.end,
        wordRelativeStart: word.start - clip.startTime,
        wordRelativeEnd: word.end - clip.startTime
      });
    }

    return {
      editedTime,
      originalTime: result.originalTime,
      clipId: result.clipId,
      wordIndex: clip.startWordIndex + wordIndex,
      localWordIndex: wordIndex,
    };
  }

  private getActiveClipsInOrder(): Clip[] {
    return this.state.timeline.reorderIndices
      .map(index => this.state.timeline.clips[index])
      .filter(clip => clip && this.state.timeline.activeClipIds.has(clip.id));
  }

  private calculateTotalDuration(): number {
    const activeClips = this.getActiveClipsInOrder();
    return activeClips.reduce((total, clip) => {
      // Subtract deleted words duration
      const deletedDuration = clip.words
        .filter(word => this.state.timeline.deletedWordIds.has(generateWordId(clip.id, clip.words.indexOf(word))))
        .reduce((sum, word) => sum + (word.end - word.start), 0);
      
      return total + (clip.duration - deletedDuration);
    }, 0);
  }

  private dispatch(action: AudioAppAction): void {
    const oldState = this.state;
    this.state = this.reduce(this.state, action);
    
    console.log('[AudioManager] State change:', {
      action: action.type,
      isInitialized: { old: oldState.isInitialized, new: this.state.isInitialized },
      isPlaying: { old: oldState.playback.isPlaying, new: this.state.playback.isPlaying }
    });
    
    // Special logging for clip updates
    if (action.type === 'UPDATE_CLIPS') {
      console.log('[AudioManager] UPDATE_CLIPS dispatched:', {
        oldClipCount: oldState.timeline.clips.length,
        newClipCount: this.state.timeline.clips.length,
        oldClipTypes: oldState.timeline.clips.map(c => c.type),
        newClipTypes: this.state.timeline.clips.map(c => c.type),
        oldActiveClips: Array.from(oldState.timeline.activeClipIds),
        newActiveClips: Array.from(this.state.timeline.activeClipIds),
        firstClipPreview: this.state.timeline.clips[0] ? {
          id: this.state.timeline.clips[0].id,
          type: this.state.timeline.clips[0].type,
          wordCount: this.state.timeline.clips[0].words?.length || 0,
          text: this.state.timeline.clips[0].text?.substring(0, 50) + (this.state.timeline.clips[0].text?.length > 50 ? '...' : '')
        } : null
      });
    }
    
    this.callbacks.onStateChange(this.state);
  }

  private reduce(state: AudioAppState, action: AudioAppAction): AudioAppState {
    switch (action.type) {
      case 'INITIALIZE_AUDIO': {
        const { audioUrl, clips } = action.payload;
        
        // Initialize sequencer with clips
        this.sequencer.updateClips(clips);
        
        // Create initial reorder indices (original order)
        const reorderIndices = clips.map((_, index) => index);
        const activeClipIds = new Set(clips.filter(c => c.status !== 'deleted').map(c => c.id));
        
        return {
          ...state,
          timeline: {
            ...state.timeline,
            clips,
            activeClipIds,
            reorderIndices,
            totalDuration: this.calculateTotalDuration(),
          },
          isInitialized: true,
          error: null,
        };
      }

      case 'UPDATE_PLAYBACK': {
        return {
          ...state,
          playback: { ...state.playback, ...action.payload },
        };
      }

      case 'UPDATE_CLIPS': {
        const clips = action.payload;
        this.sequencer.updateClips(clips);
        const activeClipIds = new Set(clips.filter(c => c.status !== 'deleted').map(c => c.id));
        // Recompute reorder indices based on clip.order
        console.log('[AudioManager] UPDATE_CLIPS: clip orders debug:');
        clips.slice(0, 10).forEach((c, i) => {
          console.log(`  [${i}] ${c.id.slice(0, 16)} order=${c.order}`);
        });
        
        // Create a mapping from original clip positions to their new order
        const sortedWithOriginalIndex = clips
          .map((c, originalIndex) => ({ originalIndex, order: c.order ?? originalIndex }))
          .sort((a, b) => a.order - b.order);
        
        console.log('[AudioManager] sortedWithOriginalIndex (first 10):');
        sortedWithOriginalIndex.slice(0, 10).forEach((item, i) => {
          console.log(`  newPos[${i}] = originalIndex[${item.originalIndex}] (order=${item.order})`);
        });
        
        // reorderIndices[newPosition] = originalIndex
        const sorted = sortedWithOriginalIndex.map(x => x.originalIndex);
        console.log('[AudioManager] computed reorderIndices (first 10):', sorted.slice(0, 10));
        
        return {
          ...state,
          timeline: {
            ...state.timeline,
            clips,
            activeClipIds,
            reorderIndices: sorted,
            totalDuration: this.calculateTotalDuration(),
          },
        };
      }

      case 'REORDER_CLIPS': {
        const { fromIndex, toIndex } = action.payload;
        const newIndices = [...state.timeline.reorderIndices];
        const [movedIndex] = newIndices.splice(fromIndex, 1);
        newIndices.splice(toIndex, 0, movedIndex);
        
        // Update sequencer with new order
        const reorderedClips = newIndices.map(i => state.timeline.clips[i]);
        this.sequencer.updateClips(reorderedClips);
        
        return {
          ...state,
          timeline: {
            ...state.timeline,
            reorderIndices: newIndices,
            totalDuration: this.calculateTotalDuration(),
          },
        };
      }

      case 'DELETE_CLIP': {
        const clipId = action.payload;
        const activeClipIds = new Set(state.timeline.activeClipIds);
        activeClipIds.delete(clipId);
        
        return {
          ...state,
          timeline: {
            ...state.timeline,
            activeClipIds,
            totalDuration: this.calculateTotalDuration(),
          },
        };
      }

      case 'RESTORE_CLIP': {
        const clipId = action.payload;
        const activeClipIds = new Set(state.timeline.activeClipIds);
        activeClipIds.add(clipId);
        
        return {
          ...state,
          timeline: {
            ...state.timeline,
            activeClipIds,
            totalDuration: this.calculateTotalDuration(),
          },
        };
      }

      case 'DELETE_WORDS': {
        const wordIds = action.payload;
        const deletedWordIds = new Set(state.timeline.deletedWordIds);
        wordIds.forEach(id => deletedWordIds.add(id));
        
        return {
          ...state,
          timeline: {
            ...state.timeline,
            deletedWordIds,
            totalDuration: this.calculateTotalDuration(),
          },
        };
      }

      case 'RESTORE_WORDS': {
        const wordIds = action.payload;
        const deletedWordIds = new Set(state.timeline.deletedWordIds);
        wordIds.forEach(id => deletedWordIds.delete(id));
        
        return {
          ...state,
          timeline: {
            ...state.timeline,
            deletedWordIds,
            totalDuration: this.calculateTotalDuration(),
          },
        };
      }

      case 'SET_MODE': {
        return {
          ...state,
          ui: { ...state.ui, mode: action.payload },
        };
      }

      case 'SET_CURSOR': {
        return {
          ...state,
          ui: { ...state.ui, cursorPosition: action.payload },
        };
      }

      case 'SELECT_WORDS': {
        const wordIds = action.payload;
        return {
          ...state,
          ui: { 
            ...state.ui, 
            selectedWordIds: new Set(wordIds),
          },
        };
      }

      case 'SET_ERROR': {
        return {
          ...state,
          error: action.payload,
        };
      }

      default:
        return state;
    }
  }

  // Public API
  async initialize(audioUrl: string, clips: Clip[]): Promise<void> {
    const attempt = (n: number) => new Promise<void>((resolve, reject) => {
      try {
        this.audioUrl = audioUrl;
        const src = audioUrl.startsWith('http') || audioUrl.startsWith('blob:') || audioUrl.startsWith('file://')
          ? audioUrl
          : `file://${audioUrl}`;
        console.log(`[AudioManager] [attempt ${n}] set src:`, src);
        this.audioElement.src = src;
        try { this.audioElement.load(); } catch {}

        const onLoad = () => { cleanup(); resolve(); };
        const onError = (e: any) => { console.error(`[AudioManager] [attempt ${n}] error`, e); cleanup(); reject(e); };
        const onTimeout = () => { console.error(`[AudioManager] [attempt ${n}] timeout`); cleanup(); reject(new Error('timeout')); };
        const cleanup = () => {
          this.audioElement.removeEventListener('loadeddata', onLoad);
          this.audioElement.removeEventListener('error', onError);
          clearTimeout(tid);
        };
        const tid = setTimeout(onTimeout, 20000);
        this.audioElement.addEventListener('loadeddata', onLoad);
        this.audioElement.addEventListener('error', onError);
      } catch (e) {
        reject(e);
      }
    });

    try {
      await attempt(1);
    } catch (e) {
      console.warn('[AudioManager] initial load failed, retrying...');
      await new Promise(r => setTimeout(r, 500));
      await attempt(2);
    }

    this.dispatch({ type: 'INITIALIZE_AUDIO', payload: { audioUrl, clips } });
  }

  async play(): Promise<void> {
    console.log('[AudioManager] play() called');
    console.log('[AudioManager] isReady:', this.state.playback.isReady);
    console.log('[AudioManager] audioElement src:', this.audioElement.src);
    console.log('[AudioManager] audioElement readyState:', this.audioElement.readyState);
    
    if (!this.state.playback.isReady) {
      console.error('[AudioManager] Audio not ready, throwing error');
      throw new Error('Audio not ready');
    }
    
    try {
      console.log('[AudioManager] Calling audioElement.play()...');
      await this.audioElement.play();
      console.log('[AudioManager] audioElement.play() completed successfully');
    } catch (error) {
      console.error('[AudioManager] Failed to play audio:', error);
      this.callbacks.onError(`Failed to play audio: ${error}`);
      throw error;
    }
  }

  pause(): void {
    console.log('[AudioManager] pause() called');
    console.log('[AudioManager] audioElement.paused:', this.audioElement.paused);
    this.audioElement.pause();
    console.log('[AudioManager] audioElement.pause() completed');
  }

  async togglePlayPause(): Promise<void> {
    console.log('[AudioManager] togglePlayPause() called');
    console.log('[AudioManager] Current isPlaying state:', this.state.playback.isPlaying);
    
    if (this.state.playback.isPlaying) {
      console.log('[AudioManager] Currently playing, calling pause()');
      this.pause();
    } else {
      console.log('[AudioManager] Currently paused, calling play()');
      await this.play();
    }
    console.log('[AudioManager] togglePlayPause() completed');
  }

  seekToEditedTime(editedTime: number): void {
    if (!this.state.playback.isReady) return;

    // Clamp to valid range
    editedTime = Math.max(0, Math.min(editedTime, this.state.playback.duration));

    const result = this.convertEditedToOriginalTime(editedTime);
    if (result) {
      this.audioElement.currentTime = result.originalTime;
      this.dispatch({ 
        type: 'UPDATE_PLAYBACK', 
        payload: { currentTime: editedTime }
      });
    }
  }

  seekToWord(clipId: string, wordIndex: number): void {
    const clip = this.state.timeline.clips.find(c => c.id === clipId);
    if (!clip || wordIndex < 0 || wordIndex >= clip.words.length) return;

    const word = clip.words[wordIndex];
    console.log(`[AudioManager] seekToWord: clip=${clipId}, wordIndex=${wordIndex}, originalTime=${word.start}`);
    const editedTime = this.sequencer.originalTimeToEditedTime(word.start, clipId);
    console.log('[AudioManager] computed editedTime=', editedTime);
    if (editedTime !== null) {
      this.seekToEditedTime(editedTime);
    }
  }

  // New: seek using original time domain, mapping to edited timeline
  seekToOriginalTime(originalSec: number): void {
    if (!this.state.playback.isReady) return;
    const editedTime = this.convertOriginalToEditedTime(originalSec);
    if (editedTime !== null) {
      this.seekToEditedTime(editedTime);
    }
  }

  setVolume(volume: number): void {
    volume = Math.max(0, Math.min(1, volume));
    this.audioElement.volume = volume;
    this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { volume } });
  }

  setPlaybackRate(rate: number): void {
    rate = Math.max(0.25, Math.min(4.0, rate));
    this.audioElement.playbackRate = rate;
    this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { playbackRate: rate } });
  }

  // Editing operations
  updateClips(clips: Clip[]): void {
    this.dispatch({ type: 'UPDATE_CLIPS', payload: clips });
  }

  reorderClips(fromIndex: number, toIndex: number): void {
    this.dispatch({ type: 'REORDER_CLIPS', payload: { fromIndex, toIndex } });
  }

  deleteClip(clipId: string): void {
    this.dispatch({ type: 'DELETE_CLIP', payload: clipId });
  }

  restoreClip(clipId: string): void {
    this.dispatch({ type: 'RESTORE_CLIP', payload: clipId });
  }

  deleteWords(wordIds: string[]): void {
    this.dispatch({ type: 'DELETE_WORDS', payload: wordIds });
  }

  restoreWords(wordIds: string[]): void {
    this.dispatch({ type: 'RESTORE_WORDS', payload: wordIds });
  }

  setMode(mode: 'listen' | 'edit'): void {
    this.dispatch({ type: 'SET_MODE', payload: mode });
  }

  setCursor(position: TimelinePosition | null): void {
    this.dispatch({ type: 'SET_CURSOR', payload: position });
  }

  selectWords(wordIds: string[]): void {
    this.dispatch({ type: 'SELECT_WORDS', payload: wordIds });
  }

  getState(): AudioAppState {
    return this.state;
  }

  destroy(): void {
    this.stopTimeUpdates();
    this.audioElement.pause();
    this.audioElement.src = '';
  }
}
