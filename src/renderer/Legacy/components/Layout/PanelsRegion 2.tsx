/**
 * PanelsRegion.tsx - Right sliding panels container
 * 
 * Features:
 * - Collapsible right panel area
 * - Individual panel components with close buttons
 * - Resize handle for width adjustment
 * - Foundation for future extensible panel system
 */

import React, { useRef, useCallback, useState } from 'react';
import './PanelsRegion.css';

export interface PanelsRegionProps {
  visible: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
}

// Placeholder panel components for demo
interface PanelProps {
  onClose?: () => void;
}

const SpeakersPanel: React.FC<PanelProps> = ({ onClose }) => (
  <div className="panel">
    <div className="panel-header">
      <h3 className="panel-title">speakers</h3>
      <button className="panel-close" onClick={onClose} aria-label="Close speakers panel">
        ✕
      </button>
    </div>
    <div className="panel-content">
      <div className="speaker-item">
        <div className="speaker-name">Host</div>
        <div className="speaker-color" style={{ backgroundColor: '#1976d2' }} />
      </div>
      <div className="speaker-item">
        <div className="speaker-name">Guest</div>
        <div className="speaker-color" style={{ backgroundColor: '#388e3c' }} />
      </div>
    </div>
  </div>
);

const ClipsPanel: React.FC<PanelProps> = ({ onClose }) => (
  <div className="panel">
    <div className="panel-header">
      <h3 className="panel-title">clips</h3>
      <button className="panel-close" onClick={onClose} aria-label="Close clips panel">
        ✕
      </button>
    </div>
    <div className="panel-content">
      <div className="clip-item">
        <div className="clip-time">01:02 - 03:25</div>
        <div className="clip-name">Guest interview</div>
        <div className="clip-preview">
          The use of placeholder text is a common practice...
        </div>
      </div>
    </div>
  </div>
);

const PanelsRegion: React.FC<PanelsRegionProps> = ({
  visible,
  width,
  onWidthChange,
  onClose
}) => {
  const resizeRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartWidth, setDragStartWidth] = useState(0);
  
  // Individual panel visibility state
  const [panelVisibility, setPanelVisibility] = useState({
    speakers: true,
    clips: true
  });

  const handlePanelClose = useCallback((panelId: string) => {
    setPanelVisibility(prev => ({
      ...prev,
      [panelId]: false
    }));
  }, []);

  // Mouse event handlers for resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    setDragStartX(e.clientX);
    setDragStartWidth(width);
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = dragStartX - e.clientX; // Inverted because we're resizing from left edge
      const newWidth = dragStartWidth + deltaX;
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width, onWidthChange, dragStartX, dragStartWidth]);

  // Keyboard handler for resize
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      onWidthChange(width + 10);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      onWidthChange(width - 10);
      e.preventDefault();
    }
  }, [width, onWidthChange]);

  if (!visible) {
    return (
      <div className="panels-region hidden" aria-hidden="true">
        <div className="panels-container">
          <div className="panels-collapsed">
            <button 
              className="panels-expand-button"
              onClick={() => onClose()} // This will toggle visibility
              aria-label="Show panels"
            >
              ‹
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="panels-region"
      style={{ width: `${width}px` }}
      data-resizing={isResizing}
    >
      {/* Resize handle */}
      <div
        ref={resizeRef}
        className="resize-handle"
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels width"
        aria-valuenow={width}
        aria-valuemin={250}
        aria-valuemax={500}
      >
        <div className="resize-handle-visual" />
      </div>

      {/* Panels container */}
      <div className="panels-container">
        <div className="panels-scroll">
          {/* Demo panels - these will be replaced with dynamic panel system in Phase 5 */}
          {panelVisibility.speakers && (
            <SpeakersPanel onClose={() => handlePanelClose('speakers')} />
          )}
          {panelVisibility.clips && (
            <ClipsPanel onClose={() => handlePanelClose('clips')} />
          )}
        </div>
      </div>
    </div>
  );
};

export default PanelsRegion;