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
// import { Button, Tooltip } from '@chakra-ui/react';
import './AudioRegion.css';
import BottomAudioPlayer from '../shared/BottomAudioPlayer';

export interface AudioRegionProps {
  visible: boolean;
  activeSlider: 'player' | 'editor' | null;
  height: number;
  onHeightChange: (height: number) => void;
  onSliderChange: (type: 'player' | 'editor') => void;
}

// Player slider component using existing BottomAudioPlayer
const PlayerSlider: React.FC = () => {
  const [audioState, setAudioState] = useState({
    currentTime: 0,
    isPlaying: false,
    volume: 0.8,
    playbackSpeed: 1
  });

  const handleAudioStateUpdate = (updates: Partial<typeof audioState>) => {
    setAudioState(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="audio-slider player-slider">
      <BottomAudioPlayer
        audioSrc="dummy.mp3" // Dummy source to show the player UI
        fileName="Demo Audio"
        sharedAudioState={audioState}
        onAudioStateUpdate={handleAudioStateUpdate}
      />
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
              title="Show Audio Player"
            >
              player ∧∧
            </button>
            <button 
              className="slider-tab disabled"
              onClick={() => onSliderChange('editor')}
              title="Audio Editor (Coming Soon)"
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
          title="Audio Player"
        >
          player ∨∨
        </button>
        <button 
          className={`slider-tab ${activeSlider === 'editor' ? 'active' : ''} disabled`}
          onClick={() => onSliderChange('editor')}
          title="Audio Editor (Coming Soon)"
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