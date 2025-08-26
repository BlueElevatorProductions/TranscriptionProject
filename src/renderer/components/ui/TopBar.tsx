import React from 'react';
import { Headphones, PencilLine } from 'lucide-react';

interface TopBarProps {
  mode: 'listen' | 'edit';
  onModeChange: (mode: 'listen' | 'edit') => void;
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  projectName?: string;
  projectStatus?: string;
}

const TopBar: React.FC<TopBarProps> = ({
  mode,
  onModeChange,
  sidebarCollapsed,
  onSidebarToggle,
  projectName,
  projectStatus
}) => {
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

        {/* Listen/Edit Mode Toggle */}
        <div className="flex items-center mode-button-group">
          <button
            onClick={() => onModeChange('listen')}
            className={`mode-button ${mode === 'listen' ? 'mode-button-active' : 'mode-button-inactive'}`}
            aria-label="Listen mode"
          >
            <Headphones size={20} />
          </button>
          
          <button
            onClick={() => onModeChange('edit')}
            className={`mode-button ${mode === 'edit' ? 'mode-button-active' : 'mode-button-inactive'}`}
            aria-label="Edit mode"
          >
            <PencilLine size={20} />
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