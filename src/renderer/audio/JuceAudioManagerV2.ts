/**
 * JuceAudioManager v2.0 - Simplified JUCE integration
 *
 * Clean implementation without fallback systems:
 * - Uses EDLBuilderService for clean EDL generation
 * - Single event handling path (no hybrid polling)
 * - Segment-aware highlighting with binary search
 * - Clear state management with atomic operations
 */

import { Clip } from '../../shared/types';
import { EDLBuilderService, EdlResult, SegmentLookupEntry } from '../services/EDLBuilderService';
import type { EdlClip, JuceEvent } from '../../shared/types/transport';

// ==================== Types ====================

export interface AudioStateV2 {
  // Playback state
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;        // Contiguous timeline time
  originalTime: number;       // Original audio file time
  duration: number;
  sampleRate: number | null;
  channels: number | null;

  // Audio settings
  volume: number;
  playbackRate: number;

  // Clip state
  currentClipId: string | null;
  currentSegmentIndex: number | null;

  // System state
  isReady: boolean;
  readyStatus: 'idle' | 'loading' | 'waiting-edl' | 'ready' | 'fallback';
  error: string | null;
}

export interface AudioCallbacksV2 {
  onStateChange: (state: AudioStateV2) => void;
  onSegmentHighlight: (clipId: string | null, segmentIndex: number | null) => void;
  onError: (error: string) => void;
}

export interface JuceAudioManagerV2Options {
  callbacks: AudioCallbacksV2;
  projectDirectory?: string;
}

export interface SeekIntent {
  time: number;
  isOriginalTime: boolean;
  timestamp: number;
}

// ==================== JUCE Audio Manager V2 ====================

export class JuceAudioManagerV2 {
  private state: AudioStateV2;
  private callbacks: AudioCallbacksV2;
  private sessionId: string = 'audio-session';
  private audioPath: string | null = null;
  private generationCounter: number = 0;
  private currentGenerationId: number = 0;
  private loadedGenerationId: number | null = null;
  private readyGenerationId: number | null = null;
  private inflightLoadGeneration: number | null = null;
  private inflightLoadPromise: Promise<void> | null = null;
  private inflightLoadPath: string | null = null;

  // EDL and lookup optimization
  private currentEDL: EdlResult | null = null;
  private isApplyingEDL: boolean = false;

  // Pending clips cache for race condition fix
  private pendingClips: Clip[] | null = null;

  // JUCE transport interface
  private transport = (window as any).juceTransport;
  private eventHandler?: (evt: JuceEvent) => void;

  // Seek intent management
  private lastSeekIntent: SeekIntent | null = null;
  private seekCooldown: number = 100; // ms

  // Initialization guards
  private isInitializing: boolean = false;
  private lastFailedPath: string | null = null;
  private errorCooldown: number = 1000; // 1 second cooldown after errors (reduced from 5s)
  private lastErrorTime: number = 0;
  private bufferErrorCooldown: number = 100; // Very short cooldown for buffer errors (they're transient)

  // Track last resolved project directory to resolve relative paths later
  private lastResolvedProjectDir: { base: string; isWindows: boolean } | null = null;
  private projectDirectory?: string;

  // Revision tracking for EDL application confirmation
  private sentRevisionCounter: number = 0;
  private expectedRevision: number = 0;
  private awaitingEdlRevision: number | null = null;
  private awaitingEdlGeneration: number | null = null;
  private readyFallbackTimer: number | null = null;
  private readyFallbackToken: { generation: number; revision: number | null } | null = null;

  constructor(options: JuceAudioManagerV2Options | AudioCallbacksV2) {
    // Handle both old callback-only and new options-based constructors
    if ('callbacks' in options) {
      this.callbacks = options.callbacks;
      this.projectDirectory = options.projectDirectory;
    } else {
      // Backward compatibility: treat as callbacks directly
      this.callbacks = options;
      this.projectDirectory = undefined;
    }
    this.state = {
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      originalTime: 0,
      duration: 0,
      sampleRate: null,
      channels: null,
      volume: 1.0,
      playbackRate: 1.0,
      currentClipId: null,
      currentSegmentIndex: null,
      isReady: false,
      readyStatus: 'idle',
      error: null
    };

    this.initializeJuceEventHandling();
  }

  // ==================== Public API ====================

  /**
   * Initialize audio with file path
   */
  public async initialize(audioPath: string): Promise<void> {
    const now = Date.now();
    if (this.lastErrorTime > 0 && now - this.lastErrorTime < this.errorCooldown) {
      console.warn('🎵 Initialize blocked due to error cooldown');
      return;
    }

    if (this.lastFailedPath === audioPath && now - this.lastErrorTime < this.errorCooldown) {
      console.warn('🎵 Skipping retry of recently failed path:', audioPath);
      return;
    }
    let resolvedPath: string | null = null;

    try {
      resolvedPath = await this.resolveAudioPath(audioPath);
      if (!resolvedPath) {
        throw new Error(`Unable to resolve audio path: ${audioPath}`);
      }

      if (
        this.audioPath === resolvedPath &&
        this.loadedGenerationId === this.currentGenerationId &&
        this.state.isReady
      ) {
        console.log('[AudioManager] Skipping initialize — audio already ready for resolved path', {
          path: resolvedPath,
          generation: this.currentGenerationId,
        });
        return;
      }

      if (
        this.inflightLoadPromise &&
        this.inflightLoadGeneration !== null &&
        this.inflightLoadPath === resolvedPath
      ) {
        console.log('[AudioManager] Load already in flight for resolved path; reusing pending promise', {
          path: resolvedPath,
          generation: this.inflightLoadGeneration,
        });
        await this.inflightLoadPromise;
        return;
      }

      const previousGeneration = this.currentGenerationId;
      if (this.inflightLoadGeneration !== null) {
        this.cancelInflightLoad('supersede', this.inflightLoadGeneration);
      }

      const newGeneration = ++this.generationCounter;
      this.currentGenerationId = newGeneration;
      this.inflightLoadGeneration = newGeneration;
      if (previousGeneration && previousGeneration !== newGeneration) {
        console.log('[Load] supersede', { oldGen: previousGeneration, newGen: newGeneration });
      }

      if (this.isInitializing) {
        console.warn('🎵 Initialize already in progress, superseding with new generation');
      }

      this.isInitializing = true;

      this.audioPath = resolvedPath;
      this.resetInitialSyncState();
      this.updateState({ isLoading: true, readyStatus: 'loading', isReady: false, error: null });

      if (!this.transport) {
        throw new Error('JUCE transport not available');
      }

      const source = this.getFileExtension(resolvedPath) ?? 'unknown';
      console.info('[AudioManager] Loading audio with resolved path:', {
        original: audioPath,
        resolved: resolvedPath,
        gen: newGeneration,
      });
      console.log('[Load] start', { gen: newGeneration, path: resolvedPath, source });

      const loadPromise = this.loadFile(this.sessionId, resolvedPath, newGeneration);
      const trackedPromise = loadPromise.finally(() => {
        if (this.inflightLoadGeneration === newGeneration) {
          this.inflightLoadGeneration = null;
        }
        if (this.inflightLoadPromise === trackedPromise) {
          this.inflightLoadPromise = null;
          this.inflightLoadPath = null;
        }
      });
      this.inflightLoadPromise = trackedPromise;
      this.inflightLoadPath = resolvedPath;

      await trackedPromise;

      try {
        const result = await this.transport.setRate?.(this.sessionId, 1.0, newGeneration);
        if (!result || result.success) {
          this.updateState({ playbackRate: 1.0 });
        } else if (result.error?.includes('stale generation')) {
          console.warn('[AudioManager] Ignored stale rate reset for superseded generation', {
            generation: newGeneration,
          });
        }
      } catch (error) {
        console.warn('🎵 Failed to reset playback rate after load:', error);
      }

      this.updateState({
        isLoading: false,
        readyStatus: 'waiting-edl',
        isReady: false,
        error: null,
      });

      this.lastFailedPath = null;
      this.lastErrorTime = 0;

      console.log('🎵 ✅ JUCE audio load initiated successfully:', resolvedPath);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('superseded')) {
        console.info('[AudioManager] Load superseded before completion; awaiting newer generation');
        return;
      }

      this.lastFailedPath = audioPath;
      this.lastErrorTime = Date.now();

      this.updateState({
        isLoading: false,
        isReady: false,
        readyStatus: 'idle',
        error: errorMessage,
      });

      console.error('🔥 Failed to initialize audio:', errorMessage);
      this.callbacks.onError(errorMessage);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Get current session generation identifier for diagnostics
   */
  public getCurrentGenerationId(): number {
    return this.currentGenerationId;
  }

  /**
   * Provide diagnostic information about readiness state for logging.
   */
  public getReadinessDebugInfo(): Record<string, unknown> {
    return {
      isReady: this.state.isReady,
      readyStatus: this.state.readyStatus,
      hasTransport: !!this.transport,
      audioPath: this.audioPath,
      currentGenerationId: this.currentGenerationId,
      inflightLoadGeneration: this.inflightLoadGeneration,
      inflightLoadPath: this.inflightLoadPath,
      loadedGenerationId: this.loadedGenerationId,
      readyGenerationId: this.readyGenerationId,
      awaitingEdlRevision: this.awaitingEdlRevision,
      awaitingEdlGeneration: this.awaitingEdlGeneration,
      expectedRevision: this.expectedRevision,
      sentRevisionCounter: this.sentRevisionCounter,
    };
  }

  /**
   * Update clips with new EDL
   */
  public async updateClips(clips: Clip[]): Promise<void> {
    try {
      const generation = this.currentGenerationId;
      if (!this.transport || this.loadedGenerationId !== generation) {
        console.warn('⚠️ Cannot update clips: JUCE not ready for current generation, caching for later application', { generation });
        this.pendingClips = [...clips];
        return;
      }

      this.isApplyingEDL = true;

      // Build optimized EDL with segment metadata
      this.currentEDL = EDLBuilderService.buildEDL(clips);

      // Validate EDL before sending
      const validation = EDLBuilderService.validateEDL(this.currentEDL);
      if (!validation.isValid) {
        console.warn('⚠️ EDL validation failed:', validation.errors);
      }

      // Convert to legacy format for JUCE
      const legacyClips = EDLBuilderService.toLegacyFormat(this.currentEDL);

      // Increment revision for tracking
      const revision = ++this.sentRevisionCounter;
      console.info(`[AudioManager] Sending EDL to JUCE (revision ${revision}, gen ${generation})`);

      const result = await this.transport.updateEdl(this.sessionId, revision, legacyClips, generation);
      if (!result || !result.success) {
        const message = result?.error || 'Failed to update EDL';
        if (message.includes('stale generation')) {
          console.warn('[AudioManager] Ignoring stale updateEdl acknowledgement for superseded generation', { generation, revision });
          return;
        }
        throw new Error(message);
      }

      const acknowledgedRevision =
        typeof result.revision === 'number' && Number.isFinite(result.revision)
          ? Math.floor(result.revision)
          : revision;

      if (acknowledgedRevision !== revision) {
        console.warn('[AudioManager] ⚠️ Backend acknowledged unexpected revision', {
          requested: revision,
          acknowledged: acknowledgedRevision,
        });
      }

      this.sentRevisionCounter = Math.max(this.sentRevisionCounter, acknowledgedRevision);
      this.expectedRevision = acknowledgedRevision;

      console.log('[Flush] EDL', { gen: generation, revision: acknowledgedRevision });

      if (this.loadedGenerationId === generation && this.readyGenerationId !== generation) {
        console.info('[AudioManager] Awaiting JUCE edlApplied event before enabling transport', {
          revision: acknowledgedRevision,
          generation,
        });
        this.awaitingEdlRevision = acknowledgedRevision;
        this.awaitingEdlGeneration = generation;
        this.updateState({ readyStatus: 'waiting-edl', isReady: false });
        this.scheduleReadyFallback(generation, acknowledgedRevision);
      }

      // Update duration from EDL
      this.updateState({
        duration: this.currentEDL.metadata.totalDuration,
        error: null
      });

      console.log('🎬 EDL updated:', EDLBuilderService.getEDLSummary(this.currentEDL));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('stale generation')) {
        console.warn('[AudioManager] Ignoring stale updateClips error for superseded generation', {
          generation: this.currentGenerationId,
        });
        return;
      }
      this.updateState({ error: errorMessage });
      this.callbacks.onError(errorMessage);
    } finally {
      this.isApplyingEDL = false;

      // Process any pending seek intent
      this.processPendingSeek();
    }
  }

  /**
   * Flush pending clips that were cached while JUCE was not ready
   */
  private async flushPendingClips(): Promise<void> {
    if (!this.pendingClips || this.pendingClips.length === 0) {
      return;
    }

    if (this.loadedGenerationId !== this.currentGenerationId) {
      console.log('[EDL] flushPending skipped due to generation mismatch', {
        currentGen: this.currentGenerationId,
        loadedGen: this.loadedGenerationId,
      });
      return;
    }

    console.log('[EDL] flushPending', { gen: this.currentGenerationId, clipCount: this.pendingClips.length });
    const clipsToApply = this.pendingClips;
    this.pendingClips = null; // Clear cache before applying to avoid recursion

    try {
      await this.updateClips(clipsToApply);
    } catch (error) {
      console.error('[AudioManager] Failed to flush pending clips:', error);
      // Restore clips if flush failed, so they can be retried later
      this.pendingClips = clipsToApply;
    }
  }

  /**
   * Play audio
   */
  public async play(): Promise<void> {
    const generation = this.currentGenerationId;
    const readinessDetails = this.getReadinessDebugInfo();

    console.log('[CMD] play', {
      gen: generation,
      phase: 'request',
      readyStatus: this.state.readyStatus,
      isReady: this.state.isReady,
    });

    if (!this.transport) {
      console.warn('[CMD] play skipped — transport unavailable', { gen: generation });
      console.warn('[IPC send] play skipped — transport unavailable', {
        gen: generation,
        ...readinessDetails,
      });
      return;
    }

    if (!this.state.isReady) {
      console.warn('[CMD] play blocked — transport not ready', {
        gen: generation,
        readyStatus: this.state.readyStatus,
      });
      console.warn('[IPC send] play skipped — readiness gate', {
        gen: generation,
        ...readinessDetails,
      });
      return;
    }

    console.log('[IPC send] play', {
      gen: generation,
      sessionId: this.sessionId,
      audioPath: this.audioPath,
    });

    try {
      const result = await this.transport.play(this.sessionId, generation);
      if (!result || result.success) {
        this.updateState({ isPlaying: true, error: null });
      } else if (result.error?.includes('stale generation')) {
        console.warn('[AudioManager] Ignoring play command for superseded generation', {
          generation,
        });
      }
    } catch (error) {
      this.handleError('Play failed', error);
    }
  }

  /**
   * Pause audio
   */
  public async pause(): Promise<void> {
    if (!this.transport) return;

    const generation = this.currentGenerationId;
    console.log('[CMD] pause', {
      gen: generation,
      readyStatus: this.state.readyStatus,
    });
    try {
      const result = await this.transport.pause(this.sessionId, generation);
      if (!result || result.success) {
        this.updateState({ isPlaying: false });
      } else if (result.error?.includes('stale generation')) {
        console.warn('[AudioManager] Ignoring pause command for superseded generation', {
          generation,
        });
      }
    } catch (error) {
      this.handleError('Pause failed', error);
    }
  }

  public async stop(): Promise<void> {
    if (!this.transport?.stop) {
      console.warn('[CMD] stop skipped — transport does not expose stop()');
      return;
    }

    const generation = this.currentGenerationId;
    console.log('[CMD] stop', {
      gen: generation,
      readyStatus: this.state.readyStatus,
    });

    try {
      const result = await this.transport.stop(this.sessionId, generation);
      if (!result || result.success) {
        this.updateState({ isPlaying: false });
      } else if (result.error?.includes('stale generation')) {
        console.warn('[AudioManager] Ignoring stop command for superseded generation', {
          generation,
        });
      }
    } catch (error) {
      this.handleError('Stop failed', error);
    }
  }

  /**
   * Seek to specific time
   */
  public async seek(time: number, isOriginalTime: boolean = false): Promise<void> {
    if (!this.transport || !this.state.isReady) return;

    try {
      // Record seek intent
      this.lastSeekIntent = {
        time,
        isOriginalTime,
        timestamp: Date.now()
      };

      // If EDL is applying, defer the seek
      if (this.isApplyingEDL) {
        console.log('🎯 Deferring seek while EDL applying:', time.toFixed(2) + 's');
        return;
      }

      await this.executeSeek(time, isOriginalTime);

    } catch (error) {
      this.handleError('Seek failed', error);
    }
  }

  /**
   * Set volume
   */
  public async setVolume(volume: number): Promise<void> {
    if (!this.transport) return;

    try {
      const result = await this.transport.setVolume(this.sessionId, volume, this.currentGenerationId);
      if (!result || result.success) {
        this.updateState({ volume });
      } else if (result?.error?.includes('stale generation')) {
        console.warn('[AudioManager] Ignoring volume change for superseded generation', {
          generation: this.currentGenerationId,
        });
      }
    } catch (error) {
      this.handleError('Set volume failed', error);
    }
  }

  /**
   * Set playback rate
   */
  public async setPlaybackRate(rate: number): Promise<void> {
    if (!this.transport) return;

    try {
      const result = await this.transport.setRate(this.sessionId, rate, this.currentGenerationId);
      if (!result || result.success) {
        this.updateState({ playbackRate: rate });
      } else if (result?.error?.includes('stale generation')) {
        console.warn('[AudioManager] Ignoring playback rate change for superseded generation', {
          generation: this.currentGenerationId,
        });
      }
    } catch (error) {
      this.handleError('Set playback rate failed', error);
    }
  }

  /**
   * Get current state
   */
  public getState(): AudioStateV2 {
    return { ...this.state };
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.inflightLoadGeneration !== null) {
      this.cancelInflightLoad('dispose', this.inflightLoadGeneration);
    }
    if (this.eventHandler && this.transport) {
      this.transport.offEvent(this.eventHandler);
    }
    if (this.transport?.removeAllListeners) {
      try {
        this.transport.removeAllListeners();
      } catch (error) {
        console.warn('[AudioManager] Failed to remove JUCE listeners during dispose', error);
      }
    }
    this.currentEDL = null;
    this.lastSeekIntent = null;
    this.pendingClips = null;
    this.clearReadyFallbackTimer();
    this.loadedGenerationId = null;
    this.readyGenerationId = null;
    this.awaitingEdlRevision = null;
    this.awaitingEdlGeneration = null;
    this.readyFallbackToken = null;
  }

  // ==================== Private Methods ====================

  /**
   * Load audio file into JUCE backend
   */
  private async loadFile(sessionId: string, filePath: string, generationId: number): Promise<void> {
    if (!this.transport) {
      throw new Error('JUCE transport not available');
    }

    try {
      console.info('[AudioManager] calling juceTransport.load', { filePath, generationId });
      const result = await this.transport.load(sessionId, filePath, generationId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to load audio file');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('🔥 JUCE loadFile failed:', errorMessage);
      throw new Error(`Load file failed: ${errorMessage}`);
    }
  }

  private initializeJuceEventHandling(): void {
    if (!this.transport) return;

    this.eventHandler = (event: JuceEvent) => {
      this.handleJuceEvent(event);
    };

    this.transport.onEvent(this.eventHandler);
  }

  private handleJuceEvent(event: JuceEvent): void {
    const eventGeneration = typeof (event as any).generationId === 'number'
      ? (event as any).generationId
      : undefined;

    const eventSummary = event.type === 'position'
      ? {
          type: event.type,
          editedSec: typeof event.editedSec === 'number' ? Number(event.editedSec.toFixed(3)) : event.editedSec,
          originalSec: typeof event.originalSec === 'number' ? Number(event.originalSec.toFixed(3)) : event.originalSec,
          revision: (event as any).revision,
          generationId: eventGeneration,
        }
      : {
          type: event.type,
          revision: (event as any).revision,
          wordCount: (event as any).wordCount,
          spacerCount: (event as any).spacerCount,
          generationId: eventGeneration,
        };

    console.log('[Event] from JUCE', {
      type: event.type,
      gen: eventGeneration,
      currentGen: this.currentGenerationId,
      revision: (event as any).revision,
    });

    if (!this.isEventGenerationCurrent(eventGeneration)) {
      console.warn('[Guard] ignoring stale event', {
        type: event.type,
        eventGen: eventGeneration,
        currentGen: this.currentGenerationId,
      });
      return;
    }

    switch (event.type) {
      case 'loaded': {
        const sampleRate = (event as any).sampleRate;
        const channels = (event as any).channels;
        if (sampleRate !== 48000 || channels !== 2) {
          console.warn('[AudioManager] ⚠️ Sample format mismatch on load', {
            generation: this.currentGenerationId,
            sampleRate,
            channels,
            expectedSampleRate: 48000,
            expectedChannels: 2,
          });
        } else {
          console.log('[AudioManager] ✅ Sample format confirmed 48k stereo', { generation: this.currentGenerationId });
        }
        this.loadedGenerationId = eventGeneration ?? this.currentGenerationId;
        this.inflightLoadGeneration = null;
        this.sentRevisionCounter = 0;
        this.expectedRevision = 0;
        this.awaitingEdlRevision = null;
        this.awaitingEdlGeneration = null;
        this.readyGenerationId = null;
        this.readyFallbackToken = null;
        this.clearReadyFallbackTimer();
        console.info('[AudioManager] Reset EDL revision counter after JUCE load', { generation: this.loadedGenerationId });
        console.info('[JUCE] transport loaded', {
          durationSec: event.durationSec,
          sampleRate,
          channels,
        });
        this.updateState({
          isLoading: false,
          isReady: false,
          readyStatus: 'waiting-edl',
          duration: typeof event.durationSec === 'number' ? event.durationSec : this.state.duration,
          sampleRate: typeof sampleRate === 'number' ? sampleRate : this.state.sampleRate,
          channels: typeof channels === 'number' ? channels : this.state.channels,
          error: null,
        });
        this.flushPendingClips();
        break;
      }

      case 'state': {
        this.updateState({
          isPlaying: !!event.playing,
          isLoading: false,
          isReady: this.state.isReady,
          readyStatus: this.state.readyStatus,
          error: null,
        });
        break;
      }

      case 'position': {
        this.handlePositionEvent(event);
        break;
      }

      case 'edlApplied': {
        const revision = typeof event.revision === 'number' && Number.isFinite(event.revision)
          ? Math.floor(event.revision)
          : this.sentRevisionCounter;
        console.info('[AudioManager] EDL applied by JUCE', {
          revision,
          expected: this.expectedRevision,
          generation: this.currentGenerationId,
          mode: (event as any).mode,
          wordCount: (event as any).wordCount,
          spacerCount: (event as any).spacerCount,
        });
        this.sentRevisionCounter = Math.max(this.sentRevisionCounter, revision);
        if (this.readyGenerationId !== this.currentGenerationId) {
          this.expectedRevision = revision;
          this.markTransportReady('ready', revision, this.currentGenerationId);
        } else {
          if (revision !== this.expectedRevision) {
            console.warn('[AudioManager] ⚠️ EDL revision mismatch!', {
              received: revision,
              expected: this.expectedRevision,
            });
            this.expectedRevision = Math.max(this.expectedRevision, revision);
          }
          if (this.state.readyStatus === 'fallback') {
            console.info('[AudioManager] Transport fallback resolved by JUCE edlApplied event');
            this.updateState({ readyStatus: 'ready', isReady: true });
          }
        }

        this.awaitingEdlRevision = null;
        this.awaitingEdlGeneration = null;
        this.processPendingSeek();
        break;
      }

      case 'ended': {
        this.updateState({ isPlaying: false });
        break;
      }

      case 'error': {
        const details = event.code != null ? `${event.message} (code: ${event.code})` : event.message;
        if (!this.isInitializing) {
          this.updateState({ isPlaying: false, isLoading: false, isReady: false, readyStatus: 'idle' });
        } else {
          this.updateState({ isPlaying: false, isLoading: false });
        }
        this.handleError('JUCE transport error', details);
        break;
      }

      default:
        console.warn('[JUCE][Renderer] Unhandled JUCE event type', eventSummary);
        break;
    }
  }

  private handlePositionEvent(event: Extract<JuceEvent, { type: 'position' }>): void {
    if (!this.currentEDL) return;

    const { editedSec, originalSec } = event;

    if (typeof editedSec !== 'number' || typeof originalSec !== 'number') {
      console.warn('⚠️ Received position event without valid timing data:', event);
      return;
    }

    const contiguousTime = editedSec;
    const originalTime = originalSec;

    // Update position state
    this.updateState({
      currentTime: contiguousTime,
      originalTime: originalTime
    });

    // Find current segment using binary search
    this.updateCurrentSegment(contiguousTime);
  }

  private updateCurrentSegment(contiguousTime: number): void {
    if (!this.currentEDL) return;

    const segment = EDLBuilderService.findSegmentAtTime(
      this.currentEDL.lookupTable,
      contiguousTime
    );

    if (segment) {
      if (this.state.currentClipId !== segment.clipId ||
          this.state.currentSegmentIndex !== segment.segmentIndex) {

        this.updateState({
          currentClipId: segment.clipId,
          currentSegmentIndex: segment.segmentIndex
        });

        // Notify about segment highlight
        this.callbacks.onSegmentHighlight(segment.clipId, segment.segmentIndex);
      }
    } else {
      // No segment found - clear highlight
      if (this.state.currentClipId || this.state.currentSegmentIndex !== null) {
        this.updateState({
          currentClipId: null,
          currentSegmentIndex: null
        });

        this.callbacks.onSegmentHighlight(null, null);
      }
    }
  }

  private async executeSeek(time: number, isOriginalTime: boolean): Promise<void> {
    if (!this.transport || !this.currentEDL) return;

    let seekTime = time;

    // Convert between time domains if needed
    if (isOriginalTime && this.currentEDL.metadata.hasReordering) {
      // Convert original time to contiguous time for reordered clips
      const contiguousTime = EDLBuilderService.originalToContiguousTime(
        this.currentEDL.clips,
        time
      );

      if (contiguousTime !== null) {
        seekTime = contiguousTime;
        console.log(`🔄 Converted original time ${time.toFixed(2)}s → contiguous ${seekTime.toFixed(2)}s`);
      }
    } else if (!isOriginalTime && this.currentEDL.metadata.hasReordering) {
      // For contiguous time seeks in reordered clips, use the time as-is
      seekTime = time;
    }

    console.log(`🎯 Seeking to ${seekTime.toFixed(2)}s`);

    const result = await this.transport.seek(this.sessionId, seekTime, this.currentGenerationId);
    if (!result || !result.success) {
      if (result?.error?.includes('stale generation')) {
        console.warn('[AudioManager] Ignoring seek command for superseded generation', {
          generation: this.currentGenerationId,
          target: Number(seekTime.toFixed(3)),
        });
        return;
      }
      throw new Error(result?.error || 'Seek failed');
    }
  }

  private processPendingSeek(): void {
    if (!this.lastSeekIntent) return;

    const now = Date.now();
    const timeSinceSeek = now - this.lastSeekIntent.timestamp;

    // Only process recent seek intents
    if (timeSinceSeek < this.seekCooldown * 10) {
      console.log('🎯 Processing pending seek:', this.lastSeekIntent.time.toFixed(2) + 's');
      this.executeSeek(this.lastSeekIntent.time, this.lastSeekIntent.isOriginalTime);
    }

    this.lastSeekIntent = null;
  }

  private updateState(updates: Partial<AudioStateV2>): void {
    const previousState = this.state;
    const nextState: AudioStateV2 = { ...previousState, ...updates };

    if (updates.isReady !== undefined && updates.isReady !== previousState.isReady) {
      console.log('[AudioManager] Ready flag changed', {
        from: previousState.isReady,
        to: nextState.isReady,
        readyStatus: nextState.readyStatus,
        gen: this.currentGenerationId,
        loadedGenerationId: this.loadedGenerationId,
        readyGenerationId: this.readyGenerationId,
      });
    }

    if (updates.readyStatus !== undefined && updates.readyStatus !== previousState.readyStatus) {
      console.log('[AudioManager] Ready status changed', {
        from: previousState.readyStatus,
        to: nextState.readyStatus,
        isReady: nextState.isReady,
        gen: this.currentGenerationId,
      });
    }

    this.state = nextState;
    this.callbacks.onStateChange(this.state);
  }

  private resetInitialSyncState(): void {
    this.loadedGenerationId = null;
    this.readyGenerationId = null;
    this.sentRevisionCounter = 0;
    this.expectedRevision = 0;
    this.awaitingEdlRevision = null;
    this.awaitingEdlGeneration = null;
    this.readyFallbackToken = null;
    this.clearReadyFallbackTimer();
  }

  private cancelInflightLoad(reason: 'supersede' | 'dispose', generation: number): void {
    if (!generation) {
      return;
    }
    console.log('[Load] cancel in-flight load', { gen: generation, reason });
    if (this.transport?.stop) {
      void this.transport.stop(this.sessionId, generation).catch((error: any) => {
        console.warn('[AudioManager] Failed to cancel in-flight load via stop()', error);
      });
    }
    this.inflightLoadGeneration = null;
    this.inflightLoadPromise = null;
    this.inflightLoadPath = null;
  }

  private scheduleReadyFallback(generation: number, revision: number): void {
    if (this.readyGenerationId === generation) {
      return;
    }

    this.clearReadyFallbackTimer();
    this.readyFallbackToken = { generation, revision };
    this.readyFallbackTimer = window.setTimeout(() => {
      if (this.currentGenerationId !== generation || this.readyGenerationId === generation) {
        return;
      }
      console.warn('[AudioManager] ⚠️ No edlApplied event received within 2000ms; enabling playback with caution', {
        revision,
        generation,
      });
      this.markTransportReady('fallback', revision, generation);
    }, 2000);
  }

  private markTransportReady(mode: 'ready' | 'fallback', revision: number | null, generation: number): void {
    this.clearReadyFallbackTimer();
    if (this.currentGenerationId !== generation) {
      console.warn('[AudioManager] Ignoring markTransportReady for superseded generation', {
        requestedGen: generation,
        currentGen: this.currentGenerationId,
      });
      return;
    }
    this.readyGenerationId = generation;
    this.awaitingEdlRevision = null;
    this.awaitingEdlGeneration = null;
    if (typeof revision === 'number') {
      this.sentRevisionCounter = Math.max(this.sentRevisionCounter, revision);
      this.expectedRevision = Math.max(this.expectedRevision, revision);
    }
    this.updateState({
      isLoading: false,
      isReady: true,
      readyStatus: mode,
    });
  }

  private clearReadyFallbackTimer(): void {
    if (this.readyFallbackTimer !== null) {
      window.clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
    this.readyFallbackToken = null;
  }

  private handleError(context: string, error: any): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = `${context}: ${errorMessage}`;

    console.error('🔥 JUCE Audio Error:', fullMessage);

    // Check if this is a buffer-related error (transient)
    const isBufferError = errorMessage.includes('buffer full') ||
                         errorMessage.includes('stdin') ||
                         errorMessage.includes('write failed');

    if (isBufferError) {
      // Use shorter cooldown for buffer errors as they're transient
      this.lastErrorTime = Date.now();
      console.warn('🎵 ⚠️ Buffer error detected - using reduced cooldown for fast recovery');

      // Override cooldown for buffer errors
      setTimeout(() => {
        console.log('🎵 ✅ Buffer error cooldown expired, ready for retry');
        this.lastErrorTime = 0;
      }, this.bufferErrorCooldown);
    } else {
      // Regular error cooldown
      this.lastErrorTime = Date.now();
    }

    this.updateState({ error: fullMessage });

    // Only call error callback if we're not in a cooldown period
    // This prevents rapid callback loops
    if (!this.isInitializing || this.lastErrorTime === 0) {
      this.callbacks.onError(fullMessage);
    }
  }

  /**
   * Resolve audio path to absolute path that JUCE can use
   */
  private async resolveAudioPath(audioPath: string): Promise<string | null> {
    try {
      if (!audioPath || typeof audioPath !== 'string') {
        return null;
      }

      const checkFileExists = (window as any).electronAPI?.checkFileExists;
      const pathApi = (window as any).electronAPI?.path;

      console.log('🎵 Resolving audio path:', { audioPath, projectDirectory: this.projectDirectory });

      // Handle file:// URLs
      if (audioPath.startsWith('file://')) {
        const url = new URL(audioPath);
        let resolvedPath = decodeURIComponent(url.pathname);

        // Windows file:// URLs include an extra leading slash before drive letter
        if (/^\/[a-zA-Z]:/.test(resolvedPath)) {
          resolvedPath = resolvedPath.substring(1);
        }

        const normalized = this.normalizePathForPlatform(resolvedPath);
        const ext = this.getFileExtension(normalized);
        const wavAlternative = ext && ext !== 'wav'
          ? this.normalizePathForPlatform(resolvedPath.replace(/\.[^/.]+$/, '.wav'))
          : null;

        // Validate file exists before returning
        if (typeof checkFileExists === 'function') {
          try {
            const candidates = [wavAlternative, normalized].filter(Boolean) as string[];
            const results: Array<{ path: string; exists: boolean; ext: string | null }> = [];
            for (const candidate of candidates) {
              try {
                const exists = await checkFileExists(candidate);
                results.push({ path: candidate, exists, ext: this.getFileExtension(candidate) });
              } catch (error) {
                console.warn('⚠️ Failed to validate file:// URL candidate:', candidate, error);
              }
            }

            const chosen = this.chooseWavResult(results, audioPath);
            if (chosen) {
              return chosen;
            }

            return null;
          } catch (error) {
            console.warn('⚠️ Failed to validate file:// URL path:', normalized, error);
            return null;
          }
        } else {
          if (this.getFileExtension(normalized) === 'wav') {
            this.rememberProjectDir(normalized);
            console.warn('[AudioPath] ⚠️ checkFileExists unavailable; assuming WAV path is valid', { normalized });
            return normalized;
          }
          console.error('[AudioPath] ❌ Cannot verify converted WAV for file:// URL without checkFileExists', { audioPath, normalized });
          return null;
        }
      }

      // Handle absolute paths
      if (this.isAbsolutePath(audioPath)) {
        const normalized = this.normalizePathForPlatform(audioPath);
        const ext = this.getFileExtension(normalized);
        const wavAlternative = ext && ext !== 'wav'
          ? this.normalizePathForPlatform(audioPath.replace(/\.[^/.]+$/, '.wav'))
          : null;

        // Validate file exists before returning
        if (typeof checkFileExists === 'function') {
          try {
            const candidates = [wavAlternative, normalized].filter(Boolean) as string[];
            const results: Array<{ path: string; exists: boolean; ext: string | null }> = [];
            for (const candidate of candidates) {
              try {
                const exists = await checkFileExists(candidate);
                results.push({ path: candidate, exists, ext: this.getFileExtension(candidate) });
              } catch (error) {
                console.warn('⚠️ Failed to validate absolute path candidate:', candidate, error);
              }
            }

            const chosen = this.chooseWavResult(results, audioPath);
            if (chosen) {
              return chosen;
            }

            return null;
          } catch (error) {
            console.warn('⚠️ Failed to validate absolute path:', normalized, error);
            return null;
          }
        } else {
          if (this.getFileExtension(normalized) === 'wav') {
            this.rememberProjectDir(normalized);
            console.warn('[AudioPath] ⚠️ checkFileExists unavailable; assuming absolute WAV path is valid', { normalized });
            return normalized;
          }
          console.error('[AudioPath] ❌ Cannot verify converted WAV for absolute path without checkFileExists', { audioPath, normalized });
          return null;
        }
      }

      // Handle relative paths - assume they're in the project directory
      if (audioPath && !audioPath.includes('://')) {
        console.log('🎵 Processing relative path:', audioPath);

        const candidates: string[] = [];
        const pushCandidate = (candidate?: string | null) => {
          if (candidate && !candidates.includes(candidate)) {
            candidates.push(candidate);
          }
        };

        const ext = this.getFileExtension(audioPath);
        const wavVariant = ext && ext !== 'wav'
          ? audioPath.replace(/\.[^/.]+$/, '.wav')
          : null;

        if (this.projectDirectory && pathApi) {
          const projectDir = pathApi.dirname(this.projectDirectory);
          const sanitizedRelative = audioPath.replace(/^Audio Files[\/\\]/i, '').replace(/^[./\\]+/, '');
          const audioFileName = pathApi.basename(audioPath);
          const wavFileName = wavVariant ? pathApi.basename(wavVariant) : null;

          const projectCandidates = [
            pathApi.join(projectDir, audioPath),
            pathApi.join(projectDir, sanitizedRelative),
            pathApi.join(projectDir, 'Audio Files', audioFileName),
          ];
          projectCandidates.forEach(candidate => pushCandidate(pathApi.normalize(candidate)));

          if (wavVariant && wavFileName) {
            const wavProjectCandidates = [
              pathApi.join(projectDir, wavVariant),
              pathApi.join(projectDir, sanitizedRelative.replace(audioFileName, wavFileName)),
              pathApi.join(projectDir, 'Audio Files', wavFileName),
            ];
            wavProjectCandidates.forEach(candidate => pushCandidate(pathApi.normalize(candidate)));
          }

          console.log('🎵 Generated project-based candidates:', {
            audioPath,
            projectDirectory: this.projectDirectory,
            projectDir,
            projectCandidates,
          });
        }

        const resolvedFromCache = this.resolveRelativeToProject(audioPath);
        if (resolvedFromCache) {
          pushCandidate(resolvedFromCache);
        }
        if (wavVariant) {
          const wavFromCache = this.resolveRelativeToProject(wavVariant);
          if (wavFromCache) {
            pushCandidate(wavFromCache);
          }
        }

        // Legacy fallback locations (maintained for compatibility during migration)
        [
          `/Users/chrismcleod/Development/ClaudeAccess/Working Audio/${audioPath}`,
          `/Users/chrismcleod/Development/ChatAppAccess/Working Audio/${audioPath}`,
          `/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/audio/${audioPath}`,
          `/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/${audioPath}`,
        ].forEach(candidate => pushCandidate(candidate));

        if (wavVariant) {
          pushCandidate(wavVariant);
        }
        pushCandidate(audioPath);

        console.log('🎵 Testing candidates for existence:', candidates);

        if (typeof checkFileExists === 'function') {
          const uniqueCandidates = Array.from(new Set(candidates.map(candidate => this.normalizePathForPlatform(candidate))));
          const results: Array<{ path: string; exists: boolean; ext: string | null }> = [];
          for (const candidate of uniqueCandidates) {
            try {
              const exists = await checkFileExists(candidate);
              results.push({ path: candidate, exists, ext: this.getFileExtension(candidate) });
            } catch (error) {
              console.warn('⚠️ Failed to check candidate:', candidate, error);
            }
          }

          const chosen = this.chooseWavResult(results, audioPath);
          if (chosen) {
            return chosen;
          }

          return null;
        } else {
          console.warn('⚠️ checkFileExists API not available, scanning candidates for WAV suffix');
          const manualWav = candidates.find(candidate => this.getFileExtension(candidate) === 'wav');
          if (manualWav) {
            const fallback = this.normalizePathForPlatform(manualWav);
            this.rememberProjectDir(fallback);
            return fallback;
          }
          console.error('[AudioPath] ❌ Unable to locate converted WAV without filesystem checks', { audioPath, candidates });
        }

        return null;
      }

      return null;
    } catch (err) {
      console.error('🔥 Error resolving audio path:', err);
      return null;
    }
  }

  private isAbsolutePath(p: string): boolean {
    if (!p) return false;
    return p.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p) || /^\/\//.test(p);
  }

  private chooseWavResult(
    results: Array<{ path: string; exists: boolean; ext: string | null }>,
    audioPath: string
  ): string | null {
    if (!results.length) {
      console.error('[AudioPath] ❌ No candidates returned for audio path', { audioPath });
      return null;
    }

    const existing = results.filter(r => r.exists);
    const wavCandidate = existing.find(r => r.ext === 'wav');

    if (wavCandidate) {
      const rejected = existing.filter(r => r.path !== wavCandidate.path);
      const rejectedMp3 = rejected.filter(r => r.ext === 'mp3').map(r => r.path);
      if (rejectedMp3.length > 0) {
        console.log('[AudioPath] chosen = WAV (48k), rejected = MP3 (44.1k)', {
          chosen: wavCandidate.path,
          rejectedMp3,
          otherRejected: rejected.filter(r => r.ext !== 'mp3').map(r => ({ path: r.path, ext: r.ext })),
        });
      } else {
        console.log('[AudioPath] chosen = WAV (48k)', {
          chosen: wavCandidate.path,
          rejected: rejected.map(r => ({ path: r.path, ext: r.ext })),
        });
      }
      this.rememberProjectDir(wavCandidate.path);
      return wavCandidate.path;
    }

    if (existing.length > 0) {
      console.error('[AudioPath] ❌ Converted 48k WAV missing', {
        audioPath,
        existing: existing.map(r => ({ path: r.path, ext: r.ext })),
      });
    } else {
      console.error('[AudioPath] ❌ No candidate files exist', { audioPath, candidates: results.map(r => r.path) });
    }

    return null;
  }

  private normalizePathForPlatform(p: string): string {
    if (!p) return p;
    const hasWindowsDrive = /^[a-zA-Z]:[\\/]/.test(p);
    const isUnc = /^\\\\/.test(p) || /^\/\//.test(p);

    if (hasWindowsDrive || isUnc) {
      return p.replace(/\//g, '\\');
    }

    return p;
  }

  private rememberProjectDir(fullPath: string): void {
    if (!fullPath) return;

    const normalized = fullPath.replace(/\\/g, '/');
    if (!this.isAbsolutePath(normalized)) {
      return;
    }
    const lower = normalized.toLowerCase();
    let base = normalized;

    const audioDirIndex = lower.lastIndexOf('/audio files');
    if (audioDirIndex >= 0) {
      base = normalized.substring(0, audioDirIndex);
    } else {
      const lastSlash = normalized.lastIndexOf('/');
      if (lastSlash >= 0) {
        base = normalized.substring(0, lastSlash);
      }
    }

    const isWindows = /^[a-zA-Z]:/.test(base);
    this.lastResolvedProjectDir = { base, isWindows };
  }

  private resolveRelativeToProject(relativePath: string): string | null {
    if (!relativePath || !this.lastResolvedProjectDir) {
      return null;
    }

    const sanitized = relativePath.replace(/^[./\\]+/, '').replace(/\\/g, '/');
    const base = this.lastResolvedProjectDir.base;
    const combined = `${base}/${sanitized}`.replace(/\/+/g, '/');

    if (this.lastResolvedProjectDir.isWindows) {
      return combined.replace(/\//g, '\\');
    }

    return combined;
  }

  // ==================== Utilities ====================

  /**
   * Get segment at specific time for external use
   */
  public getSegmentAtTime(time: number): SegmentLookupEntry | null {
    if (!this.currentEDL) return null;
    return EDLBuilderService.findSegmentAtTime(this.currentEDL.lookupTable, time);
  }

  /**
   * Convert between time domains
   */
  public convertTime(time: number, fromOriginal: boolean): number | null {
    if (!this.currentEDL) return null;

    if (fromOriginal) {
      return EDLBuilderService.originalToContiguousTime(this.currentEDL.clips, time);
    } else {
      return EDLBuilderService.contiguousToOriginalTime(this.currentEDL.clips, time);
    }
  }

  /**
   * Get current EDL summary for debugging
   */
  public getEDLSummary(): string {
    if (!this.currentEDL) return 'No EDL loaded';
    return EDLBuilderService.getEDLSummary(this.currentEDL);
  }

  private isEventGenerationCurrent(eventGeneration?: number | null): boolean {
    if (this.currentGenerationId === 0) {
      return true;
    }
    if (typeof eventGeneration !== 'number') {
      return false;
    }
    return eventGeneration === this.currentGenerationId;
  }

  private getFileExtension(filePath: string): string | null {
    if (!filePath) {
      return null;
    }
    const match = /\.([a-z0-9]+)$/i.exec(filePath);
    return match ? match[1].toLowerCase() : null;
  }
}