import React, { useEffect } from 'react';
import { Headphones, PencilLine, AudioWaveform } from 'lucide-react';

interface TopBarProps {
  mode: 'listen' | 'edit';
  onModeChange: (mode: 'listen' | 'edit') => void;
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  projectName?: string;
  projectStatus?: string;
  onOpenAudioEditor?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  mode,
  onModeChange,
  sidebarCollapsed,
  onSidebarToggle,
  projectName,
  projectStatus,
  onOpenAudioEditor
}) => {
  // Keyboard navigation: Tab key cycles through modes
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle Tab key, and only when not in an input field
      if (event.key === 'Tab' && !event.shiftKey) {
        const activeElement = document.activeElement;
        const isInputFocused = activeElement?.tagName === 'INPUT' || 
                              activeElement?.tagName === 'TEXTAREA' || 
                              activeElement?.contentEditable === 'true';
        
        if (!isInputFocused) {
          event.preventDefault();
          
          if (mode === 'listen') {
            onModeChange('edit');
          } else if (mode === 'edit') {
            // From edit mode, go to audio editor
            onOpenAudioEditor?.();
          }
          // Note: Audio editor is a separate window, so no cycling back needed
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, onModeChange, onOpenAudioEditor]);

  return (
    <div className="vibrancy-topbar topbar-height flex items-center justify-between border-b border-glass-border-subtle">
      {/* Left side - Traffic lights area is handled by Electron */}
      <div className="flex items-center">
        {/* Traffic lights space (handled by Electron with titleBarStyle: 'hiddenInset') */}
        <div className="traffic-lights-space" />
        
        {/* Sidebar Toggle */}
        <button
          onClick={onSidebarToggle}
          className="sidebar-toggle-btn"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {/* Custom SVG from the requirements */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`}
          >
            <rect width="18" height="18" x="3" y="3" rx="2"></rect>
            <path d="M9 3v18"></path>
            <path d="m16 15-3-3 3-3"></path>
          </svg>
        </button>

        {/* Button Group Separator */}
        <div className="button-group-separator" />

        {/* Mode Toggle Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onModeChange('listen')}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
              mode === 'listen' 
                ? 'bg-surface text-text' 
                : 'bg-transparent text-text-muted hover:bg-surface hover:text-text'
            }`}
            style={{ WebkitAppRegion: 'no-drag' as any }}
            aria-label="Listen mode"
          >
            <Headphones size={16} />
            <span>Listen</span>
          </button>
          
          <button
            onClick={() => onModeChange('edit')}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
              mode === 'edit' 
                ? 'bg-surface text-text' 
                : 'bg-transparent text-text-muted hover:bg-surface hover:text-text'
            }`}
            style={{ WebkitAppRegion: 'no-drag' as any }}
            aria-label="Text edit mode"
          >
            <PencilLine size={16} />
            <span>Text Edit</span>
          </button>

          <button
            onClick={onOpenAudioEditor}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors bg-transparent text-text-muted hover:bg-surface hover:text-text"
            style={{ WebkitAppRegion: 'no-drag' as any }}
            aria-label="Open audio editor"
          >
            <AudioWaveform size={16} />
            <span>Audio Edit</span>
          </button>
        </div>
      </div>

      {/* Right side - Project Info */}
      <div className="project-info">
        {projectName && (
          <span className="project-name text-sm font-medium">
            {projectName}
          </span>
        )}
        {projectStatus && (
          <span className="project-status text-xs opacity-70">
            {projectStatus}
          </span>
        )}
      </div>
    </div>
  );
};

export default TopBar;