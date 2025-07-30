import React, { useState } from 'react';
import './AudioControlsPanel.css';

interface AudioControlsPanelProps {
  mode: 'playback' | 'transcript-edit';
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume?: number;
  playbackSpeed?: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange?: (volume: number) => void;
  onSpeedChange?: (speed: number) => void;
  onSkipBack?: () => void;
  onSkipForward?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

const AudioControlsPanel: React.FC<AudioControlsPanelProps> = ({
  mode,
  currentTime,
  duration,
  isPlaying,
  volume = 0.7,
  playbackSpeed = 1.0,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onSpeedChange,
  onSkipBack,
  onSkipForward,
  onPrevious,
  onNext
}) => {
  const [speeds] = useState(['0.5×', '0.75×', '1.0×', '1.25×', '1.5×', '2.0×']);
  const [currentSpeedIndex, setCurrentSpeedIndex] = useState(() => {
    const index = speeds.findIndex(speed => parseFloat(speed.replace('×', '')) === playbackSpeed);
    return index >= 0 ? index : 2;
  });

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    onSeek(newTime);
  };

  const handleSpeedClick = () => {
    const nextIndex = (currentSpeedIndex + 1) % speeds.length;
    setCurrentSpeedIndex(nextIndex);
    const newSpeed = parseFloat(speeds[nextIndex].replace('×', ''));
    onSpeedChange?.(newSpeed);
  };

  const handleVolumeClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onVolumeChange?.(Math.max(0, Math.min(1, percent)));
  };

  return (
    <div className="audio-controls-panel">
      <div className="panel-header">
        <h3>Audio Controls</h3>
      </div>
      
      {/* Time Display */}
      <div className="time-display">
        <span className="current-time">{formatTime(currentTime)}</span>
        <span className="total-time">{formatTime(duration)}</span>
      </div>

      {/* Progress Bar */}
      <div className="progress-container" onClick={handleProgressClick}>
        <div className="progress-track">
          <div 
            className="progress-fill" 
            style={{ width: `${progressPercent}%` }}
          >
            <div className="progress-handle"></div>
          </div>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="transport-controls">
        {onPrevious && (
          <button className="transport-btn" onClick={onPrevious} title="Previous Clip">
            <span className="btn-icon prev-icon">⏮</span>
          </button>
        )}
        
        {onSkipBack && (
          <button className="transport-btn skip-btn" onClick={onSkipBack} title="Skip Back 10s">
            <span className="btn-icon">⏪</span>
          </button>
        )}

        <button 
          className={`transport-btn play-btn ${isPlaying ? 'playing' : ''}`} 
          onClick={onPlayPause} 
          title="Play/Pause"
        >
          <span className={`btn-icon ${isPlaying ? 'pause-icon' : 'play-icon'}`}></span>
        </button>

        {onSkipForward && (
          <button className="transport-btn skip-btn" onClick={onSkipForward} title="Skip Forward 10s">
            <span className="btn-icon">⏩</span>
          </button>
        )}

        {onNext && (
          <button className="transport-btn" onClick={onNext} title="Next Clip">
            <span className="btn-icon next-icon">⏭</span>
          </button>
        )}
      </div>

      {/* Volume Control */}
      {onVolumeChange && (
        <div className="volume-control">
          <span className="volume-icon">🔊</span>
          <div className="volume-slider" onClick={handleVolumeClick}>
            <div className="volume-fill" style={{ width: `${volume * 100}%` }}></div>
          </div>
          <span className="volume-value">{Math.round(volume * 100)}%</span>
        </div>
      )}

      {/* Playback Speed */}
      {onSpeedChange && (
        <div className="playback-speed">
          <span className="speed-label">Speed:</span>
          <div className="speed-control" onClick={handleSpeedClick}>
            {speeds[currentSpeedIndex]}
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioControlsPanel;