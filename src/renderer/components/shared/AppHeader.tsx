/**
 * AppHeader - Unified header with hamburger menu and close project functionality
 */

import React from 'react';
import { Button } from '../ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from '../ui/dropdown-menu';
import { 
  Menu, 
  X, 
  Save, 
  FileText, 
  FolderOpen, 
  Plus,
  Upload,
  Printer,
  Users,
  Scissors,
  Type,
  Info,
  Check
} from 'lucide-react';

interface AppHeaderProps {
  projectName: string;
  onCloseProject: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onNewProject?: () => void;
  onImportAudio?: () => void;
  onPrint?: () => void;
  
  // Panel visibility states
  panelStates?: {
    speakers: boolean;
    clips: boolean;
    fonts: boolean;
    info: boolean;
  };
  onTogglePanel?: (panelName: string) => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  projectName,
  onCloseProject,
  onSave,
  onSaveAs,
  onNewProject,
  onImportAudio,
  onPrint,
  panelStates = { speakers: true, clips: false, fonts: false, info: false },
  onTogglePanel
}) => {
  const handleCloseProject = async () => {
    // TODO: Check for unsaved changes and prompt to save
    if (onSave) {
      onSave();
    }
    onCloseProject();
  };

  return (
    <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      {/* Left side - Hamburger Menu */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {/* File submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center">
                <FileText className="mr-2 h-4 w-4" />
                File
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {onSave && (
                  <DropdownMenuItem onClick={onSave} className="flex items-center">
                    <Save className="mr-2 h-4 w-4" />
                    Save
                    <span className="ml-auto text-xs text-muted-foreground">⌘S</span>
                  </DropdownMenuItem>
                )}
                {onSaveAs && (
                  <DropdownMenuItem onClick={onSaveAs} className="flex items-center">
                    <Save className="mr-2 h-4 w-4" />
                    Save As...
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCloseProject} className="flex items-center">
                  <X className="mr-2 h-4 w-4" />
                  Close Project
                </DropdownMenuItem>
                {onNewProject && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onNewProject} className="flex items-center">
                      <Plus className="mr-2 h-4 w-4" />
                      New Project
                      <span className="ml-auto text-xs text-muted-foreground">⌘N</span>
                    </DropdownMenuItem>
                  </>
                )}
                {onImportAudio && (
                  <DropdownMenuItem onClick={onImportAudio} className="flex items-center">
                    <Upload className="mr-2 h-4 w-4" />
                    Import Audio
                  </DropdownMenuItem>
                )}
                {onPrint && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onPrint} className="flex items-center">
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                      <span className="ml-auto text-xs text-muted-foreground">⌘P</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            {/* Panels submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center">
                <FolderOpen className="mr-2 h-4 w-4" />
                Panels
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuCheckboxItem
                  checked={panelStates.speakers}
                  onCheckedChange={() => onTogglePanel?.('speakers')}
                  className="flex items-center"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Speakers
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={panelStates.clips}
                  onCheckedChange={() => onTogglePanel?.('clips')}
                  className="flex items-center"
                >
                  <Scissors className="mr-2 h-4 w-4" />
                  Clips
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={panelStates.fonts}
                  onCheckedChange={() => onTogglePanel?.('fonts')}
                  className="flex items-center"
                >
                  <Type className="mr-2 h-4 w-4" />
                  Fonts
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={panelStates.info}
                  onCheckedChange={() => onTogglePanel?.('info')}
                  className="flex items-center"
                >
                  <Info className="mr-2 h-4 w-4" />
                  Info
                </DropdownMenuCheckboxItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Project name */}
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold text-foreground truncate max-w-md">
            {projectName}
          </h1>
        </div>
      </div>

      {/* Right side - Close Project Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleCloseProject}
        className="flex items-center gap-2"
      >
        <X className="h-4 w-4" />
        Close Project
      </Button>
    </header>
  );
};

export default AppHeader;