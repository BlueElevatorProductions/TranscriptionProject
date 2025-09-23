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

  // Audio settings
  volume: number;
  playbackRate: number;

  // Clip state
  currentClipId: string | null;
  currentSegmentIndex: number | null;

  // System state
  isReady: boolean;
  error: string | null;
}

export interface AudioCallbacksV2 {
  onStateChange: (state: AudioStateV2) => void;
  onSegmentHighlight: (clipId: string | null, segmentIndex: number | null) => void;
  onError: (error: string) => void;
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

  constructor(callbacks: AudioCallbacksV2) {
    this.callbacks = callbacks;
    this.state = {
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      originalTime: 0,
      duration: 0,
      volume: 1.0,
      playbackRate: 1.0,
      currentClipId: null,
      currentSegmentIndex: null,
      isReady: false,
      error: null
    };

    this.initializeJuceEventHandling();
  }

  // ==================== Public API ====================

  /**
   * Initialize audio with file path
   */
  public async initialize(audioPath: string): Promise<void> {
    try {
      this.audioPath = audioPath;
      this.updateState({ isLoading: true, error: null });

      if (!this.transport) {
        throw new Error('JUCE transport not available');
      }

      const result = await this.transport.load(this.sessionId, audioPath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to load audio');
      }

      this.updateState({
        isLoading: false,
        isReady: true,
        error: null
      });

      console.log('🎵 JUCE audio initialized:', audioPath);

      // Apply any pending clips that were cached while JUCE was not ready
      if (this.pendingClips && this.pendingClips.length > 0) {
        console.log('🎵 Applying pending clips after initialization:', this.pendingClips.length);
        const clipsToApply = this.pendingClips;
        this.pendingClips = null; // Clear cache before applying to avoid recursion
        await this.updateClips(clipsToApply);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.updateState({
        isLoading: false,
        isReady: false,
        error: errorMessage
      });
      this.callbacks.onError(errorMessage);
    }
  }

  /**
   * Update clips with new EDL
   */
  public async updateClips(clips: Clip[]): Promise<void> {
    try {
      if (!this.transport || !this.state.isReady) {
        console.warn('⚠️ Cannot update clips: JUCE not ready, caching for later application');
        this.pendingClips = [...clips]; // Cache clips for later
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

      const result = await this.transport.updateEdl(this.sessionId, legacyClips);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update EDL');
      }

      // Update duration from EDL
      this.updateState({
        duration: this.currentEDL.metadata.totalDuration,
        error: null
      });

      console.log('🎬 EDL updated:', EDLBuilderService.getEDLSummary(this.currentEDL));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.updateState({ error: errorMessage });
      this.callbacks.onError(errorMessage);
    } finally {
      this.isApplyingEDL = false;

      // Process any pending seek intent
      this.processPendingSeek();
    }
  }

  /**
   * Play audio
   */
  public async play(): Promise<void> {
    if (!this.transport || !this.state.isReady) return;

    try {
      const result = await this.transport.play(this.sessionId);
      if (result.success) {
        this.updateState({ isPlaying: true, error: null });
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

    try {
      const result = await this.transport.pause(this.sessionId);
      if (result.success) {
        this.updateState({ isPlaying: false });
      }
    } catch (error) {
      this.handleError('Pause failed', error);
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
      const result = await this.transport.setVolume(this.sessionId, volume);
      if (result.success) {
        this.updateState({ volume });
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
      const result = await this.transport.setRate(this.sessionId, rate);
      if (result.success) {
        this.updateState({ playbackRate: rate });
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
    if (this.eventHandler && this.transport) {
      this.transport.offEvent(this.eventHandler);
    }
    this.currentEDL = null;
    this.lastSeekIntent = null;
    this.pendingClips = null;
  }

  // ==================== Private Methods ====================

  private initializeJuceEventHandling(): void {
    if (!this.transport) return;

    this.eventHandler = (event: JuceEvent) => {
      this.handleJuceEvent(event);
    };

    this.transport.onEvent(this.eventHandler);
  }

  private handleJuceEvent(event: JuceEvent): void {
    switch (event.type) {
      case 'position':
        this.handlePositionEvent(event.data);
        break;

      case 'playbackStarted':
        this.updateState({ isPlaying: true });
        break;

      case 'playbackStopped':
      case 'playbackPaused':
        this.updateState({ isPlaying: false });
        break;

      case 'edlApplied':
        console.log('✅ EDL applied by JUCE');
        this.processPendingSeek();
        break;

      default:
        // Ignore unknown events
        break;
    }
  }

  private handlePositionEvent(data: any): void {
    if (!this.currentEDL) return;

    const { editedTime, originalSec } = data;
    const contiguousTime = editedTime || 0;
    const originalTime = originalSec || 0;

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

    const result = await this.transport.seek(this.sessionId, seekTime);
    if (!result.success) {
      throw new Error(result.error || 'Seek failed');
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
    this.state = { ...this.state, ...updates };
    this.callbacks.onStateChange(this.state);
  }

  private handleError(context: string, error: any): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = `${context}: ${errorMessage}`;

    console.error('🔥 JUCE Audio Error:', fullMessage);
    this.updateState({ error: fullMessage });
    this.callbacks.onError(fullMessage);
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
}