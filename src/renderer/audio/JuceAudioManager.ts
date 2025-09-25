import { Clip } from '../types';
import { SimpleClipSequencer } from './SimpleClipSequencer';
import {
  AudioAppAction,
  AudioAppState,
  TimelinePosition,
  createInitialState,
} from './AudioAppState';
import type { EdlClip, JuceEvent } from '../../shared/types/transport';

export interface AudioManagerCallbacks {
  onStateChange: (state: AudioAppState) => void;
  onError: (error: string) => void;
  onWordHighlight: (wordId: string | null) => void;
  onClipChange: (clipId: string | null) => void;
}

export interface JuceAudioManagerOptions {
  callbacks: AudioManagerCallbacks;
  projectDirectory?: string;
}

export class JuceAudioManager {
  private state: AudioAppState;
  private sequencer: SimpleClipSequencer;
  private callbacks: AudioManagerCallbacks;
  private projectDirectory?: string;
  private transport = (window as any).juceTransport as undefined | {
    load: (id: string, path: string) => Promise<{ success: boolean; error?: string }>;
    updateEdl: (id: string, clips: EdlClip[]) => Promise<{ success: boolean; error?: string }>;
    play: (id: string) => Promise<{ success: boolean; error?: string }>;
    pause: (id: string) => Promise<{ success: boolean; error?: string }>;
    stop: (id: string) => Promise<{ success: boolean; error?: string }>;
    seek: (id: string, timeSec: number) => Promise<{ success: boolean; error?: string }>;
    setRate: (id: string, rate: number) => Promise<{ success: boolean; error?: string }>;
    setTimeStretch: (id: string, ratio: number) => Promise<{ success: boolean; error?: string }>;
    setVolume: (id: string, value: number) => Promise<{ success: boolean; error?: string }>;
    queryState: (id: string) => Promise<{ success: boolean; error?: string }>;
    onEvent: (cb: (evt: JuceEvent) => void) => void;
    offEvent: (cb: (evt: JuceEvent) => void) => void;
  };
  private eventHandler?: (evt: JuceEvent) => void;
  private sessionId: string = 'default';
  private audioPath: string | null = null;
  // If JUCE does not emit dual-timeline positions during reorders, prefer seeking in original time
  private preferOriginalSeek: boolean = false;
  private lastCorrectiveSeekAt: number = 0;
  private edlApplying: boolean = false;
  private pendingSeekEdited: number | null = null;
  private pendingSeekOriginal: number | null = null;
  private lastAppliedRevision: number = 0;
  private edlApplyFallbackTid: number | null = null;
  private lastAcceptedEditedTime: number = 0;
  private lastEdlAppliedAt: number = 0;
  // Seek-intent latch to survive EDL changes and late events
  private lastSeekIntent: (
    | { kind: 'word'; clipId: string; wordIndex: number; createdAt: number; attempts: number }
    | { kind: 'edited'; editedTime: number; createdAt: number; attempts: number }
  ) | null = null;
  private readonly seekIntentFreshMs = 600; // consider intents fresh for this window
  private readonly seekEpsilonSec = 0.08;   // acceptable difference to consider seek complete
  private readonly maxSeekReissues = 2;     // maximum reseek attempts

  constructor(options: JuceAudioManagerOptions | AudioManagerCallbacks) {
    this.state = createInitialState();

    // Handle both old callback-only and new options-based constructors
    if ('callbacks' in options) {
      this.callbacks = options.callbacks;
      this.projectDirectory = options.projectDirectory;
    } else {
      // Backward compatibility: treat as callbacks directly
      this.callbacks = options;
      this.projectDirectory = undefined;
    }

    this.sequencer = new SimpleClipSequencer([]);
    if (!this.transport) {
      throw new Error('JUCE transport is not available in preload');
    }
  }


  // Public API mirroring AudioManager
  async initialize(audioUrl: string, clips: Clip[]): Promise<void> {
    console.log('[JuceAudioManager] Initialize called');
    console.log('[JuceAudioManager] Transport available:', !!this.transport);
    
    // Derive absolute file path from media URL or file URL
    this.audioPath = this.resolveAudioPath(audioUrl);
    console.log('[JuceAudioManager] Audio path resolution:', {
      input: audioUrl,
      resolved: this.audioPath,
      inputType: typeof audioUrl
    });
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
    console.log('[JuceAudioManager] Calling transport.load with:', {
      sessionId: this.sessionId,
      audioPath: this.audioPath
    });
    
    try {
      const res = await this.transport!.load(this.sessionId, this.audioPath);
      console.log('[JuceAudioManager] Transport load result:', res);
      if (!res.success) throw new Error(res.error || 'load failed');
    } catch (error) {
      console.error('[JuceAudioManager] Transport load error:', error);
      throw error;
    }
    await this.pushEdl();
    // Reset fallback detection on fresh init
    this.preferOriginalSeek = false;
    // Ask for initial state
    await this.transport!.queryState(this.sessionId);
  }

  async play(): Promise<void> {
    const res = await this.transport!.play(this.sessionId);
    if (!res.success) {
      this.callbacks.onError(res.error || 'play failed');
    }
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

  async seekToEditedTime(editedTime: number, setIntent: boolean = true): Promise<void> {
    if (!this.state.playback.isReady) return;
    // Guard against stale/zero playback.duration by falling back to sequencer's total edited duration
    const fallbackMax = this.sequencer.getTotalEditedDuration();
    const maxDur = (Number.isFinite(this.state.playback.duration) && this.state.playback.duration > 0)
      ? this.state.playback.duration
      : fallbackMax;
    const clamped = Math.max(0, Math.min(editedTime, maxDur));
    if (setIntent) {
      this.lastSeekIntent = { kind: 'edited', editedTime: clamped, createdAt: Date.now(), attempts: 0 };
    }
    if (this.edlApplying) {
      if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
        console.log('[JuceAudioManager] Deferring seekToEditedTime due to EDL applying:', { editedTime: clamped });
      }
      this.pendingSeekEdited = clamped;
      return;
    }
    const wasPlaying = this.state.playback.isPlaying;
    try {
      if (wasPlaying) {
        const pr = await this.transport!.pause(this.sessionId);
        if (!pr.success) this.callbacks.onError(pr.error || 'pause failed before seek');
      }
      const targetSec = clamped;
      const sr = await this.transport!.seek(this.sessionId, targetSec);
      if (!sr.success) {
        this.callbacks.onError(sr.error || 'seek failed');
        return;
      }
      if (wasPlaying) {
        const pl = await this.transport!.play(this.sessionId);
        if (!pl.success) this.callbacks.onError(pl.error || 'resume failed after seek');
      }
    } catch (e) {
      this.callbacks.onError(String(e));
    }
  }

  // Seek using original time domain; map to edited after EDL is applied
  seekToOriginalTime(originalSec: number): void {
    if (!this.state.playback.isReady) return;
    if (this.edlApplying) {
      this.pendingSeekOriginal = Math.max(0, originalSec);
      return;
    }

    const ordered = this.sequencer.getReorderedClips();
    if (!ordered.length) return;

    const EPS = 0.02; // tolerate tiny boundary biases
    let targetClip: Clip | null = null;

    for (const clip of ordered) {
      const within = originalSec >= clip.startTime && originalSec <= clip.endTime;
      const nearStart = originalSec >= clip.startTime - EPS && originalSec < clip.startTime + EPS;
      if (within || nearStart) {
        targetClip = clip;
        break;
      }
    }

    if (!targetClip) return;

    const normalizedOriginal = Math.min(
      targetClip.endTime,
      Math.max(targetClip.startTime, originalSec)
    );
    const edited = this.sequencer.originalTimeToEditedTime(normalizedOriginal, targetClip.id);
    if (edited == null) return;

    if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
      console.log(
        `[seekToOriginalTime] ORIGINAL ${normalizedOriginal.toFixed(3)}s (clip ${targetClip.id.slice(-8)}) → edited ${edited.toFixed(3)}s`
      );
    }

    this.seekToEditedTime(edited);
  }

  seekToWord(clipId: string, wordIndex: number): void {
    const clip = this.state.timeline.clips.find((c) => c.id === clipId);
    if (!clip || wordIndex < 0 || wordIndex >= clip.words.length) return;
    const word = clip.words[wordIndex];
    // Record intent first (word identity survives EDL changes)
    this.lastSeekIntent = { kind: 'word', clipId, wordIndex, createdAt: Date.now(), attempts: 0 };
    const editedTime = this.sequencer.originalTimeToEditedTime(word.start, clipId);
    if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
      console.log('[JuceAudioManager] seekToWord:', {
        clipId,
        wordIndex,
        wordStartOriginal: word.start,
        editedTime,
      });
    }
    if (this.preferOriginalSeek) {
      // Seek directly via original time to avoid backend domain ambiguity
      this.seekToOriginalTime(word.start);
    } else if (editedTime != null) {
      this.seekToEditedTime(editedTime, /*setIntent*/ false);
    }
  }

  setVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.transport!.setVolume(this.sessionId, v).then(() => {
      this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { volume: v } });
    });
  }

  setPlaybackRate(rate: number): void {
    const r = Math.max(0.25, Math.min(4.0, rate));
    // Use time-stretching for pitch-preserving speed changes
    this.transport!.setTimeStretch(this.sessionId, r).then(() => {
      this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { playbackRate: r } });
    }).catch(() => {
      // Fallback to legacy setRate if time-stretching is not available
      this.transport!.setRate(this.sessionId, r).then(() => {
        this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { playbackRate: r } });
      });
    });
  }

  // Legacy method for backward compatibility (changes both speed and pitch)
  setPlaybackRateLegacy(rate: number): void {
    const r = Math.max(0.25, Math.min(4.0, rate));
    this.transport!.setRate(this.sessionId, r).then(() => {
      this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { playbackRate: r } });
    });
  }

  updateClips(clips: Clip[]): void {
    this.dispatch({ type: 'UPDATE_CLIPS', payload: clips });
    this.edlApplying = true;
    this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { edlApplying: true } as any });
    if (this.edlApplyFallbackTid) { clearTimeout(this.edlApplyFallbackTid); this.edlApplyFallbackTid = null; }
    // Cross-window sync: publish the ordered active clips that match EDL
    try {
      const state = this.state;
      const orderedActive = this.buildOrderedActiveClips(
        clips,
        state.timeline.reorderIndices,
        state.timeline.activeClipIds
      );
      (window as any).electronAPI?.clipsSet?.(orderedActive);
    } catch {}
    this.pushEdl().catch((e) => this.callbacks.onError(String(e)));
    // Fallback timer in case 'edlApplied' is not emitted
    this.edlApplyFallbackTid = window.setTimeout(() => {
      if (this.edlApplying) {
        if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
          console.warn('[JuceAudioManager] EDL apply still pending (updateClips); querying transport...');
        }
        // Nudge transport; do not clear edlApplying — we must wait for edlApplied
        this.transport?.queryState(this.sessionId).catch(() => {});
        // Re-arm another check if still pending later
        if (this.edlApplyFallbackTid) clearTimeout(this.edlApplyFallbackTid);
        this.edlApplyFallbackTid = window.setTimeout(() => {
          if (this.edlApplying) {
            if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
              console.warn('[JuceAudioManager] EDL apply still pending after re-query.');
            }
            this.transport?.queryState(this.sessionId).catch(() => {});
          }
        }, 3000);
      }
    }, 3000);
  }

  reorderClips(fromIndex: number, toIndex: number): void {
    this.dispatch({ type: 'REORDER_CLIPS', payload: { fromIndex, toIndex } });
    this.edlApplying = true;
    this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { edlApplying: true } as any });
    if (this.edlApplyFallbackTid) { clearTimeout(this.edlApplyFallbackTid); this.edlApplyFallbackTid = null; }
    this.pushEdl().catch((e) => this.callbacks.onError(String(e)));
    // Publish new ordering to other windows (ordered active set)
    try {
      const orderedActive = this.buildOrderedActiveClips(
        this.state.timeline.clips,
        this.state.timeline.reorderIndices,
        this.state.timeline.activeClipIds
      );
      (window as any).electronAPI?.clipsSet?.(orderedActive);
    } catch {}
    this.edlApplyFallbackTid = window.setTimeout(() => {
      if (this.edlApplying) {
        if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
          console.warn('[JuceAudioManager] EDL apply still pending (reorderClips); querying transport...');
        }
        this.transport?.queryState(this.sessionId).catch(() => {});
        if (this.edlApplyFallbackTid) clearTimeout(this.edlApplyFallbackTid);
        this.edlApplyFallbackTid = window.setTimeout(() => {
          if (this.edlApplying) {
            if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
              console.warn('[JuceAudioManager] EDL apply still pending after re-query.');
            }
            this.transport?.queryState(this.sessionId).catch(() => {});
          }
        }, 3000);
      }
    }, 3000);
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
        const reorderIndices = clips.map((_, i) => i);
        const activeClipIds = new Set(clips.filter((c) => c.status !== 'deleted').map((c) => c.id));
        // Sync sequencer to active, ordered, non-initial clips
        this.sequencer.updateClips(this.buildOrderedActiveClips(clips, reorderIndices, activeClipIds));
        return {
          ...state,
          timeline: {
            ...state.timeline,
            clips,
            activeClipIds,
            reorderIndices,
            totalDuration: this.calculateTotalDuration(clips, activeClipIds),
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
        const activeClipIds = new Set(clips.filter((c) => c.status !== 'deleted').map((c) => c.id));
        
        // The clips array from the UI is already in the correct order after drag-and-drop reordering.
        // We should always use sequential indices and trust the clips array order.
        // This fixes the issue where JUCE was ignoring reordered clips during playback.
        const reorderIndices = clips.map((_, i) => i);
        
        const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
        if (AUDIO_DEBUG) {
          console.log('[JuceAudioManager] UPDATE_CLIPS: received clips array');
          console.log('[JuceAudioManager] FULL CLIP IDs RECEIVED (first 10):');
          clips.slice(0, 10).forEach((c, i) => {
            console.log(`  RECEIVED[${i}]: ${c.id} order=${c.order}`);
          });
          console.log('[JuceAudioManager] reorderIndices:', reorderIndices.slice(0, 10));
        }
        // Keep sequencer aligned with playable timeline
        this.sequencer.updateClips(this.buildOrderedActiveClips(clips, reorderIndices, activeClipIds));
        return {
          ...state,
          timeline: {
            ...state.timeline,
            clips,
            activeClipIds,
            reorderIndices,
            totalDuration: this.calculateTotalDuration(clips, activeClipIds),
          },
        };
      }
      case 'REORDER_CLIPS': {
        const { fromIndex, toIndex } = action.payload;
        const newIndices = [...state.timeline.reorderIndices];
        const [movedIndex] = newIndices.splice(fromIndex, 1);
        newIndices.splice(toIndex, 0, movedIndex);

        // Update clip.order values to reflect the new playback order
        const newClips = state.timeline.clips.map((clip, originalIdx) => ({
          ...clip,
          order: newIndices.indexOf(originalIdx),
        }));

        // Update sequencer with active clips in the new order
        this.sequencer.updateClips(this.buildOrderedActiveClips(newClips, newIndices, state.timeline.activeClipIds));

        return {
          ...state,
          timeline: {
            ...state.timeline,
            clips: newClips,
            reorderIndices: newIndices,
            totalDuration: this.calculateTotalDuration(newClips, state.timeline.activeClipIds),
          },
        };
      }
      case 'DELETE_CLIP': {
        const activeClipIds = new Set(state.timeline.activeClipIds);
        activeClipIds.delete(action.payload);
        // Sync sequencer to new active set
        this.sequencer.updateClips(this.buildOrderedActiveClips(state.timeline.clips, state.timeline.reorderIndices, activeClipIds));
        return { ...state, timeline: { ...state.timeline, activeClipIds, totalDuration: this.calculateTotalDuration(state.timeline.clips, activeClipIds) } };
      }
      case 'RESTORE_CLIP': {
        const activeClipIds = new Set(state.timeline.activeClipIds);
        activeClipIds.add(action.payload);
        // Sync sequencer to new active set
        this.sequencer.updateClips(this.buildOrderedActiveClips(state.timeline.clips, state.timeline.reorderIndices, activeClipIds));
        return { ...state, timeline: { ...state.timeline, activeClipIds, totalDuration: this.calculateTotalDuration(state.timeline.clips, activeClipIds) } };
      }
      case 'DELETE_WORDS': {
        const wordIds = action.payload;
        const deleted = new Set(state.timeline.deletedWordIds);
        wordIds.forEach((id) => deleted.add(id));
        return { ...state, timeline: { ...state.timeline, deletedWordIds: deleted, totalDuration: this.calculateTotalDuration(state.timeline.clips, state.timeline.activeClipIds) } };
      }
      case 'RESTORE_WORDS': {
        const wordIds = action.payload;
        const deleted = new Set(state.timeline.deletedWordIds);
        wordIds.forEach((id) => deleted.delete(id));
        return { ...state, timeline: { ...state.timeline, deletedWordIds: deleted, totalDuration: this.calculateTotalDuration(state.timeline.clips, state.timeline.activeClipIds) } };
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

  private calculateTotalDuration(clips: Clip[], activeIds?: Set<string>): number {
    // Sum durations for all active clips (including audio-only), but exclude initial placeholder
    const ids = activeIds || this.state.timeline.activeClipIds;
    return clips.reduce((total, clip) => (
      clip && ids.has(clip.id) && clip.type !== 'initial' ? total + clip.duration : total
    ), 0);
  }

  private onTransportEvent(evt: JuceEvent) {
    const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
    
    if (AUDIO_DEBUG) {
      console.log('[JuceAudio] Event received:', evt.type);
    }
    
    if (evt.type === 'error') {
      this.callbacks.onError(evt.message);
      return;
    }
    
    switch (evt.type) {
      case 'loaded':
        // Duration equals sum of active clip durations (no compression for deleted words)
        this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { isReady: true, duration: this.calculateTotalDuration(this.state.timeline.clips, this.state.timeline.activeClipIds) } });
        break;
        
      case 'state':
        this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { isPlaying: evt.playing } });
        break;
      case 'edlApplied': {
        const rev = (evt as any).revision;
        if (typeof rev === 'number') {
          this.lastAppliedRevision = rev;
          if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
            console.log('[JuceAudio] EDL applied revision:', rev);
          }
        }
        // Clear EDL applying flag and flush any pending seek
        this.edlApplying = false;
        this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { edlApplying: false } as any });
        if (this.edlApplyFallbackTid) { clearTimeout(this.edlApplyFallbackTid); this.edlApplyFallbackTid = null; }
        this.lastEdlAppliedAt = Date.now();
        if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
          console.log('[JuceAudioManager] EDL applied; flushing pending seek if any.', {
            pendingSeekOriginal: this.pendingSeekOriginal,
            pendingSeekEdited: this.pendingSeekEdited,
          });
        }
        if (this.pendingSeekOriginal != null) {
          const orig = this.pendingSeekOriginal;
          this.pendingSeekOriginal = null;
          // Map using updated sequencer
          this.seekToOriginalTime(orig);
        } else if (this.pendingSeekEdited != null) {
          const t = this.pendingSeekEdited;
          this.pendingSeekEdited = null;
          // Perform the deferred seek now that EDL is applied
          this.seekToEditedTime(t, /*setIntent*/ false);
        } else if (this.isSeekIntentFresh()) {
          const target = this.computeEditedTargetFromIntent();
          if (target != null) {
            if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
              console.log('[JuceAudioManager] Re-applying fresh seek intent after EDL apply:', {
                intent: this.lastSeekIntent,
                target,
              });
            }
            this.seekToEditedTime(target, /*setIntent*/ false);
          }
        }
        break;
      }
        
      case 'position': {
        const rev = (evt as any).revision;
        if (typeof rev === 'number' && rev < this.lastAppliedRevision) break;
        const editedTime = evt.editedSec as number;
        if (!Number.isFinite(editedTime)) break;
        // Ignore positions while EDL is applying
        if (this.edlApplying) break;
        // Short cooldown after EDL apply to ignore stale, out-of-order events without revision
        const now = Date.now();
        const inCooldown = now - this.lastEdlAppliedAt < 150;

        // If we have a seek intent, prefer events near our target; ignore far-off ones
        let target: number | null = null;
        if (this.isSeekIntentFresh()) {
          target = this.computeEditedTargetFromIntent();
        }

        const farFromTarget = target != null && Math.abs(editedTime - target) > this.seekEpsilonSec && editedTime < (target - 0.2);
        const backwardsJump = editedTime < this.lastAcceptedEditedTime - 0.2;

        if (inCooldown && (farFromTarget || backwardsJump)) {
          // Do not dispatch regressions during cooldown; still drive reseek logic
          this.maybeCompleteOrReseek(editedTime);
          break;
        }

        if (farFromTarget) {
          // Outside cooldown but still way off target — drive reseek and skip UI update
          this.maybeCompleteOrReseek(editedTime);
          break;
        }

        // Accept and propagate
        this.lastAcceptedEditedTime = editedTime;
        this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { currentTime: editedTime } });
        // Validate/complete seek-intent if active
        this.maybeCompleteOrReseek(editedTime);
        break;
      }
      case 'ended':
        this.dispatch({ type: 'UPDATE_PLAYBACK', payload: { isPlaying: false } });
        break;
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

  // Seek-intent helpers
  private isSeekIntentFresh(): boolean {
    if (!this.lastSeekIntent) return false;
    return Date.now() - this.lastSeekIntent.createdAt <= this.seekIntentFreshMs;
  }

  private computeEditedTargetFromIntent(): number | null {
    if (!this.lastSeekIntent) return null;
    if (this.lastSeekIntent.kind === 'edited') {
      // Clamp using a reliable max duration; fall back to sequencer total if playback.duration is stale/zero
      const fallbackMax = this.sequencer.getTotalEditedDuration();
      const maxDur = (Number.isFinite(this.state.playback.duration) && this.state.playback.duration > 0)
        ? this.state.playback.duration
        : fallbackMax;
      return Math.max(0, Math.min(this.lastSeekIntent.editedTime, maxDur));
    }
    // word intent: map current word to edited time via sequencer
    const { clipId, wordIndex } = this.lastSeekIntent;
    const clip = this.state.timeline.clips.find((c) => c.id === clipId);
    if (!clip || !clip.words || wordIndex < 0 || wordIndex >= clip.words.length) return null;
    const word = clip.words[wordIndex];
    return this.sequencer.originalTimeToEditedTime(word.start, clipId);
  }

  private maybeCompleteOrReseek(currentEditedTime: number): void {
    const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
    const intent = this.lastSeekIntent;
    if (!intent) return;
    if (!this.isSeekIntentFresh()) {
      if (AUDIO_DEBUG) console.log('[JuceAudioManager] Seek intent stale; clearing.', intent);
      this.lastSeekIntent = null;
      return;
    }
    const target = this.computeEditedTargetFromIntent();
    if (target == null) {
      if (AUDIO_DEBUG) console.log('[JuceAudioManager] Seek intent target unavailable; clearing.', intent);
      this.lastSeekIntent = null;
      return;
    }
    const diff = Math.abs(currentEditedTime - target);
    if (diff <= this.seekEpsilonSec) {
      if (AUDIO_DEBUG) console.log('[JuceAudioManager] Seek intent satisfied at position event.', { target, currentEditedTime });
      this.lastSeekIntent = null;
      return;
    }
    if (this.edlApplying) {
      if (AUDIO_DEBUG) console.log('[JuceAudioManager] EDL applying; not reseeking yet.', { target, currentEditedTime });
      return; // wait until EDL applied
    }
    if (intent.attempts < this.maxSeekReissues) {
      intent.attempts += 1;
      if (AUDIO_DEBUG) console.log('[JuceAudioManager] Reissuing seek to target due to mismatch.', { target, currentEditedTime, attempts: intent.attempts });
      // Do not overwrite intent; call seek without resetting lastSeekIntent
      this.seekToEditedTime(target, /*setIntent*/ false);
    } else {
      if (AUDIO_DEBUG) console.log('[JuceAudioManager] Max reseek attempts reached; giving up.', intent);
      this.lastSeekIntent = null;
    }
  }

  private getPositionAtOriginalTime(originalTime: number): TimelinePosition | null {
    const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
    
    // Find the clip containing this original time in the ORIGINAL timeline
    // Word timestamps are absolute (not relative to clip start)
    const clips = this.state.timeline.clips
      .filter((c) => c.status !== 'deleted' && c.type !== 'audio-only');
    
    const clip = clips.find((c) => originalTime >= c.startTime && originalTime <= c.endTime);
    if (!clip || !clip.words || clip.words.length === 0) {
      if (AUDIO_DEBUG) {
        console.log('[getPositionAtOriginalTime] No clip found for originalTime:', originalTime, {
          availableClips: clips.map(c => ({ id: c.id.slice(-8), start: c.startTime, end: c.endTime }))
        });
      }
      return null;
    }

    // Find the word within this clip that contains the originalTime
    // Word times are absolute times in the original audio file
    const wordIndex = clip.words.findIndex(w => originalTime >= w.start && originalTime < w.end);
    
    if (wordIndex === -1) {
      if (AUDIO_DEBUG) {
        console.log('[getPositionAtOriginalTime] No word found in clip:', {
          clipId: clip.id.slice(-8),
          originalTime,
          wordRanges: clip.words.slice(0, 3).map(w => ({ text: w.word, start: w.start, end: w.end }))
        });
      }
      return null;
    }

    const result = {
      editedTime: 0, // not needed for highlight
      originalTime,
      clipId: clip.id,
      wordIndex: clip.startWordIndex + wordIndex,
      localWordIndex: wordIndex,
    };

    if (AUDIO_DEBUG) {
      console.log('[getPositionAtOriginalTime] Found word:', {
        originalTime,
        clipId: clip.id.slice(-8),
        wordText: clip.words[wordIndex].word,
        wordStart: clip.words[wordIndex].start,
        wordEnd: clip.words[wordIndex].end,
        localWordIndex: wordIndex,
        globalWordIndex: result.wordIndex
      });
    }

    return result;
  }

  /**
   * Calculate contiguous timestamps for reordered clips
   * This ensures the EDL has continuous timeline without time gaps/jumps
   */
  private calculateContiguousTimeline(clips: Clip[]): Array<{clip: Clip, newStartTime: number, newEndTime: number}> {
    let currentTime = 0;
    const result = [];
    
    for (const clip of clips) {
      const duration = Number.isFinite((clip as any).duration)
        ? (clip as any).duration
        : clip.endTime - clip.startTime;
      const newStartTime = currentTime;
      const newEndTime = currentTime + duration;
      
      result.push({
        clip,
        newStartTime,
        newEndTime
      });
      
      currentTime = newEndTime;
    }
    
    return result;
  }

  /** Build the playable sequence for the sequencer: active clips (including audio-only) in edited order. */
  private buildOrderedActiveClips(clips: Clip[], reorderIndices: number[], activeClipIds: Set<string>): Clip[] {
    return reorderIndices
      .map((i) => clips[i])
      // Exclude only initial placeholder; include audio-only gaps so playback covers all audio
      .filter((c) => c && activeClipIds.has(c.id) && c.type !== 'initial');
  }

  private async pushEdl(): Promise<void> {
    // Build EDL from current state — always contiguous edited timeline
    const { clips, reorderIndices, activeClipIds } = this.state.timeline;
    let ordered = reorderIndices
      .map((i) => clips[i])
      // Build EDL from active clips; include audio-only to preserve all timing
      .filter((c) => c && activeClipIds.has(c.id) && c.type !== 'initial');
    // Do NOT alter original clip times here. Edited timeline starts at 0 via
    // contiguous mapping below; original start/end remain authoritative.
    const gapCount = ordered.filter((c: any) => c?.type === 'audio-only').length;

    const contiguousTimeline = this.calculateContiguousTimeline(ordered);
    const edl: EdlClip[] = contiguousTimeline.map(({ clip, newStartTime, newEndTime }, idx) => {
      const segments = (() => {
        if (Array.isArray((clip as any).segments) && (clip as any).segments.length > 0) {
          return (clip as any).segments.map((segment: any) => {
            const startSec = Number(segment.start) || 0;
            const endSec = Number(segment.end);
            const safeEnd = Number.isFinite(endSec) ? endSec : startSec;
            const fallbackOriginalStart = clip.startTime + startSec;
            const fallbackOriginalEnd = clip.startTime + safeEnd;

            if (segment.type === 'word') {
              const originalStart = Number.isFinite(segment.originalStart)
                ? segment.originalStart
                : fallbackOriginalStart;
              const originalEnd = Number.isFinite(segment.originalEnd)
                ? segment.originalEnd
                : fallbackOriginalEnd;
              return {
                type: 'word' as const,
                startSec,
                endSec: safeEnd,
                text: segment.text,
                originalStartSec: originalStart,
                originalEndSec: originalEnd,
              };
            }

            return {
              type: 'spacer' as const,
              startSec,
              endSec: safeEnd,
              originalStartSec: fallbackOriginalStart,
              originalEndSec: fallbackOriginalEnd,
            };
          });
        }

        // Legacy fallback for projects that still provide clip.words
        return (clip as any).words?.map((word: any) => ({
          type: 'word' as const,
          startSec: word.start - clip.startTime,
          endSec: word.end - clip.startTime,
          text: word.text,
          originalStartSec: word.start,
          originalEndSec: word.end,
        })) || [];
      })();

      return {
        id: clip.id,
        startSec: newStartTime,
        endSec: newEndTime,
        originalStartSec: clip.startTime,
        originalEndSec: clip.endTime,
        order: idx,
        segments, // Include segments for JUCE backend
      };
    });

    // Detect reorder: if any segment's originalStartSec decreases vs previous in EDL order
    let reordered = false;
    for (let i = 1; i < edl.length; i++) {
      const prev = edl[i - 1];
      const cur = edl[i];
      if ((cur.originalStartSec ?? 0) < (prev.originalStartSec ?? 0)) {
        reordered = true; break;
      }
    }
    this.preferOriginalSeek = reordered;

    if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
      console.log('[EDL] ▶ Using contiguous edited timeline for all clips');
      console.log('  Reordered indices:', reorderIndices);
      console.log('  Contiguous mapping (first 8):');
      contiguousTimeline.slice(0, 8).forEach(({ clip, newStartTime, newEndTime }, i) => {
        const wordCount = clip.words ? clip.words.length : 0;
        const segmentCount = edl[i]?.segments?.length || 0;
        console.log(`    [${i}] ${clip.id.slice(-8)}: Original(${clip.startTime.toFixed(2)}-${clip.endTime.toFixed(2)}s) → Edited(${newStartTime.toFixed(2)}-${newEndTime.toFixed(2)}s) [${wordCount} words, ${segmentCount} segments]`);
      });
      const totalSegments = edl.reduce((sum, clip) => sum + (clip.segments?.length || 0), 0);
      console.log(`[EDL] 📤 Sending EDL to JUCE: ${edl.length} clips with ${totalSegments} total segments (${gapCount} gaps)`);
      console.log('[EDL] First 5 EDL entries:');
      edl.slice(0, 5).forEach((segment, i) => {
        const segCount = segment.segments?.length || 0;
        console.log(`  [${i}] ${segment.id.slice(-8)}: ${segment.startSec.toFixed(2)}-${segment.endSec.toFixed(2)}s (orig: ${segment.originalStartSec!.toFixed(2)}-${segment.originalEndSec!.toFixed(2)}s) [${segCount} segments]`);
      });
    }

    const res = await this.transport!.updateEdl(this.sessionId, edl);
    if (!res.success) throw new Error(res.error || 'updateEdl failed');
    // Wait for 'edlApplied' (or fallback timer) before clearing edlApplying and flushing seeks
  }

  private resolveAudioPath(audioUrl: string): string | null {
    try {
      if (audioUrl.startsWith('file://')) {
        const u = new URL(audioUrl);
        return decodeURIComponent(u.pathname);
      }
      if (audioUrl.startsWith('/')) return audioUrl; // absolute path

      // Handle relative paths using project directory
      if (this.projectDirectory && !audioUrl.includes('://')) {
        // Use Node.js path module via electronAPI
        const path = (window as any).electronAPI?.path;
        if (path) {
          // Get the directory containing the .transcript file
          const projectDir = path.dirname(this.projectDirectory);
          // Try multiple candidates for relative path resolution
          const candidates = [
            path.join(projectDir, audioUrl), // Direct relative path
            path.join(projectDir, 'Audio Files', path.basename(audioUrl)), // Common project structure
            path.join(projectDir, audioUrl.replace(/^Audio Files[\/\\]/, '')) // Remove Audio Files prefix if present
          ];

          console.log('[JuceAudioManager] Resolving relative path:', {
            audioUrl,
            projectDirectory: this.projectDirectory,
            projectDir,
            candidates
          });

          // Return the first candidate - the JUCE client will validate existence
          return candidates[0];
        }
      }

      return null;
    } catch {
      return null;
    }
  }
}

export default JuceAudioManager;
