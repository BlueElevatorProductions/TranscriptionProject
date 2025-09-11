import { Clip } from '../types';
import { SimpleClipSequencer } from './SimpleClipSequencer';
import {
  AudioAppAction,
  AudioAppState,
  TimelinePosition,
  createInitialState,
  generateWordId,
} from './AudioAppState';
import type { EdlClip, JuceEvent } from '../../shared/types/transport';

export interface AudioManagerCallbacks {
  onStateChange: (state: AudioAppState) => void;
  onError: (error: string) => void;
  onWordHighlight: (wordId: string | null) => void;
  onClipChange: (clipId: string | null) => void;
}

export class JuceAudioManager {
  private state: AudioAppState;
  private sequencer: SimpleClipSequencer;
  private callbacks: AudioManagerCallbacks;
  private transport = (window as any).juceTransport as undefined | {
    load: (id: string, path: string) => Promise<{ success: boolean; error?: string }>;
    updateEdl: (id: string, clips: EdlClip[]) => Promise<{ success: boolean; error?: string }>;
    play: (id: string) => Promise<{ success: boolean; error?: string }>;
    pause: (id: string) => Promise<{ success: boolean; error?: string }>;
    stop: (id: string) => Promise<{ success: boolean; error?: string }>;
    seek: (id: string, timeSec: number) => Promise<{ success: boolean; error?: string }>;
    setRate: (id: string, rate: number) => Promise<{ success: boolean; error?: string }>;
    setVolume: (id: string, value: number) => Promise<{ success: boolean; error?: string }>;
    queryState: (id: string) => Promise<{ success: boolean; error?: string }>;
    onEvent: (cb: (evt: JuceEvent) => void) => void;
    offEvent: (cb: (evt: JuceEvent) => void) => void;
  };
  private eventHandler?: (evt: JuceEvent) => void;
  private sessionId: string = 'default';
  private audioPath: string | null = null;

  constructor(callbacks: AudioManagerCallbacks) {
    this.state = createInitialState();
    this.callbacks = callbacks;
    this.sequencer = new SimpleClipSequencer([]);
    if (!this.transport) {
      throw new Error('JUCE transport is not available in preload');
    }
  }

  // Public API mirroring AudioManager
  async initialize(audioUrl: string, clips: Clip[]): Promise<void> {
    // Derive absolute file path from media URL or file URL
    this.audioPath = this.resolveAudioPath(audioUrl);
    if (!this.audioPath) {
      throw new Error('Unable to resolve audio path for JUCE backend');
    }
    this.sessionId = this.sessionId || 'default';

    // Initialize sequencer and state first
    this.dispatch({ type: 'INITIALIZE_AUDIO', payload: { audioUrl, clips } });

    // Subscribe to transport events
    this.eventHandler = (evt) => this.onTransportEvent(evt);
    this.transport!.onEvent(this.eventHandler);

    // Load and send initial EDL
    const res = await this.transport!.load(this.sessionId, this.audioPath);
    if (!res.success) throw new Error(res.error || 'load failed');
    await this.pushEdl();
    // Ask for initial state
    await this.transport!.queryState(this.sessionId);
  }

  async play(): Promise<void> {
    const res = await this.transport!.play(this.sessionId);
    if (!res.success) this.callbacks.onError(res.error || 'play failed');
  }

  pause(): void {
    this.transport!.pause(this.sessionId).then((res) => {
      if (!res.success) this.callbacks.onError(res.error || 'pause failed');
    });
  }

  async togglePlayPause(): Promise<void> {
    if (this.state.playback.isPlaying) this.pause();
    else await this.play();
  }

  seekToEditedTime(editedTime: number): void {
    if (!this.state.playback.isReady) return;
    editedTime = Math.max(0, Math.min(editedTime, this.state.playback.duration));
    this.transport!.seek(this.sessionId, editedTime).then((res) => {
      if (!res.success) this.callbacks.onError(res.error || 'seek failed');
    });
  }

  seekToWord(clipId: string, wordIndex: number): void {
    const clip = this.state.timeline.clips.find((c) => c.id === clipId);
    if (!clip || wordIndex < 0 || wordIndex >= clip.words.length) return;
    const word = clip.words[wordIndex];
    const editedTime = this.sequencer.originalTimeToEditedTime(word.start, clipId);
    if (editedTime != null) this.seekToEditedTime(editedTime);
  }

  setVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.transport!.setVolume(this.sessionId, v).then(() => {
      this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { volume: v } });
    });
  }

  setPlaybackRate(rate: number): void {
    const r = Math.max(0.25, Math.min(4.0, rate));
    this.transport!.setRate(this.sessionId, r).then(() => {
      this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { playbackRate: r } });
    });
  }

  updateClips(clips: Clip[]): void {
    this.dispatch({ type: 'UPDATE_CLIPS', payload: clips });
    this.pushEdl().catch((e) => this.callbacks.onError(String(e)));
  }

  reorderClips(fromIndex: number, toIndex: number): void {
    this.dispatch({ type: 'REORDER_CLIPS', payload: { fromIndex, toIndex } });
    this.pushEdl().catch((e) => this.callbacks.onError(String(e)));
  }

  deleteClip(clipId: string): void {
    this.dispatch({ type: 'DELETE_CLIP', payload: clipId });
    this.pushEdl().catch((e) => this.callbacks.onError(String(e)));
  }

  restoreClip(clipId: string): void {
    this.dispatch({ type: 'RESTORE_CLIP', payload: clipId });
    this.pushEdl().catch((e) => this.callbacks.onError(String(e)));
  }

  deleteWords(wordIds: string[]): void {
    this.dispatch({ type: 'DELETE_WORDS', payload: wordIds });
    this.pushEdl().catch((e) => this.callbacks.onError(String(e)));
  }

  restoreWords(wordIds: string[]): void {
    this.dispatch({ type: 'RESTORE_WORDS', payload: wordIds });
    this.pushEdl().catch((e) => this.callbacks.onError(String(e)));
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
    if (this.eventHandler) {
      this.transport?.offEvent(this.eventHandler);
    }
  }

  // Internal helpers
  private dispatch(action: AudioAppAction): void {
    const oldState = this.state;
    // Update sequencer on relevant actions (reuse AudioManager reduce logic by calling same reduce)
    this.state = this.reduce(this.state, action);
    this.callbacks.onStateChange(this.state);
  }

  private reduce(state: AudioAppState, action: AudioAppAction): AudioAppState {
    switch (action.type) {
      case 'INITIALIZE_AUDIO': {
        const { clips } = action.payload;
        this.sequencer.updateClips(clips);
        const reorderIndices = clips.map((_, i) => i);
        const activeClipIds = new Set(clips.filter((c) => c.status !== 'deleted').map((c) => c.id));
        return {
          ...state,
          timeline: {
            ...state.timeline,
            clips,
            activeClipIds,
            reorderIndices,
            totalDuration: this.calculateTotalDuration(clips, state.timeline.deletedWordIds),
          },
          isInitialized: true,
          error: null,
        };
      }
      case 'UPDATE_PLAYBACK': {
        return { ...state, playback: { ...state.playback, ...action.payload } };
      }
      case 'UPDATE_CLIPS': {
        const clips = action.payload;
        this.sequencer.updateClips(clips);
        const activeClipIds = new Set(clips.filter((c) => c.status !== 'deleted').map((c) => c.id));
        // Recompute reorder indices based on clip.order
        const sorted = clips
          .map((c, i) => ({ i, order: c.order ?? i }))
          .sort((a, b) => a.order - b.order)
          .map(x => x.i);
        return {
          ...state,
          timeline: {
            ...state.timeline,
            clips,
            activeClipIds,
            reorderIndices: sorted,
            totalDuration: this.calculateTotalDuration(clips, state.timeline.deletedWordIds),
          },
        };
      }
      case 'REORDER_CLIPS': {
        const { fromIndex, toIndex } = action.payload;
        const newIndices = [...state.timeline.reorderIndices];
        const [movedIndex] = newIndices.splice(fromIndex, 1);
        newIndices.splice(toIndex, 0, movedIndex);
        const reorderedClips = newIndices.map((i) => state.timeline.clips[i]);
        this.sequencer.updateClips(reorderedClips);
        return {
          ...state,
          timeline: { ...state.timeline, reorderIndices: newIndices, totalDuration: this.calculateTotalDuration(state.timeline.clips, state.timeline.deletedWordIds) },
        };
      }
      case 'DELETE_CLIP': {
        const activeClipIds = new Set(state.timeline.activeClipIds);
        activeClipIds.delete(action.payload);
        return { ...state, timeline: { ...state.timeline, activeClipIds, totalDuration: this.calculateTotalDuration(state.timeline.clips, state.timeline.deletedWordIds) } };
      }
      case 'RESTORE_CLIP': {
        const activeClipIds = new Set(state.timeline.activeClipIds);
        activeClipIds.add(action.payload);
        return { ...state, timeline: { ...state.timeline, activeClipIds, totalDuration: this.calculateTotalDuration(state.timeline.clips, state.timeline.deletedWordIds) } };
      }
      case 'DELETE_WORDS': {
        const wordIds = action.payload;
        const deleted = new Set(state.timeline.deletedWordIds);
        wordIds.forEach((id) => deleted.add(id));
        return { ...state, timeline: { ...state.timeline, deletedWordIds: deleted, totalDuration: this.calculateTotalDuration(state.timeline.clips, deleted) } };
      }
      case 'RESTORE_WORDS': {
        const wordIds = action.payload;
        const deleted = new Set(state.timeline.deletedWordIds);
        wordIds.forEach((id) => deleted.delete(id));
        return { ...state, timeline: { ...state.timeline, deletedWordIds: deleted, totalDuration: this.calculateTotalDuration(state.timeline.clips, deleted) } };
      }
      case 'SET_MODE': {
        return { ...state, ui: { ...state.ui, mode: action.payload } };
      }
      case 'SET_CURSOR': {
        return { ...state, ui: { ...state.ui, cursorPosition: action.payload } };
      }
      case 'SELECT_WORDS': {
        return { ...state, ui: { ...state.ui, selectedWordIds: new Set(action.payload) } };
      }
      case 'ERROR': {
        return { ...state, error: action.payload };
      }
      default:
        return state;
    }
  }

  private calculateTotalDuration(clips: Clip[], deletedWordIds: Set<string>): number {
    const activeClips = clips.filter((c) => c && c.status !== 'deleted');
    return activeClips.reduce((total, clip) => {
      const deletedDuration = clip.words
        .filter((w, i) => deletedWordIds.has(generateWordId(clip.id, i)))
        .reduce((sum, w) => sum + (w.end - w.start), 0);
      return total + (clip.duration - deletedDuration);
    }, 0);
  }

  private onTransportEvent(evt: JuceEvent) {
    if (evt.type === 'error') {
      this.callbacks.onError(evt.message);
      return;
    }
    switch (evt.type) {
      case 'loaded':
        this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { isReady: true, duration: this.sequencer.getTotalEditedDuration() } });
        break;
      case 'state':
        this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { isPlaying: evt.playing } });
        break;
      case 'position': {
        const editedTime = evt.editedSec;
        const originalSec = evt.originalSec;
        const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
        
        if (AUDIO_DEBUG) {
          (this as any)._lastTimeLog = (this as any)._lastTimeLog || 0;
          const now = Date.now();
          if (now - (this as any)._lastTimeLog > 1000) {
            (this as any)._lastTimeLog = now;
            console.log('[JuceAudio] Time update:', {
              editedTime: editedTime.toFixed(3),
              originalSec: originalSec.toFixed(3),
              isPlaying: this.state.playback.isPlaying
            });
          }
        }
        
        this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { currentTime: editedTime, currentOriginalTime: originalSec } });
        const pos = this.getPositionAtOriginalTime(originalSec);
        if (pos) {
          const wordId = generateWordId(pos.clipId, pos.localWordIndex);
          if (wordId !== this.state.playback.currentWordId) {
            this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { currentWordId: wordId, currentClipId: pos.clipId } });
            this.callbacks.onWordHighlight(wordId);
            if (AUDIO_DEBUG) {
              // Debug mapping info for Listen Mode
              console.log('[JUCE DEBUG] position evt', {
                editedSec: evt.editedSec,
                originalSec: evt.originalSec,
                mappedClipId: pos.clipId,
                localWordIndex: pos.localWordIndex,
                wordId,
              });
            }
          }
        }
        break;
      }
      case 'ended':
        this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { isPlaying: false } });
        break;
    }
  }

  // New: seek using original time domain
  seekToOriginalTime(originalSec: number): void {
    // Map original -> edited manually across reordered clips
    const clips = this.state.timeline.clips
      .filter(c => c.status !== 'deleted')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    let acc = 0;
    for (const c of clips) {
      if (originalSec >= c.startTime && originalSec <= c.endTime) {
        const edited = acc + (originalSec - c.startTime);
        this.seekToEditedTime(edited);
        return;
      }
      acc += c.duration;
    }
  }

  private getPositionAtEditedTime(editedTime: number): TimelinePosition | null {
    const result = this.sequencer.editedTimeToOriginalTime(editedTime);
    if (!result) return null;
    const clip = this.state.timeline.clips.find((c) => c.id === result.clipId);
    if (!clip) return null;
    const relativeTime = result.originalTime - clip.startTime;
    let wordIndex = 0;
    for (const word of clip.words) {
      const s = word.start - clip.startTime;
      const e = word.end - clip.startTime;
      if (relativeTime >= s && relativeTime <= e) break;
      wordIndex++;
    }
    wordIndex = Math.max(0, Math.min(wordIndex, clip.words.length - 1));
    return { editedTime, originalTime: result.originalTime, clipId: result.clipId, wordIndex: clip.startWordIndex + wordIndex, localWordIndex: wordIndex };
  }

  private getPositionAtOriginalTime(originalTime: number): TimelinePosition | null {
    // Find the speech clip containing this original time (ignore audio-only gaps)
    const clips = this.state.timeline.clips
      .filter((c) => c.status !== 'deleted' && c.type !== 'audio-only')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const clip = clips.find((c) => originalTime >= c.startTime && originalTime <= c.endTime);
    if (!clip || (clip.words || []).length === 0) return null;
    const relativeTime = originalTime - clip.startTime;
    let idx = 0;
    for (const w of clip.words) {
      if (relativeTime >= (w.start - clip.startTime) && relativeTime <= (w.end - clip.startTime)) break;
      idx++;
    }
    idx = Math.max(0, Math.min(idx, clip.words.length - 1));
    return {
      editedTime: 0, // not needed for highlight
      originalTime,
      clipId: clip.id,
      wordIndex: clip.startWordIndex + idx,
      localWordIndex: idx,
    };
  }

  private async pushEdl(): Promise<void> {
    // Build EDL from current state
    const { clips, reorderIndices, activeClipIds, deletedWordIds } = this.state.timeline;
    const ordered = reorderIndices
      .map((i) => clips[i])
      .filter((c) => c && activeClipIds.has(c.id) && c.type !== 'initial');
    const gapCount = ordered.filter((c: any) => c?.type === 'audio-only').length;
    const edl: EdlClip[] = ordered.map((c, idx) => ({
      id: c.id,
      startSec: c.startTime,
      endSec: c.endTime,
      order: idx,
      deleted: c.words
        .map((_, i) => (deletedWordIds.has(generateWordId(c.id, i)) ? i : -1))
        .filter((i) => i >= 0),
    }));
    if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
      console.log(`[EDL] Pushing segments: total=${edl.length}, gaps=${gapCount}`);
      console.log('[EDL] Segment details:', edl.map(c => ({
        id: c.id,
        type: ordered.find(clip => clip.id === c.id)?.type || 'unknown',
        range: `${c.startSec.toFixed(2)}-${c.endSec.toFixed(2)}s`,
        duration: (c.endSec - c.startSec).toFixed(2) + 's'
      })));
    }
    const res = await this.transport!.updateEdl(this.sessionId, edl);
    if (!res.success) throw new Error(res.error || 'updateEdl failed');
  }

  private resolveAudioPath(audioUrl: string): string | null {
    try {
      if (audioUrl.startsWith('http')) {
        const u = new URL(audioUrl);
        if (u.pathname === '/media') {
          const src = u.searchParams.get('src');
          if (src) return decodeURIComponent(src);
        }
        return null; // Unknown pattern
      }
      if (audioUrl.startsWith('file://')) {
        const u = new URL(audioUrl);
        return decodeURIComponent(u.pathname);
      }
      if (audioUrl.startsWith('/')) return audioUrl; // absolute path
      return null;
    } catch {
      return null;
    }
  }
}

export default JuceAudioManager;
