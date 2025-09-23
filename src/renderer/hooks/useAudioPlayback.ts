/**
 * useAudioPlayback - Unified audio playback hook
 *
 * Connects JuceAudioManagerV2 to React components, providing centralized
 * playback state and controls across all modes (Listen, Edit Text, Edit Audio).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { JuceAudioManagerV2, AudioStateV2, AudioCallbacksV2 } from '../audio/JuceAudioManagerV2';
import { Clip } from '../../shared/types';

// ==================== Types ====================

export interface PlaybackState {
  // Playback state
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  originalTime: number;
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

export interface PlaybackControls {
  // Basic controls
  play: () => Promise<void>;
  pause: () => Promise<void>;
  toggle: () => Promise<void>;
  seek: (time: number, isOriginalTime?: boolean) => Promise<void>;

  // Audio settings
  setVolume: (volume: number) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;

  // Clip navigation
  skipToClipStart: () => Promise<void>;
  skipToClipEnd: () => Promise<void>;
  seekToClip: (clipId: string) => Promise<void>;

  // Lifecycle
  loadAudio: (audioPath: string) => Promise<void>;
  updateClips: (clips: Clip[]) => Promise<void>;
  dispose: () => void;
}

export interface UseAudioPlaybackReturn {
  state: PlaybackState;
  controls: PlaybackControls;
}

// ==================== Hook Implementation ====================

export function useAudioPlayback(clips: Clip[] = []): UseAudioPlaybackReturn {
  console.log('🎵 useAudioPlayback: Hook initializing with clips:', clips.length);

  // Load persisted settings
  const getPersistedSettings = () => {
    try {
      const saved = localStorage.getItem('audioPlaybackSettings');
      const settings = saved ? JSON.parse(saved) : {};
      console.log('🎵 useAudioPlayback: Persisted settings loaded:', settings);
      return settings;
    } catch (error) {
      console.warn('🎵 useAudioPlayback: Failed to load persisted settings:', error);
      return {};
    }
  };

  const persistedSettings = getPersistedSettings();

  // State
  const [state, setState] = useState<PlaybackState>({
    isPlaying: false,
    isLoading: false,
    currentTime: persistedSettings.currentTime || 0,
    originalTime: 0,
    duration: 0,
    volume: persistedSettings.volume || 1.0,
    playbackRate: persistedSettings.playbackRate || 1.0,
    currentClipId: null,
    currentSegmentIndex: null,
    isReady: false,
    error: null
  });

  // JUCE Audio Manager reference
  const audioManagerRef = useRef<JuceAudioManagerV2 | null>(null);
  const clipsRef = useRef<Clip[]>(clips);

  // Update clips ref when clips change
  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  // Persist settings when they change
  useEffect(() => {
    try {
      const settingsToPersist = {
        currentTime: state.currentTime,
        volume: state.volume,
        playbackRate: state.playbackRate
      };
      localStorage.setItem('audioPlaybackSettings', JSON.stringify(settingsToPersist));
    } catch (error) {
      console.warn('Failed to persist audio settings:', error);
    }
  }, [state.currentTime, state.volume, state.playbackRate]);

  // Calculate total duration from clips
  const calculateTotalDuration = useCallback((clips: Clip[]): number => {
    if (clips.length === 0) return 0;
    const activeClips = clips.filter(clip => clip.status === 'active');
    if (activeClips.length === 0) return 0;

    const sortedClips = activeClips.sort((a, b) => a.order - b.order);
    const lastClip = sortedClips[sortedClips.length - 1];
    return lastClip.endTime;
  }, []);

  // Find current clip and segment
  const findCurrentClipAndSegment = useCallback((currentTime: number, clips: Clip[]) => {
    for (const clip of clips) {
      if (clip.status !== 'active') continue;

      if (currentTime >= clip.startTime && currentTime < clip.endTime) {
        const clipRelativeTime = currentTime - clip.startTime;

        for (let i = 0; i < clip.segments.length; i++) {
          const segment = clip.segments[i];
          if (clipRelativeTime >= segment.start && clipRelativeTime < segment.end) {
            return { clipId: clip.id, segmentIndex: i };
          }
        }

        // If we're in the clip but not in a specific segment, return the clip ID
        return { clipId: clip.id, segmentIndex: null };
      }
    }

    return { clipId: null, segmentIndex: null };
  }, []);

  // Initialize audio manager
  useEffect(() => {
    console.log('🎵 useAudioPlayback: Initializing audio manager...');

    if (audioManagerRef.current) {
      console.log('🎵 useAudioPlayback: Audio manager already exists, skipping initialization');
      return;
    }

    // Check JUCE transport availability
    const juceTransport = (window as any).juceTransport;
    console.log('🎵 useAudioPlayback: JUCE transport available:', !!juceTransport);
    if (juceTransport) {
      console.log('🎵 useAudioPlayback: JUCE transport methods:', Object.keys(juceTransport));
    }

    const callbacks: AudioCallbacksV2 = {
      onStateChange: (audioState: AudioStateV2) => {
        const totalDuration = calculateTotalDuration(clipsRef.current);
        const { clipId, segmentIndex } = findCurrentClipAndSegment(audioState.currentTime, clipsRef.current);

        setState(prevState => ({
          ...prevState,
          isPlaying: audioState.isPlaying,
          isLoading: audioState.isLoading,
          currentTime: audioState.currentTime,
          originalTime: audioState.originalTime,
          duration: totalDuration > 0 ? totalDuration : audioState.duration,
          volume: audioState.volume,
          playbackRate: audioState.playbackRate,
          currentClipId: clipId,
          currentSegmentIndex: segmentIndex,
          isReady: audioState.isReady,
          error: audioState.error
        }));
      },

      onSegmentHighlight: (clipId: string | null, segmentIndex: number | null) => {
        setState(prevState => ({
          ...prevState,
          currentClipId: clipId,
          currentSegmentIndex: segmentIndex
        }));
      },

      onError: (error: string) => {
        setState(prevState => ({
          ...prevState,
          error,
          isLoading: false
        }));
      }
    };

    try {
      audioManagerRef.current = new JuceAudioManagerV2(callbacks);
      console.log('🎵 useAudioPlayback: Audio Manager successfully initialized');
    } catch (error) {
      console.error('🎵 useAudioPlayback: Failed to initialize Audio Manager:', error);
      setState(prevState => ({
        ...prevState,
        error: error instanceof Error ? error.message : String(error)
      }));
    }

    return () => {
      if (audioManagerRef.current) {
        console.log('🎵 useAudioPlayback: Disposing audio manager');
        audioManagerRef.current.dispose();
        audioManagerRef.current = null;
      }
    };
  }, [calculateTotalDuration, findCurrentClipAndSegment]);

  // Update clips when they change
  useEffect(() => {
    if (audioManagerRef.current && clips.length > 0) {
      console.log('🎵 useAudioPlayback: Updating clips, count:', clips.length);
      audioManagerRef.current.updateClips(clips).catch(error => {
        console.error('Failed to update clips:', error);
        setState(prevState => ({
          ...prevState,
          error: error instanceof Error ? error.message : String(error)
        }));
      });
    } else if (clips.length > 0 && !audioManagerRef.current) {
      console.warn('🎵 useAudioPlayback: Clips provided but audio manager not initialized');
    }
  }, [clips]);

  // Control functions
  const controls: PlaybackControls = {
    play: useCallback(async () => {
      if (!audioManagerRef.current) {
        throw new Error('Audio manager not initialized');
      }
      await audioManagerRef.current.play();
    }, []),

    pause: useCallback(async () => {
      if (!audioManagerRef.current) {
        throw new Error('Audio manager not initialized');
      }
      await audioManagerRef.current.pause();
    }, []),

    toggle: useCallback(async () => {
      if (!audioManagerRef.current) {
        console.warn('🎵 Cannot toggle playback: Audio manager not initialized');
        throw new Error('Audio manager not initialized');
      }
      if (!state.isReady) {
        console.warn('🎵 Cannot toggle playback: Audio not ready');
        throw new Error('Audio not ready for playback');
      }
      console.log('🎵 Toggling playback:', state.isPlaying ? 'pause' : 'play');
      if (state.isPlaying) {
        await audioManagerRef.current.pause();
      } else {
        await audioManagerRef.current.play();
      }
    }, [state.isPlaying, state.isReady]),

    seek: useCallback(async (time: number, isOriginalTime: boolean = false) => {
      if (!audioManagerRef.current) {
        throw new Error('Audio manager not initialized');
      }
      await audioManagerRef.current.seek(time, isOriginalTime);
    }, []),

    setVolume: useCallback(async (volume: number) => {
      if (!audioManagerRef.current) {
        throw new Error('Audio manager not initialized');
      }
      await audioManagerRef.current.setVolume(volume);
    }, []),

    setPlaybackRate: useCallback(async (rate: number) => {
      if (!audioManagerRef.current) {
        throw new Error('Audio manager not initialized');
      }
      await audioManagerRef.current.setPlaybackRate(rate);
    }, []),

    skipToClipStart: useCallback(async () => {
      if (!state.currentClipId || !clipsRef.current || !audioManagerRef.current) return;

      const currentClip = clipsRef.current.find(clip => clip.id === state.currentClipId);
      if (currentClip) {
        await audioManagerRef.current.seek(currentClip.startTime);
      }
    }, [state.currentClipId]),

    skipToClipEnd: useCallback(async () => {
      if (!state.currentClipId || !clipsRef.current || !audioManagerRef.current) return;

      const currentClip = clipsRef.current.find(clip => clip.id === state.currentClipId);
      if (currentClip) {
        await audioManagerRef.current.seek(currentClip.endTime);
      }
    }, [state.currentClipId]),

    seekToClip: useCallback(async (clipId: string) => {
      if (!audioManagerRef.current) return;

      const clip = clipsRef.current.find(c => c.id === clipId);
      if (clip) {
        await audioManagerRef.current.seek(clip.startTime);
      }
    }, []),

    loadAudio: useCallback(async (audioPath: string) => {
      if (!audioManagerRef.current) {
        throw new Error('Audio manager not initialized');
      }

      setState(prevState => ({
        ...prevState,
        isLoading: true,
        error: null
      }));

      try {
        await audioManagerRef.current.initialize(audioPath);
        console.log('🎵 Audio loaded:', audioPath);
      } catch (error) {
        console.error('Failed to load audio:', error);
        setState(prevState => ({
          ...prevState,
          error: error instanceof Error ? error.message : String(error),
          isLoading: false
        }));
        throw error;
      }
    }, []),

    updateClips: useCallback(async (newClips: Clip[]) => {
      if (!audioManagerRef.current) return;

      try {
        await audioManagerRef.current.updateClips(newClips);
        console.log('🎵 Clips updated:', newClips.length);
      } catch (error) {
        console.error('Failed to update clips:', error);
        setState(prevState => ({
          ...prevState,
          error: error instanceof Error ? error.message : String(error)
        }));
        throw error;
      }
    }, []),

    dispose: useCallback(() => {
      if (audioManagerRef.current) {
        audioManagerRef.current.dispose();
        audioManagerRef.current = null;
        setState({
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
        });
      }
    }, [])
  };

  return {
    state,
    controls
  };
}

export default useAudioPlayback;