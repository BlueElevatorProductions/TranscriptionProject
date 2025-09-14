/**
 * SimpleAudioControls.tsx - Clean audio controls for the new system
 */

import React, { useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { AudioEditorState, AudioEditorActions } from '../hooks/useAudioEditor';

interface SimpleAudioControlsProps {
  audioState: AudioEditorState;
  audioActions: AudioEditorActions;
  className?: string;
}

export const SimpleAudioControls: React.FC<SimpleAudioControlsProps> = ({
  audioState,
  audioActions,
  className = '',
}) => {
  const handlePlayPause = useCallback(async () => {
    try {
      await audioActions.togglePlayPause();
    } catch (error) {
      console.error('Play/pause failed:', error);
    }
  }, [audioActions]);

  const handleSeekBack = useCallback(() => {
    const newTime = Math.max(0, audioState.currentTime - 10);
    audioActions.seekToTime(newTime);
  }, [audioState.currentTime, audioActions]);

  const handleSeekForward = useCallback(() => {
    const newTime = Math.min(audioState.duration, audioState.currentTime + 10);
    audioActions.seekToTime(newTime);
  }, [audioState.currentTime, audioState.duration, audioActions]);

  const handleVolumeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(event.target.value);
    audioActions.setVolume(volume);
  }, [audioActions]);

  const handleSpeedChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = parseFloat(event.target.value);
    audioActions.setPlaybackRate(rate);
  }, [audioActions]);

  const handleProgressChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(event.target.value);
    audioActions.seekToTime(time);
  }, [audioActions]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  if (!audioState.isReady) {
    return (
      <div className={`bg-gray-100 border-t p-4 ${className}`}>
        <div className="text-center text-gray-500">Audio not loaded</div>
      </div>
    );
  }

  return (
    <div className={`bg-white border-t shadow-lg p-4 ${className}`}>
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        {/* Main controls */}
        <div className="flex items-center space-x-4">
          {/* Skip back */}
          <button
            onClick={handleSeekBack}
            disabled={audioState.currentTime <= 0}
            className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Skip back 10s"
          >
            <SkipBack size={20} />
          </button>

          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            disabled={!audioState.isReady}
            className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title={audioState.isPlaying ? 'Pause' : 'Play'}
          >
            {audioState.isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>

          {/* Skip forward */}
          <button
            onClick={handleSeekForward}
            disabled={audioState.currentTime >= audioState.duration}
            className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Skip forward 10s"
          >
            <SkipForward size={20} />
          </button>
        </div>

        {/* Progress bar and time */}
        <div className="flex-1 mx-8">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-mono text-gray-600">
              {formatTime(audioState.currentTime)}
            </span>
            
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={audioState.duration}
                step="0.1"
                value={audioState.currentTime}
                onChange={handleProgressChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(audioState.currentTime / audioState.duration) * 100}%, #E5E7EB ${(audioState.currentTime / audioState.duration) * 100}%, #E5E7EB 100%)`
                }}
              />
            </div>
            
            <span className="text-sm font-mono text-gray-600">
              {formatTime(audioState.duration)}
            </span>
          </div>
        </div>

        {/* Secondary controls */}
        <div className="flex items-center space-x-4">
          {/* Speed control */}
          <select
            value={audioState.playbackRate}
            onChange={handleSpeedChange}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
            title="Playback speed"
          >
            <option value="0.5">0.5×</option>
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>

          {/* Volume control */}
          <div className="flex items-center space-x-2">
            <Volume2 size={16} className="text-gray-600" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioState.volume}
              onChange={handleVolumeChange}
              className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              title="Volume"
            />
          </div>
        </div>
      </div>

      {/* Current clip info */}
      {audioState.currentClipId && (
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-500">
            Playing clip: {audioState.currentClipId}
          </span>
        </div>
      )}
    </div>
  );
};