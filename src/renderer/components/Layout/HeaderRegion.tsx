/**
 * HeaderRegion.tsx - Header with mode tabs and context-sensitive toolbar
 * 
 * Features:
 * - Listen/Edit mode tabs
 * - Context-sensitive toolbar (changes based on mode)
 * - Panel/slider toggle controls
 * - Responsive design
 */

import React, { useState, useCallback } from 'react';
import './HeaderRegion.css';

// Types
export type AppMode = 'listen' | 'edit';
export type AudioSliderType = 'player' | 'editor' | null;

export interface HeaderRegionProps {
  onTogglePanels: () => void;
  onToggleAudioSlider: (type?: AudioSliderType) => void;
  panelsVisible: boolean;
  audioSliderVisible: boolean;
  activeAudioSlider: AudioSliderType;
  currentMode?: AppMode;
  onModeChange?: (mode: AppMode) => void;
}

// Toolbar button component
interface ToolbarButtonProps {
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  shortcut?: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
  shortcut
}) => (
  <button
    className={`toolbar-button ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={shortcut ? `${label} (${shortcut})` : label}
    aria-label={label}
  >
    <span className="toolbar-button-icon">{icon}</span>
    {shortcut && <span className="toolbar-button-shortcut">{shortcut}</span>}
  </button>
);

const HeaderRegion: React.FC<HeaderRegionProps> = ({
  onTogglePanels,
  onToggleAudioSlider,
  panelsVisible,
  audioSliderVisible,
  activeAudioSlider,
  currentMode = 'listen',
  onModeChange
}) => {
  // Local state for toolbar selections
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());

  // Mode change handler
  const handleModeChange = useCallback((mode: AppMode) => {
    if (onModeChange) {
      onModeChange(mode);
    }
  }, [onModeChange]);

  // Toolbar action handlers
  const handleToolClick = useCallback((tool: string) => {
    setSelectedTools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tool)) {
        newSet.delete(tool);
      } else {
        newSet.add(tool);
      }
      return newSet;
    });
    
    // TODO: Implement actual formatting actions
    console.log(`Toolbar action: ${tool}`);
  }, []);

  // Shared tools (available in both modes)
  const sharedTools = [
    { id: 'bold', icon: '𝐁', label: 'Bold', shortcut: 'Cmd+B' },
    { id: 'italic', icon: '𝐼', label: 'Italic', shortcut: 'Cmd+I' },
    { id: 'underline', icon: 'U̲', label: 'Underline', shortcut: 'Cmd+U' },
    { id: 'highlight', icon: '🖍️', label: 'Highlight', shortcut: 'Cmd+H' },
  ];

  // Edit-only tools
  const editTools = [
    { id: 'strikethrough', icon: 'S̶', label: 'Strikethrough', shortcut: 'Cmd+Shift+X' },
    { id: 'new-speaker', icon: '👤', label: 'New Speaker', shortcut: 'Cmd+Shift+S' },
    { id: 'new-paragraph', icon: '¶', label: 'New Paragraph', shortcut: 'Enter' },
  ];

  // Get tools based on current mode
  const availableTools = currentMode === 'edit' 
    ? [...sharedTools, ...editTools]
    : sharedTools;

  return (
    <header className="header-region">
      <div className="header-content">
        {/* Left Section: Mode Tabs */}
        <div className="mode-tabs">
          <button
            className={`mode-tab ${currentMode === 'listen' ? 'active' : ''}`}
            onClick={() => handleModeChange('listen')}
            aria-pressed={currentMode === 'listen'}
          >
            listen
          </button>
          <button
            className={`mode-tab ${currentMode === 'edit' ? 'active' : ''}`}
            onClick={() => handleModeChange('edit')}
            aria-pressed={currentMode === 'edit'}
          >
            edit
          </button>
        </div>

        {/* Center Section: Context-Sensitive Toolbar */}
        <div className="toolbar" role="toolbar" aria-label="Formatting toolbar">
          {availableTools.map(tool => (
            <ToolbarButton
              key={tool.id}
              icon={tool.icon}
              label={tool.label}
              shortcut={tool.shortcut}
              active={selectedTools.has(tool.id)}
              onClick={() => handleToolClick(tool.id)}
            />
          ))}
        </div>

        {/* Right Section: Layout Controls */}
        <div className="layout-controls">
          {/* Panels Toggle */}
          <button
            className={`control-button ${panelsVisible ? 'active' : ''}`}
            onClick={onTogglePanels}
            title="Toggle Panels (P)"
            aria-label="Toggle panels"
            aria-pressed={panelsVisible}
          >
            📋
          </button>

          {/* Audio Slider Controls */}
          <div className="audio-controls">
            <button
              className={`control-button ${activeAudioSlider === 'player' ? 'active' : ''}`}
              onClick={() => onToggleAudioSlider('player')}
              title="Toggle Player (Shift+P)"
              aria-label="Toggle audio player"
              aria-pressed={activeAudioSlider === 'player'}
            >
              ▶️
            </button>
            <button
              className={`control-button ${activeAudioSlider === 'editor' ? 'active' : ''}`}
              onClick={() => onToggleAudioSlider('editor')}
              title="Toggle Editor (Shift+E)"
              aria-label="Toggle audio editor"
              aria-pressed={activeAudioSlider === 'editor'}
              disabled={true} // Disabled for now - Coming Soon
            >
              🎛️
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeaderRegion;