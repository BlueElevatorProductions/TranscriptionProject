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
  private edlRevisionCounter: number = 0;

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
      error: null
    };

    this.initializeJuceEventHandling();
  }

  // ==================== Public API ====================

  /**
   * Initialize audio with file path
   */
  public async initialize(audioPath: string): Promise<void> {
    // Prevent multiple concurrent initializations
    if (this.isInitializing) {
      console.warn('🎵 Initialize already in progress, ignoring duplicate call');
      return;
    }

    // Check error cooldown to prevent rapid retry attempts
    const now = Date.now();
    if (this.lastErrorTime > 0 && now - this.lastErrorTime < this.errorCooldown) {
      console.warn('🎵 Initialize blocked due to error cooldown');
      return;
    }

    // Don't retry the same failed path immediately
    if (this.lastFailedPath === audioPath && now - this.lastErrorTime < this.errorCooldown) {
      console.warn('🎵 Skipping retry of recently failed path:', audioPath);
      return;
    }

    this.isInitializing = true;

    try {
      // Resolve the audio path to an absolute path that JUCE can use
      const resolvedPath = await this.resolveAudioPath(audioPath);
      if (!resolvedPath) {
        throw new Error(`Unable to resolve audio path: ${audioPath}`);
      }

      this.audioPath = resolvedPath;
      this.updateState({ isLoading: true, error: null });

      if (!this.transport) {
        throw new Error('JUCE transport not available');
      }

      console.info('[AudioManager] Loading audio with resolved path:', { original: audioPath, resolved: resolvedPath });
      await this.loadFile(this.sessionId, resolvedPath);

      // Reset playback rate to sane default after every load
      try {
        await this.transport.setRate(this.sessionId, 1.0);
        this.updateState({ playbackRate: 1.0 });
      } catch (error) {
        console.warn('🎵 Failed to reset playback rate after load:', error);
      }

      this.updateState({
        isLoading: false,
        // NOTE: Do NOT set isReady: true here - wait for JUCE 'loaded' event confirmation
        error: null
      });

      // Clear error tracking on success
      this.lastFailedPath = null;
      this.lastErrorTime = 0;

      // Pending clips will be flushed by the 'loaded' event handler via flushPendingClips()
      console.log('🎵 ✅ JUCE audio load initiated successfully:', resolvedPath);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Track failed path and error time
      this.lastFailedPath = audioPath;
      this.lastErrorTime = Date.now();

      this.updateState({
        isLoading: false,
        isReady: false,
        error: errorMessage
      });

      console.error('🔥 Failed to initialize audio:', errorMessage);
      this.callbacks.onError(errorMessage);
    } finally {
      this.isInitializing = false;
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

      // Increment revision for tracking
      const revision = ++this.edlRevisionCounter;
      console.info(`[AudioManager] Sending EDL to JUCE (revision ${revision})`);

      const result = await this.transport.updateEdl(this.sessionId, revision, legacyClips);
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
   * Flush pending clips that were cached while JUCE was not ready
   */
  private async flushPendingClips(): Promise<void> {
    if (!this.pendingClips || this.pendingClips.length === 0) {
      return;
    }

    console.info('[AudioManager] flushing cached clips', this.pendingClips.length);
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

  /**
   * Load audio file into JUCE backend
   */
  private async loadFile(sessionId: string, filePath: string): Promise<void> {
    if (!this.transport) {
      throw new Error('JUCE transport not available');
    }

    try {
      console.info('[AudioManager] calling juceTransport.load', filePath);
      const result = await this.transport.load(sessionId, filePath);
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
    switch (event.type) {
      case 'loaded': {
        console.info('[JUCE] transport loaded', {
          durationSec: event.durationSec,
          sampleRate: (event as any).sampleRate,
          channels: (event as any).channels
        });
        this.updateState({
          isLoading: false,
          isReady: true,
          duration: typeof event.durationSec === 'number' ? event.durationSec : this.state.duration,
          sampleRate: typeof (event as any).sampleRate === 'number' ? (event as any).sampleRate : this.state.sampleRate,
          channels: typeof (event as any).channels === 'number' ? (event as any).channels : this.state.channels,
          error: null
        });
        // Now that JUCE is ready, flush any pending clips
        this.flushPendingClips();
        break;
      }

      case 'state': {
        this.updateState({
          isPlaying: !!event.playing,
          isLoading: false,
          isReady: true,
          error: null
        });
        break;
      }

      case 'position': {
        this.handlePositionEvent(event);
        break;
      }

      case 'edlApplied': {
        const expectedRevision = this.edlRevisionCounter;
        console.info(`[AudioManager] EDL applied by JUCE (revision ${event.revision}, expected ${expectedRevision})`);
        if (event.revision !== expectedRevision) {
          console.warn('[AudioManager] ⚠️ EDL revision mismatch!', {
            received: event.revision,
            expected: expectedRevision
          });
        }
        this.processPendingSeek();
        break;
      }

      case 'ended':
        this.updateState({ isPlaying: false });
        break;

      case 'error': {
        const details = event.code != null ? `${event.message} (code: ${event.code})` : event.message;

        // Don't set isReady to false if we're currently initializing
        // This prevents re-initialization loops
        if (!this.isInitializing) {
          this.updateState({ isPlaying: false, isLoading: false, isReady: false });
        } else {
          this.updateState({ isPlaying: false, isLoading: false });
        }

        this.handleError('JUCE transport error', details);
        break;
      }

      default:
        // Ignore unknown events
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

        // Validate file exists before returning
        if (typeof checkFileExists === 'function') {
          try {
            const exists = await checkFileExists(normalized);
            if (exists) {
              this.rememberProjectDir(normalized);
              console.log('✅ Resolved file:// URL to existing file:', normalized);
              return normalized;
            } else {
              console.warn('❌ file:// URL resolved to non-existent file:', normalized);
              return null;
            }
          } catch (error) {
            console.warn('⚠️ Failed to validate file:// URL path:', normalized, error);
            return null;
          }
        } else {
          // Fallback without validation
          this.rememberProjectDir(normalized);
          return normalized;
        }
      }

      // Handle absolute paths
      if (this.isAbsolutePath(audioPath)) {
        const normalized = this.normalizePathForPlatform(audioPath);

        // Validate file exists before returning
        if (typeof checkFileExists === 'function') {
          try {
            const exists = await checkFileExists(normalized);
            if (exists) {
              this.rememberProjectDir(normalized);
              console.log('✅ Validated absolute path:', normalized);
              return normalized;
            } else {
              console.warn('❌ Absolute path does not exist:', normalized);
              return null;
            }
          } catch (error) {
            console.warn('⚠️ Failed to validate absolute path:', normalized, error);
            return null;
          }
        } else {
          // Fallback without validation
          this.rememberProjectDir(normalized);
          return normalized;
        }
      }

      // Handle relative paths - assume they're in the project directory
      if (audioPath && !audioPath.includes('://')) {
        console.log('🎵 Processing relative path:', audioPath);

        const candidates: string[] = [];

        // First try using the projectDirectory if available
        if (this.projectDirectory && pathApi) {
          const projectDir = pathApi.dirname(this.projectDirectory);
          const sanitizedRelative = audioPath.replace(/^Audio Files[\/\\]/i, '').replace(/^[./\\]+/, '');
          const audioFileName = pathApi.basename(audioPath);

          const projectCandidates = [
            pathApi.join(projectDir, audioPath),
            pathApi.join(projectDir, sanitizedRelative),
            pathApi.join(projectDir, 'Audio Files', audioFileName)
          ].map(candidate => pathApi.normalize(candidate));

          candidates.push(...projectCandidates);

          console.log('🎵 Generated project-based candidates:', {
            audioPath,
            projectDirectory: this.projectDirectory,
            projectDir,
            projectCandidates
          });
        }

        // Add cache-based resolution
        const resolvedFromCache = this.resolveRelativeToProject(audioPath);
        if (resolvedFromCache) {
          candidates.push(resolvedFromCache);
        }

        // Legacy fallback locations (maintained for compatibility during migration)
        candidates.push(
          `/Users/chrismcleod/Development/ClaudeAccess/Working Audio/${audioPath}`,
          `/Users/chrismcleod/Development/ChatAppAccess/Working Audio/${audioPath}`,
          `/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/audio/${audioPath}`,
          `/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/${audioPath}`,
        );

        // Always include the original relative path last as a fallback
        candidates.push(audioPath);

        console.log('🎵 Testing candidates for existence:', candidates);

        // Validate each candidate and return the first one that exists
        if (typeof checkFileExists === 'function') {
          for (const candidate of candidates) {
            const normalizedCandidate = this.normalizePathForPlatform(candidate);
            try {
              const exists = await checkFileExists(normalizedCandidate);
              if (exists) {
                this.rememberProjectDir(normalizedCandidate);
                console.log('✅ Found existing file:', normalizedCandidate);
                return normalizedCandidate;
              } else {
                console.log('❌ Candidate does not exist:', normalizedCandidate);
              }
            } catch (error) {
              console.warn('⚠️ Failed to check candidate:', normalizedCandidate, error);
            }
          }

          // No valid candidates found
          console.error('❌ No valid audio file found for path:', audioPath);
          console.error('❌ Checked candidates:', candidates);
          return null;
        } else {
          // Without checkFileExists API, return the first candidate as fallback
          console.warn('⚠️ checkFileExists API not available, using first candidate without validation');
          if (candidates.length > 0) {
            const fallback = this.normalizePathForPlatform(candidates[0]);
            this.rememberProjectDir(fallback);
            return fallback;
          }
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
}