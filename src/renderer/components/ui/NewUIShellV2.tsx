/**
 * NewUIShell v2.0 - Main UI layout using v2.0 architecture
 *
 * Simplified UI that integrates with:
 * - ProjectContextV2 (thin cache to main process)
 * - Segment-based data model
 * - Atomic edit operations
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FileText, FolderOpen, Save, Settings, Upload, Music, Download, ChevronDown, Users, Scissors, Type, Palette, Play } from 'lucide-react';
import { useProjectV2 } from '../../contexts/ProjectContextV2';
import { useNotifications } from '../../contexts';
import LexicalTranscriptEditorV2 from '../../editor/LexicalTranscriptEditorV2';
import { useAudioPlayback } from '../../hooks/useAudioPlayback';
import SecondaryPanel from '../SecondaryPanel';
import SpeakersPanel from '../shared/SpeakersPanel';
import ClipsPanel from '../shared/ClipsPanel';
import FontsPanel from '../shared/FontsPanel';
import ColorSettings from '../Settings/ColorSettings';
import ApiSettings from '../Settings/ApiSettings';
import { GlassAudioPlayer } from './GlassAudioPlayer';
import ProjectImportDialog from '../ImportDialog/ProjectImportDialog';

export interface NewUIShellV2Props {
  onManualSave?: () => void;
}

const NewUIShellV2: React.FC<NewUIShellV2Props> = ({ onManualSave }) => {
  console.log('🏠 NewUIShellV2: Component initializing...');

  const { state: projectState, actions: projectActions } = useProjectV2();
  console.log('🏠 NewUIShellV2: ProjectV2 context loaded, clips:', projectState?.clips?.length || 0);

  const { addToast } = useNotifications() as any;
  console.log('🏠 NewUIShellV2: Notifications context loaded');

  const [activePanel, setActivePanel] = useState<string>('transcript');

  // Secondary panel state
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  // Dialog state
  const [showProjectImportDialog, setShowProjectImportDialog] = useState(false);

  // UI state
  const [isGlassPlayerVisible, setIsGlassPlayerVisible] = useState<boolean>(false);

  // Speaker editing state
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [tempSpeakerName, setTempSpeakerName] = useState<string>('');

  // Color settings state
  const [currentColor, setCurrentColor] = useState<string>('#003223');
  const [transcriptTheme, setTranscriptTheme] = useState<'light' | 'dark'>('dark');

  // API settings state
  const [currentApiKeys, setCurrentApiKeys] = useState<{ [service: string]: string }>({});

  // Font settings state
  const [fontSettings, setFontSettings] = useState<{fontFamily: string; fontSize: number}>({
    fontFamily: 'Avenir',
    fontSize: 18
  });

  // Audio playback integration
  console.log('🏠 NewUIShellV2: Initializing audio playback hook...');
  const { state: audioState, controls: audioControls } = useAudioPlayback(
    projectState.clips,
    projectState.currentProjectPath
  );
  console.log('🏠 NewUIShellV2: Audio playback hook initialized, state:', {
    isReady: audioState.isReady,
    isPlaying: audioState.isPlaying,
    error: audioState.error,
    projectPath: projectState.currentProjectPath
  });

  // Demo mode for Listen Mode testing
  const [isDemoMode, setIsDemoMode] = useState(false);
  const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Mode state for header buttons
  const [currentMode, setCurrentMode] = useState<'listen' | 'edit-text' | 'edit-audio'>('edit-text');

  // Edit Text Mode state
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Edit Audio Mode state
  const [audioPath, setAudioPath] = useState<string | null>(null);

  // Demo mode effect - simulates audio playback for Listen Mode testing (when no real audio)
  useEffect(() => {
    if (isDemoMode && audioState.isPlaying && currentMode === 'listen' && !audioState.isReady) {
      demoIntervalRef.current = setInterval(() => {
        // This would only run if we don't have real audio loaded
        console.log('Demo mode simulation running');
      }, 100);

      return () => {
        if (demoIntervalRef.current) {
          clearInterval(demoIntervalRef.current);
        }
      };
    } else {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    }
  }, [isDemoMode, audioState.isPlaying, audioState.isReady, currentMode]);

  // Auto-enable demo mode when entering Listen Mode with clips
  useEffect(() => {
    if (currentMode === 'listen' && projectState.clips.length > 0) {
      setIsDemoMode(true);
    } else {
      setIsDemoMode(false);
    }
  }, [currentMode, projectState.clips.length]);

  // Auto-setup audio path when entering Edit Audio Mode
  useEffect(() => {
    if (currentMode === 'edit-audio') {
      // In a real implementation, this would get the actual audio file path
      // For demo purposes, we'll use a mock path
      const audio = projectState.projectData?.project?.audio;
      const audioPath = audio?.path || audio?.extractedPath || audio?.embeddedPath || audio?.originalFile;
      console.log('🎵 NewUIShellV2: Resolving audio path from project data:', {
        path: audio?.path,
        extractedPath: audio?.extractedPath,
        embeddedPath: audio?.embeddedPath,
        originalFile: audio?.originalFile,
        resolved: audioPath
      });
      setAudioPath(audioPath || '/demo/audio.wav');
    }
  }, [currentMode, projectState.clips.length, projectState.projectData]);

  // Initialize v2.0 system
  useEffect(() => {
    console.log('🚀 NewUIShell v2.0 initialized');
    console.log('Project state:', projectState);

    // Check electronAPI availability
    console.log('🔌 electronAPI available:', !!window.electronAPI);
    if (window.electronAPI) {
      console.log('🔌 electronAPI methods:', Object.keys(window.electronAPI));
    }

    // Check juceTransport availability
    const juceTransport = (window as any).juceTransport;
    console.log('🎛️ juceTransport available:', !!juceTransport);
    if (juceTransport) {
      console.log('🎛️ juceTransport methods:', Object.keys(juceTransport));
    }

    // Listen for project import events
    const handleOpenProjectImport = () => {
      setShowProjectImportDialog(true);
    };

    // Tab key navigation between modes
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        // Only capture Tab if we're not in an input/textarea
        const activeElement = document.activeElement;
        const isTextInput = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.hasAttribute('contenteditable')
        );

        if (!isTextInput) {
          event.preventDefault();
          setCurrentMode(prevMode => {
            switch (prevMode) {
              case 'listen':
                return 'edit-text';
              case 'edit-text':
                return 'edit-audio';
              case 'edit-audio':
                return 'listen';
              default:
                return 'listen';
            }
          });
        }
      }
    };

    window.addEventListener('open-project-import', handleOpenProjectImport);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open-project-import', handleOpenProjectImport);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Load color and font settings from localStorage
  useEffect(() => {
    const savedColor = localStorage.getItem('app-color');
    const savedTheme = localStorage.getItem('transcript-theme');
    const savedFontSettings = localStorage.getItem('font-settings');

    if (savedColor) {
      setCurrentColor(savedColor);
    }
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTranscriptTheme(savedTheme);
    }
    if (savedFontSettings) {
      try {
        const parsedFontSettings = JSON.parse(savedFontSettings);
        setFontSettings(parsedFontSettings);
      } catch (error) {
        console.error('Failed to parse saved font settings:', error);
      }
    }
  }, []);

  // Load API keys on initialization
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        if (window.electronAPI?.getApiKeys) {
          const keys = await window.electronAPI.getApiKeys();
          setCurrentApiKeys(keys || {});
        }
      } catch (error) {
        console.error('Failed to load API keys:', error);
      }
    };

    loadApiKeys();
  }, []);

  // Apply transcript theme changes
  useEffect(() => {
    const root = document.documentElement;

    if (transcriptTheme === 'light') {
      // Light transcript theme - white background with black text
      root.style.setProperty('--transcript-bg', '0 0% 100%');     // White background
      root.style.setProperty('--transcript-text', '0 0% 0%');     // Black text
    } else {
      // Dark transcript theme - dark grey background with white text
      root.style.setProperty('--transcript-bg', '220 15% 15%');   // Dark grey background
      root.style.setProperty('--transcript-text', '0 0% 95%');    // White text
    }
  }, [transcriptTheme]);

  // Apply font settings changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--transcript-font-family', fontSettings.fontFamily);
    root.style.setProperty('--transcript-font-size', `${fontSettings.fontSize}px`);
  }, [fontSettings]);

  // Load audio when project has audio file
  useEffect(() => {
    const audio = projectState.projectData?.project?.audio;
    const projectAudioPath = audio?.path || audio?.extractedPath || audio?.embeddedPath || audio?.originalFile;
    if (projectAudioPath && projectAudioPath !== '/demo/audio.wav' && projectAudioPath !== audioPath) {
      console.log('🎵 Loading audio from project:', projectAudioPath);
      setAudioPath(projectAudioPath);
      audioControls.loadAudio(projectAudioPath).catch(error => {
        console.error('Failed to load project audio:', error);
        addToast?.({
          type: 'error',
          title: 'Audio Load Failed',
          message: `Failed to load audio file: ${projectAudioPath}`,
        });
      });
    } else if (!projectAudioPath && projectState.clips && projectState.clips.length > 0) {
      console.warn('🎵 Project has clips but no audio path - audio playback unavailable');
    }
  }, [
    projectState.projectData?.project?.audio?.path,
    projectState.projectData?.project?.audio?.extractedPath,
    projectState.projectData?.project?.audio?.embeddedPath,
    projectState.projectData?.project?.audio?.originalFile,
    audioControls,
    addToast,
    projectState.clips
  ]);

  // Initialize audio if not ready but clips exist and audio path is available
  useEffect(() => {
    const audio = projectState.projectData?.project?.audio;
    const projectAudioPath = audio?.path || audio?.extractedPath || audio?.embeddedPath || audio?.originalFile;
    const hasClips = audioState.isReady === false &&
                   projectState.clips &&
                   projectState.clips.length > 0;

    if (projectAudioPath && projectAudioPath !== '/demo/audio.wav' && hasClips && !audioState.isLoading) {
      console.log('🎵 Auto-initializing audio with existing clips, path:', projectAudioPath);
      audioControls.loadAudio(projectAudioPath).catch(error => {
        console.error('Failed to auto-initialize audio:', error);
        addToast?.({
          type: 'error',
          title: 'Audio Auto-Init Failed',
          message: `Failed to initialize audio playback: ${error instanceof Error ? error.message : String(error)}`,
        });
      });
    }
  }, [
    projectState.projectData?.project?.audio?.path,
    projectState.projectData?.project?.audio?.extractedPath,
    projectState.projectData?.project?.audio?.embeddedPath,
    projectState.projectData?.project?.audio?.originalFile,
    projectState.clips,
    audioState.isReady,
    audioState.isLoading,
    audioControls,
    addToast
  ]);

  // Audio player handlers
  const handlePlayPause = useCallback(async () => {
    try {
      await audioControls.toggle();
    } catch (error) {
      console.error('Play/pause failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not initialized') || errorMessage.includes('not ready')) {
        addToast?.({
          type: 'warning',
          title: 'Audio Not Ready',
          message: 'Please wait for audio to load before playing.',
        });
      } else {
        addToast?.({
          type: 'error',
          title: 'Playback Error',
          message: 'Failed to control audio playback.',
        });
      }
    }
  }, [audioControls, addToast]);

  // Global spacebar control for play/pause
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if spacebar was pressed (keyCode 32 or key === ' ')
      if (event.code === 'Space' || event.key === ' ') {
        // Only handle spacebar if not typing in an input/textarea/contenteditable
        const target = event.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' ||
                        target.tagName === 'TEXTAREA' ||
                        target.contentEditable === 'true' ||
                        target.isContentEditable;

        if (!isTyping) {
          event.preventDefault(); // Prevent page scroll
          handlePlayPause();
          console.log('🎵 Spacebar play/pause triggered');
        }
      }
    };

    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePlayPause]);

  // Handle save action
  const handleSave = async () => {
    try {
      console.log('💾 Saving project via v2.0...');
      // In v2.0, save operations go through main process
      await projectActions.saveProject();
      onManualSave?.();
      addToast?.({
        type: 'success',
        title: 'Project Saved',
        message: 'Your project has been saved successfully.',
      });
    } catch (error) {
      console.error('Save failed:', error);
      addToast?.({
        type: 'error',
        title: 'Save Failed',
        message: error instanceof Error ? error.message : 'Failed to save project',
      });
    }
  };

  // Handle new project
  const handleNewProject = () => {
    console.log('📄 Creating new project...');
    window.dispatchEvent(new CustomEvent('open-new-project'));
  };

  // Handle open project
  const handleOpenProject = () => {
    console.log('📂 Opening project...');
    window.dispatchEvent(new CustomEvent('open-project-import'));
  };

  // Handle import audio
  const handleImportAudio = () => {
    console.log('🎵 Importing audio...');
    window.dispatchEvent(new CustomEvent('open-import-audio'));
  };

  // Handle export project
  const handleExportProject = async () => {
    try {
      console.log('📤 Exporting project...');
      // Use the save project dialog for export
      if (!window.electronAPI?.saveProjectDialog) {
        throw new Error('Export functionality not available');
      }

      const result = await window.electronAPI.saveProjectDialog('exported-project');
      if (!result.canceled && result.filePath) {
        await projectActions.saveProject();
        addToast?.({
          type: 'success',
          title: 'Project Exported',
          message: `Project exported to ${result.filePath}`,
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      addToast?.({
        type: 'error',
        title: 'Export Failed',
        message: error instanceof Error ? error.message : 'Failed to export project',
      });
    }
  };

  // Panel handlers with toggle functionality
  const handleOpenSpeakers = () => setOpenPanel(openPanel === 'speakers' ? null : 'speakers');
  const handleOpenClips = () => setOpenPanel(openPanel === 'clips' ? null : 'clips');
  const handleOpenFonts = () => setOpenPanel(openPanel === 'fonts' ? null : 'fonts');
  const handleOpenApiSettings = () => setOpenPanel(openPanel === 'api-settings' ? null : 'api-settings');
  const handleOpenColorSettings = () => setOpenPanel(openPanel === 'colors' ? null : 'colors');
  const handleOpenPlayback = () => setIsGlassPlayerVisible(!isGlassPlayerVisible);

  // Speaker management handlers
  const handleSpeakerEdit = (speakerId: string, currentName: string) => {
    setEditingSpeakerId(speakerId);
    setTempSpeakerName(currentName);
  };

  const handleSpeakerSave = async (speakerId: string) => {
    if (!tempSpeakerName.trim() || !editingSpeakerId) return;

    try {
      // Use the new renameSpeaker operation
      const success = await projectActions.renameSpeaker(editingSpeakerId, tempSpeakerName.trim());

      if (success) {
        setEditingSpeakerId(null);
        setTempSpeakerName('');
        addToast?.({
          type: 'success',
          title: 'Speaker Renamed',
          message: `Speaker renamed to "${tempSpeakerName.trim()}"`,
        });
      } else {
        addToast?.({
          type: 'error',
          title: 'Rename Failed',
          message: 'Failed to rename speaker',
        });
      }
    } catch (error) {
      console.error('Speaker rename failed:', error);
      addToast?.({
        type: 'error',
        title: 'Rename Failed',
        message: error instanceof Error ? error.message : 'Failed to rename speaker',
      });
    }
  };

  const handleSpeakerCancel = () => {
    setEditingSpeakerId(null);
    setTempSpeakerName('');
  };

  const handleTempNameChange = (name: string) => {
    setTempSpeakerName(name);
  };

  // Color settings handlers
  const handleColorChange = (color: string) => {
    setCurrentColor(color);
    localStorage.setItem('app-color', color);
    // TODO: Apply color changes to UI elements if needed
  };

  const handleTranscriptThemeChange = (theme: 'light' | 'dark') => {
    setTranscriptTheme(theme);
    localStorage.setItem('transcript-theme', theme);
  };

  // API settings handlers
  const handleApiKeySave = async (apiKeys: { [service: string]: string }) => {
    try {
      if (window.electronAPI?.saveApiKeys) {
        const result = await window.electronAPI.saveApiKeys(apiKeys);
        if (result.success) {
          setCurrentApiKeys(apiKeys);
          setOpenPanel(null);
          addToast?.({
            type: 'success',
            title: 'API Keys Saved',
            message: 'API keys have been saved successfully.',
          });
        } else {
          throw new Error(result.error || 'Failed to save API keys');
        }
      } else {
        throw new Error('API key save functionality not available');
      }
    } catch (error) {
      console.error('Failed to save API keys:', error);
      addToast?.({
        type: 'error',
        title: 'Save Failed',
        message: error instanceof Error ? error.message : 'Failed to save API keys',
      });
    }
  };

  const handleApiKeyCancel = () => {
    setOpenPanel(null);
  };

  // Font settings handlers
  const handleFontChange = (newFontSettings: {fontFamily: string; fontSize: number}) => {
    setFontSettings(newFontSettings);
    localStorage.setItem('font-settings', JSON.stringify(newFontSettings));
  };

  const handleSeek = useCallback(async (time: number) => {
    try {
      await audioControls.seek(time);
    } catch (error) {
      console.error('Seek failed:', error);
    }
  }, [audioControls]);

  const handleVolumeChange = useCallback(async (volume: number) => {
    try {
      await audioControls.setVolume(volume);
    } catch (error) {
      console.error('Volume change failed:', error);
    }
  }, [audioControls]);

  const handleSpeedChange = useCallback(async (speed: number) => {
    try {
      await audioControls.setPlaybackRate(speed);
    } catch (error) {
      console.error('Speed change failed:', error);
    }
  }, [audioControls]);

  const handleSkipToClipStart = useCallback(async () => {
    try {
      await audioControls.skipToClipStart();
    } catch (error) {
      console.error('Skip to clip start failed:', error);
    }
  }, [audioControls]);

  const handleSkipToClipEnd = useCallback(async () => {
    try {
      await audioControls.skipToClipEnd();
    } catch (error) {
      console.error('Skip to clip end failed:', error);
    }
  }, [audioControls]);

  // Convert v2.0 speakers data to SpeakersPanel format
  const convertSpeakersForPanel = (): Array<{id: string; name: string; segments?: any[]; totalDuration?: number; totalTime?: number; color?: string}> => {
    const speakers = projectState.projectData?.speakers?.speakers || {};

    return Object.entries(speakers).map(([id, name]) => ({
      id,
      name,
      segments: [], // TODO: Calculate segments from clips if needed
      totalDuration: 0, // TODO: Calculate from clips if needed
      totalTime: 0, // TODO: Calculate from clips if needed
      color: undefined // TODO: Add color support if needed
    }));
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Top Bar */}
      <div className="h-11 bg-card border-b border-border flex items-center justify-between pl-[72px] pr-4 drag-region">
        {/* Mode Buttons */}
        <div className="flex items-center space-x-1 no-drag">
          <button
            onClick={() => setCurrentMode('listen')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              currentMode === 'listen'
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            Listen
          </button>
          <button
            onClick={() => setCurrentMode('edit-text')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              currentMode === 'edit-text'
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            Edit Text
          </button>
          <button
            onClick={() => setCurrentMode('edit-audio')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              currentMode === 'edit-audio'
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            Edit Audio
          </button>
        </div>

        <div className="flex items-center space-x-2 no-drag">
          <span className="text-sm text-muted-foreground">
            TranscriptionProject v2.0
          </span>
          <span className="text-xs text-muted-foreground/70">
            • Press Tab to switch modes
          </span>
          {currentMode === 'listen' && (
            <button
              onClick={handlePlayPause}
              className="text-xs px-2 py-1 bg-accent text-accent-foreground rounded hover:bg-accent/80 transition-colors"
            >
              {audioState.isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
          )}
          {currentMode === 'edit-text' && projectState.clips.length > 0 && (
            <span className="text-xs text-muted-foreground/70">
              • Double-click words to edit • Enter to split • Drag clips to reorder
            </span>
          )}
          {currentMode === 'edit-audio' && projectState.clips.length > 0 && (
            <span className="text-xs text-muted-foreground/70">
              • Click waveform to seek • Drag to select • Audio tools available
            </span>
          )}
          {projectState.hasUnsavedChanges && (
            <span className="text-xs text-orange-500">• Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-64 bg-card border-r border-border flex flex-col">
          <div className="p-4">
            {/* File Dropdown Menu */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2 mb-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <div className="flex items-center space-x-2">
                    <FileText size={16} />
                    <span className="text-sm">File</span>
                  </div>
                  <ChevronDown size={14} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[200px] bg-card border border-border rounded-md shadow-lg p-1 z-50"
                  sideOffset={5}
                >
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer outline-none"
                    onClick={handleNewProject}
                  >
                    <FileText size={16} />
                    <span>New Project</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer outline-none"
                    onClick={handleOpenProject}
                  >
                    <FolderOpen size={16} />
                    <span>Open Project</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer outline-none"
                    onClick={handleSave}
                    disabled={!projectState.hasUnsavedChanges}
                  >
                    <Save size={16} />
                    <span>Save Project</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator className="h-px bg-border my-1" />

                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer outline-none"
                    onClick={handleImportAudio}
                  >
                    <Music size={16} />
                    <span>Import Audio</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer outline-none"
                    onClick={handleExportProject}
                  >
                    <Download size={16} />
                    <span>Export</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Settings Dropdown Menu */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2 mb-4 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <div className="flex items-center space-x-2">
                    <Settings size={16} />
                    <span className="text-sm">Settings</span>
                  </div>
                  <ChevronDown size={14} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[200px] bg-card border border-border rounded-md shadow-lg p-1 z-50"
                  sideOffset={5}
                >
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer outline-none"
                    onClick={handleOpenApiSettings}
                  >
                    <Settings size={16} />
                    <span>API Settings</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Secondary Panel Controls */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 px-3">Tools</h3>
              <div className="space-y-1">
                <button
                  onClick={handleOpenSpeakers}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                >
                  <Users size={16} />
                  <span>Speakers</span>
                </button>
                <button
                  onClick={handleOpenClips}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                >
                  <Scissors size={16} />
                  <span>Clips</span>
                </button>
                <button
                  onClick={handleOpenFonts}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                >
                  <Type size={16} />
                  <span>Fonts</span>
                </button>
                <button
                  onClick={handleOpenColorSettings}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                >
                  <Palette size={16} />
                  <span>Colors</span>
                </button>
                <button
                  onClick={handleOpenPlayback}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                >
                  <Play size={16} />
                  <span>Playback</span>
                </button>
              </div>
            </div>
          </div>

          {/* Transcription Progress */}
          {projectState.isTranscribing && projectState.currentTranscriptionJob && (
            <div className="p-4 border-t border-border">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Transcribing</span>
                  <span className="text-xs text-muted-foreground">
                    {projectState.currentTranscriptionJob.progress}%
                  </span>
                </div>

                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${projectState.currentTranscriptionJob.progress}%` }}
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  <div>File: {projectState.currentTranscriptionJob.fileName}</div>
                  <div>Status: {projectState.currentTranscriptionJob.status}</div>
                  {projectState.currentTranscriptionJob.error && (
                    <div className="text-destructive mt-1">
                      Error: {projectState.currentTranscriptionJob.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Project Info */}
          <div className="mt-auto p-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              <div>Clips: {projectState.clips.length}</div>
              <div>Status: {projectState.isLoading ? 'Loading...' : 'Ready'}</div>
              {projectState.error && (
                <div className="text-destructive mt-1">
                  Error: {projectState.error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Secondary Panel */}
        <SecondaryPanel
          open={openPanel !== null}
          title={
            openPanel === 'speakers' ? 'Speakers' :
            openPanel === 'clips' ? 'Clips' :
            openPanel === 'fonts' ? 'Fonts' :
            openPanel === 'colors' ? 'Colors' :
            openPanel === 'api-settings' ? 'API Settings' :
            'Panel'
          }
          onClose={() => setOpenPanel(null)}
          widthPx={320}
        >
          {openPanel === 'speakers' && (
            <SpeakersPanel
              mode="transcript-edit"
              speakers={convertSpeakersForPanel()}
              speakerNames={projectState.projectData?.speakers?.speakers || {}}
              editingSpeakerId={editingSpeakerId}
              tempSpeakerName={tempSpeakerName}
              onSpeakerEdit={handleSpeakerEdit}
              onSpeakerSave={handleSpeakerSave}
              onSpeakerCancel={handleSpeakerCancel}
              onTempNameChange={handleTempNameChange}
            />
          )}

          {openPanel === 'clips' && (
            <ClipsPanel
              clips={projectState.clips}
              selectedClipId={projectState.selectedClipId}
              onClipSelect={(clipId) => projectActions.setSelectedClip(clipId)}
              onClipDelete={async (clipId) => {
                const success = await projectActions.deleteClip(clipId);
                if (success) {
                  addToast?.({
                    type: 'success',
                    title: 'Clip Deleted',
                    message: 'Clip deleted successfully.',
                  });
                } else {
                  addToast?.({
                    type: 'error',
                    title: 'Delete Failed',
                    message: 'Failed to delete clip.',
                  });
                }
                return success;
              }}
              onClipPlay={async (clip) => {
                try {
                  // Show audio player and seek to clip
                  setIsGlassPlayerVisible(true);
                  await audioControls.seekToClip(clip.id);
                  console.log('Playing clip:', clip);
                } catch (error) {
                  console.error('Failed to play clip:', error);
                }
              }}
              onClipMerge={async (clipIds) => {
                const success = await projectActions.mergeClips(clipIds);
                if (success) {
                  addToast?.({
                    type: 'success',
                    title: 'Clips Merged',
                    message: `${clipIds.length} clips merged successfully.`,
                  });
                } else {
                  addToast?.({
                    type: 'error',
                    title: 'Merge Failed',
                    message: 'Failed to merge clips.',
                  });
                }
                return success;
              }}
              onClipReorder={async (clipId, newOrder) => {
                const success = await projectActions.reorderClips(clipId, newOrder);
                if (success) {
                  addToast?.({
                    type: 'success',
                    title: 'Clips Reordered',
                    message: 'Clip order updated successfully.',
                  });
                } else {
                  addToast?.({
                    type: 'error',
                    title: 'Reorder Failed',
                    message: 'Failed to reorder clips.',
                  });
                }
                return success;
              }}
              onClose={() => setOpenPanel(null)}
            />
          )}

          {openPanel === 'fonts' && (
            <FontsPanel
              initial={fontSettings}
              onChange={handleFontChange}
              onClose={() => setOpenPanel(null)}
            />
          )}

          {openPanel === 'colors' && (
            <ColorSettings
              currentColor={currentColor}
              onColorChange={handleColorChange}
              onTranscriptThemeChange={handleTranscriptThemeChange}
              onClose={() => setOpenPanel(null)}
            />
          )}

          {openPanel === 'api-settings' && (
            <ApiSettings
              onSave={handleApiKeySave}
              onCancel={handleApiKeyCancel}
            />
          )}
        </SecondaryPanel>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col">
          {/* Always show transcript editor now since we removed the Settings panel */}
          <div className="flex-1 p-6">
            <h1 className="text-2xl font-bold mb-4">Transcript Editor</h1>

            {projectState.clips.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <FileText size={48} className="mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No transcript loaded</h3>
                  <p className="text-muted-foreground mb-4">
                    Import an audio file to get started with transcription.
                  </p>
                  <button
                    onClick={handleNewProject}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Create New Project
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {projectState.clips.length} clips loaded
                </div>

                {/* v2.0 Transcript Editor */}
                <LexicalTranscriptEditorV2
                  mode={currentMode}
                  className="min-h-[400px]"
                  currentTime={audioState.currentTime}
                  selectedClipId={selectedClipId}
                  audioPath={audioPath}
                  duration={audioState.duration}
                  isPlaying={audioState.isPlaying}
                  volume={audioState.volume}
                  onWordClick={async (clipId, segmentIndex) => {
                    try {
                      await audioControls.seekToClip(clipId);
                      console.log('Word clicked in editor:', { clipId, segmentIndex });
                    } catch (error) {
                      console.error('Failed to seek to word:', error);
                    }
                  }}
                  onOperationComplete={(operationType, success) => {
                    console.log('Edit operation completed:', { operationType, success });
                    if (success) {
                      addToast?.({
                        type: 'success',
                        title: 'Edit Applied',
                        message: `${operationType} completed successfully.`,
                      });
                    }
                  }}
                  onSeek={handleSeek}
                  onPlaybackStateChange={(isPlaying) => {
                    console.log('🎵 Playback state change:', isPlaying);
                    if (isPlaying !== audioState.isPlaying) {
                      handlePlayPause();
                    }
                  }}
                  onClipSelect={(clipId) => {
                    console.log('📋 Clip selected:', clipId);
                    setSelectedClipId(clipId);
                  }}
                  onClipReorder={async (clipId, newOrder) => {
                    console.log('🔄 Clip reorder requested:', { clipId, newOrder });
                    try {
                      const success = await projectActions.reorderClips(clipId, newOrder);
                      if (success) {
                        addToast?.({
                          type: 'success',
                          title: 'Clip Reordered',
                          message: 'Clip order updated successfully.',
                        });
                      } else {
                        addToast?.({
                          type: 'error',
                          title: 'Reorder Failed',
                          message: 'Failed to reorder clip.',
                        });
                      }
                    } catch (error) {
                      console.error('Clip reorder error:', error);
                      addToast?.({
                        type: 'error',
                        title: 'Reorder Error',
                        message: error instanceof Error ? error.message : 'Failed to reorder clip',
                      });
                    }
                  }}
                  onVolumeChange={handleVolumeChange}
                  onAudioSplit={(time) => {
                    console.log('✂️ Audio split requested at:', time.toFixed(2), 'seconds');
                    // TODO: Implement audio-based splitting
                    addToast?.({
                      type: 'info',
                      title: 'Audio Split',
                      message: `Split requested at ${time.toFixed(2)}s`,
                    });
                  }}
                  onAudioExport={(startTime, endTime) => {
                    console.log('📤 Audio export requested:', { startTime, endTime });
                    // TODO: Implement audio export
                    addToast?.({
                      type: 'info',
                      title: 'Audio Export',
                      message: `Export ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`,
                    });
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Glass Audio Player */}
      <GlassAudioPlayer
        isVisible={isGlassPlayerVisible}
        onClose={() => setIsGlassPlayerVisible(false)}
        isPlaying={audioState.isPlaying}
        currentTime={audioState.currentTime}
        duration={audioState.duration}
        volume={audioState.volume}
        speed={audioState.playbackRate}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onVolume={handleVolumeChange}
        onSpeedChange={handleSpeedChange}
        onSkipToClipStart={handleSkipToClipStart}
        onSkipToClipEnd={handleSkipToClipEnd}
        fileName={audioPath || 'No audio loaded'}
      />

      {/* Project Import Dialog */}
      {showProjectImportDialog && (
        <ProjectImportDialog
          isOpen={showProjectImportDialog}
          onClose={() => setShowProjectImportDialog(false)}
          onProjectLoaded={() => setShowProjectImportDialog(false)}
        />
      )}
    </div>
  );
};

export default NewUIShellV2;
