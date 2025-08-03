/**
 * AudioRegion.tsx - Bottom audio sliders container
 * 
 * Features:
 * - Player slider with media controls
 * - Editor slider (placeholder for future audio editing)
 * - Auto-exclusive behavior (only one slider active at a time)
 * - Resizable height with drag handle
 */

import React, { useRef, useCallback, useState } from 'react';
import './AudioRegion.css';

export interface AudioRegionProps {
  visible: boolean;
  activeSlider: 'player' | 'editor' | null;
  height: number;
  onHeightChange: (height: number) => void;
  onSliderChange: (type: 'player' | 'editor') => void;
}

// Player slider component
const PlayerSlider: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(180); // 3 minutes demo
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(0.8);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(Number(e.target.value));
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  return (
    <div className="audio-slider player-slider">
      <div className="audio-controls">
        {/* Transport controls */}
        <div className="transport-controls">
          <button 
            className="transport-button skip-back"
            title="Skip back 15s"
            aria-label="Skip back 15 seconds"
          >
            ⏪
          </button>
          
          <button 
            className="transport-button play-pause"
            onClick={handlePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <button 
            className="transport-button skip-forward"
            title="Skip forward 30s"
            aria-label="Skip forward 30 seconds"
          >
            ⏩
          </button>
        </div>

        {/* Timeline */}
        <div className="timeline-container">
          <span className="time-display current-time">
            {formatTime(currentTime)}
          </span>
          
          <input
            type="range"
            className="timeline-slider"
            min="0"
            max={duration}
            value={currentTime}
            onChange={handleSeek}
            aria-label="Audio timeline"
          />
          
          <span className="time-display total-time">
            {formatTime(duration)}
          </span>
        </div>

        {/* Additional controls */}
        <div className="additional-controls">
          {/* Speed control */}
          <div className="speed-control">
            <label className="control-label">Speed:</label>
            <div className="speed-buttons">
              {[0.5, 1, 1.5, 2].map(speed => (
                <button
                  key={speed}
                  className={`speed-button ${playbackSpeed === speed ? 'active' : ''}`}
                  onClick={() => handleSpeedChange(speed)}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Volume control */}
          <div className="volume-control">
            <label className="control-label">🔊</label>
            <input
              type="range"
              className="volume-slider"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Editor slider component (placeholder)
const EditorSlider: React.FC = () => (
  <div className="audio-slider editor-slider">
    <div className="editor-placeholder">
      <div className="placeholder-content">
        <h3>Audio Editor</h3>
        <p>Coming Soon</p>
        <div className="placeholder-features">
          <span>• Waveform visualization</span>
          <span>• Cut and trim tools</span>
          <span>• Effects and filters</span>
          <span>• Export options</span>
        </div>
      </div>
    </div>
  </div>
);

const AudioRegion: React.FC<AudioRegionProps> = ({
  visible,
  activeSlider,
  height,
  onHeightChange,
  onSliderChange
}) => {
  const resizeRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);

  // Mouse event handlers for resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    setDragStartY(e.clientY);
    setDragStartHeight(height);
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragStartY - e.clientY; // Inverted because we're resizing from top edge
      const newHeight = dragStartHeight + deltaY;
      onHeightChange(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height, onHeightChange, dragStartY, dragStartHeight]);

  // Keyboard handler for resize
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      onHeightChange(height + 10);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      onHeightChange(height - 10);
      e.preventDefault();
    }
  }, [height, onHeightChange]);

  if (!visible || !activeSlider) {
    return (
      <div className="audio-region hidden" aria-hidden="true">
        <div className="audio-collapsed">
          <div className="slider-tabs">
            <button 
              className="slider-tab"
              onClick={() => onSliderChange('player')}
              aria-label="Show audio player"
            >
              player ∧∧
            </button>
            <button 
              className="slider-tab disabled"
              onClick={() => onSliderChange('editor')}
              aria-label="Show audio editor (coming soon)"
              disabled
            >
              editor ∧∧
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="audio-region"
      style={{ height: `${height}px` }}
      data-resizing={isResizing}
      data-active-slider={activeSlider}
    >
      {/* Resize handle */}
      <div
        ref={resizeRef}
        className="resize-handle"
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize audio area height"
        aria-valuenow={height}
        aria-valuemin={80}
        aria-valuemax={300}
      >
        <div className="resize-handle-visual" />
      </div>

      {/* Slider tabs */}
      <div className="slider-tabs">
        <button 
          className={`slider-tab ${activeSlider === 'player' ? 'active' : ''}`}
          onClick={() => onSliderChange('player')}
        >
          player ∨∨
        </button>
        <button 
          className={`slider-tab ${activeSlider === 'editor' ? 'active' : ''} disabled`}
          onClick={() => onSliderChange('editor')}
          disabled
        >
          editor ∨∨
        </button>
      </div>

      {/* Active slider content */}
      <div className="slider-content">
        {activeSlider === 'player' && <PlayerSlider />}
        {activeSlider === 'editor' && <EditorSlider />}
      </div>
    </div>
  );
};

export default AudioRegion;