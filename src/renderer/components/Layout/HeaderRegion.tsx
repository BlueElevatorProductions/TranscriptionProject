/**
 * HeaderRegion.tsx - Modern header with professional design system
 * 
 * Features:
 * - Listen/Edit mode tabs with Tailwind styling
 * - Context-sensitive toolbar (changes based on mode)
 * - Panel/slider toggle controls
 * - Modern professional styling from ScriptScribe design
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Mic, 
  Settings, 
  Download, 
  Upload, 
  Edit, 
  Sun, 
  Moon, 
  FileText,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Strikethrough,
  User,
  PilcrowLeft,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

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

// Modern toolbar button component
interface ToolbarButtonProps {
  icon: React.ReactNode;
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
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "default" : "ghost"}
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "h-8 w-8 p-0",
            active && "bg-primary text-primary-foreground"
          )}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{shortcut ? `${label} (${shortcut})` : label}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
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
    { id: 'bold', icon: <Bold className="h-4 w-4" />, label: 'Bold', shortcut: 'Cmd+B' },
    { id: 'italic', icon: <Italic className="h-4 w-4" />, label: 'Italic', shortcut: 'Cmd+I' },
    { id: 'underline', icon: <Underline className="h-4 w-4" />, label: 'Underline', shortcut: 'Cmd+U' },
    { id: 'highlight', icon: <Highlighter className="h-4 w-4" />, label: 'Highlight', shortcut: 'Cmd+H' },
  ];

  // Edit-only tools
  const editTools = [
    { id: 'strikethrough', icon: <Strikethrough className="h-4 w-4" />, label: 'Strikethrough', shortcut: 'Cmd+Shift+X' },
    { id: 'new-speaker', icon: <User className="h-4 w-4" />, label: 'New Speaker', shortcut: 'Cmd+Shift+S' },
    { id: 'new-paragraph', icon: <PilcrowLeft className="h-4 w-4" />, label: 'New Paragraph', shortcut: 'Enter' },
  ];

  // Get tools based on current mode
  const availableTools = currentMode === 'edit' 
    ? [...sharedTools, ...editTools]
    : sharedTools;

  const { theme, setTheme } = useTheme();

  return (
    <TooltipProvider>
      <header className="bg-white border-b h-16 flex items-center justify-between px-6 flex-shrink-0 z-50" style={{borderColor: 'hsl(var(--border))'}}>
        {/* Left section - App logo and project info */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Mic className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground">TranscriptionProject</span>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center space-x-2">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Current Project</span>
          </div>
        </div>

        {/* Center section - Mode tabs and toolbar */}
        <div className="flex items-center space-x-4">
          {/* Mode Tabs */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Edit Mode</span>
            <Switch 
              checked={currentMode === 'edit'} 
              onCheckedChange={(checked) => handleModeChange(checked ? 'edit' : 'listen')} 
            />
          </div>
          
          {/* Toolbar */}
          <div className="flex items-center space-x-1 border-l pl-4" style={{borderColor: 'hsl(var(--border))'}}>
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
        </div>

        {/* Right section - Controls */}
        <div className="flex items-center space-x-3">          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => onToggleAudioSlider('player')}>
                {audioSliderVisible ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{audioSliderVisible ? 'Hide' : 'Show'} Audio Player</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onTogglePanels}>
                {panelsVisible ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{panelsVisible ? 'Hide' : 'Show'} Panels (P)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle theme</p>
            </TooltipContent>
          </Tooltip>
          
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
};

export default HeaderRegion;