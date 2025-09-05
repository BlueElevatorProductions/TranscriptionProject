import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Play, Pause, SkipBack, SkipForward, Volume2, FileText, FolderOpen, Users, Scissors, Save, Type, Music, Settings, Palette, Download, File, ChevronDown } from 'lucide-react';
import { useProject, useSelectedJob } from '../../contexts';
import { useTheme } from '../theme-provider';
import { Segment, ClipSettings } from '../../types';
import SecondaryPanel from '../SecondaryPanel';
import SpeakersPanel from '../shared/SpeakersPanel';
import { AudioSystemIntegration } from '../AudioSystemIntegration';
import ClipsPanel from '../shared/ClipsPanel';
import FontsPanel, { FontSettings } from '../shared/FontsPanel';
import ApiSettings from '../Settings/ApiSettings';

// Define Speaker interface to match what's used in the component
interface Speaker {
  id: string;
  name: string;
  segments?: any[];
  totalDuration?: number;
  totalTime?: number;
  color?: string;
}
import ColorSettings from '../Settings/ColorSettings';
import ImportSettings from '../Settings/ImportSettings';
import { GlassAudioPlayer } from './GlassAudioPlayer';
import TopBar from './TopBar';

interface NewUIShellProps {
  // Any props from parent component
}

// Enhanced Sidebar
export const EnhancedSidebar: React.FC<{ 
  collapsed: boolean;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onImportAudio: () => void;
  onExportProject: () => void;
  onOpenFonts: () => void;
  onOpenSpeakers: () => void;
  onOpenClips: () => void;
  onOpenApiSettings: () => void;
  onOpenColorSettings: () => void;
  onOpenPlayback: () => void;
}> = ({ 
  collapsed, 
  onNewProject, 
  onOpenProject, 
  onSaveProject,
  onImportAudio,
  onExportProject,
  onOpenFonts,
  onOpenSpeakers,
  onOpenClips,
  onOpenApiSettings,
  onOpenColorSettings,
  onOpenPlayback
}) => {
  return (
    <aside 
      className={`${collapsed ? 'sidebar-width-collapsed' : 'sidebar-width'} vibrancy-sidebar flex flex-col h-full transition-all duration-300 ease-in-out overflow-hidden`}
    >
      {/* File Menu */}
      <div className={`${collapsed ? 'px-2' : 'px-4'} pt-4 pb-4`}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={`w-full flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2'} text-sm hover:bg-hover-bg rounded-lg transition-colors`}
              title={collapsed ? "File" : undefined}
            >
              <File size={16} />
              {!collapsed && (
                <>
                  <span>File</span>
                  <ChevronDown size={12} className="ml-auto" />
                </>
              )}
            </button>
          </DropdownMenu.Trigger>
          
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[200px] bg-surface border border-border rounded-lg shadow-lg p-1 z-50"
              sideOffset={5}
              align={collapsed ? "start" : "center"}
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover-bg rounded-md cursor-pointer outline-none"
                onClick={onNewProject}
              >
                <FileText size={16} />
                <span>New Project</span>
              </DropdownMenu.Item>
              
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover-bg rounded-md cursor-pointer outline-none"
                onClick={onOpenProject}
              >
                <FolderOpen size={16} />
                <span>Open Project</span>
              </DropdownMenu.Item>
              
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover-bg rounded-md cursor-pointer outline-none"
                onClick={onSaveProject}
              >
                <Save size={16} />
                <span>Save Project</span>
              </DropdownMenu.Item>
              
              <DropdownMenu.Separator className="h-px bg-border my-1" />
              
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover-bg rounded-md cursor-pointer outline-none"
                onClick={onImportAudio}
              >
                <Music size={16} />
                <span>Import Audio</span>
              </DropdownMenu.Item>
              
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover-bg rounded-md cursor-pointer outline-none"
                onClick={onExportProject}
              >
                <Download size={16} />
                <span>Export</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Panel Controls */}
      <div className={`${collapsed ? 'px-2' : 'px-4'} py-4 flex-1`}>
        <div className="space-y-2">
          <button
            onClick={onOpenSpeakers}
            className={`w-full flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2'} text-sm hover:bg-hover-bg rounded-lg transition-colors`}
            title={collapsed ? "Speakers" : undefined}
          >
            <Users size={16} />
            {!collapsed && <span>Speakers</span>}
          </button>
          <button
            onClick={onOpenClips}
            className={`w-full flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2'} text-sm hover:bg-hover-bg rounded-lg transition-colors`}
            title={collapsed ? "Clips" : undefined}
          >
            <Scissors size={16} />
            {!collapsed && <span>Clips</span>}
          </button>
          <button
            onClick={onOpenFonts}
            className={`w-full flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2'} text-sm hover:bg-hover-bg rounded-lg transition-colors`}
            title={collapsed ? "Fonts" : undefined}
          >
            <Type size={16} />
            {!collapsed && <span>Fonts</span>}
          </button>
          <button
            onClick={onOpenApiSettings}
            className={`w-full flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2'} text-sm hover:bg-hover-bg rounded-lg transition-colors`}
            title={collapsed ? "API Settings" : undefined}
          >
            <Settings size={16} />
            {!collapsed && <span>API Settings</span>}
          </button>
          <button
            onClick={onOpenColorSettings}
            className={`w-full flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2'} text-sm hover:bg-hover-bg rounded-lg transition-colors`}
            title={collapsed ? "Colors" : undefined}
          >
            <Palette size={16} />
            {!collapsed && <span>Colors</span>}
          </button>
          <button
            onClick={onOpenPlayback}
            className={`w-full flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2'} text-sm hover:bg-hover-bg rounded-lg transition-colors`}
            title={collapsed ? "Playback" : undefined}
          >
            <Play size={16} />
            {!collapsed && <span>Playback</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

// Simple transcript display component for segments (fallback)
const SimpleSegmentDisplay: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  if (!segments || segments.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No transcript available</p>
          <p className="text-sm text-gray-500">
            Import an audio file and run transcription to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {segments.map((segment, index) => (
        <div key={index} className="border-l-2 border-blue-200 pl-4">
          <div className="text-xs text-gray-500 mb-1">
            {segment.speaker || 'Unknown Speaker'} • {segment.start?.toFixed(1)}s - {segment.end?.toFixed(1)}s
          </div>
          <div className="text-gray-800 leading-relaxed">
            {segment.text}
          </div>
        </div>
      ))}
    </div>
  );
};

// Main Shell Component
const NewUIShell: React.FC<NewUIShellProps> = () => {
  const [mode, setMode] = useState<'listen' | 'edit'>('listen');
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  
  const [currentApiKeys, setCurrentApiKeys] = useState<{ [service: string]: string }>({});
  const [currentColor, setCurrentColor] = useState<string>('#003223');
  
  // Font settings state - load from project or use defaults
  const [fontSettings, setFontSettings] = useState<FontSettings>({
    fontFamily: 'Avenir',
    fontSize: 18
  });

  // GlassAudioPlayer state management
  const [isGlassPlayerVisible, setIsGlassPlayerVisible] = useState<boolean>(false);

  // Get contexts
  const { state: projectState, actions: projectActions } = useProject();
  const { selectedJob } = useSelectedJob();
  const { theme, setTheme } = useTheme();

  // Get audio file path from project and convert to blob URL
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  
  const audioFilePath = useMemo(() => {
    const audio = projectState.projectData?.project?.audio as any;
    if (!audio) return null;
    // Prefer freshly extracted temp path from loaded packages, then embeddedPath, then external path, then original
    return (
      audio.extractedPath ||
      audio.embeddedPath ||
      audio.path ||
      audio.originalFile ||
      null
    );
  }, [projectState.projectData]);

  // Convert audio file path to blob URL for web playback
  useEffect(() => {
    let blobUrl: string | null = null;
    
    const loadAudioBlob = async () => {
      if (!audioFilePath) {
        setAudioBlobUrl(null);
        return;
      }

      try {
        console.log('Converting audio file to blob URL:', audioFilePath);
        
        // Read audio file as ArrayBuffer through IPC
        const audioBuffer = await (window as any).electronAPI.readAudioFile(audioFilePath);
        
        if (!audioBuffer || audioBuffer.byteLength === 0) {
          throw new Error('Audio file is empty or could not be read');
        }
        
        // Get audio MIME type based on file extension
        const getAudioMimeType = (filePath: string): string => {
          const ext = filePath.toLowerCase().split('.').pop();
          switch (ext) {
            case 'mp3': return 'audio/mpeg';
            case 'wav': return 'audio/wav';
            case 'm4a': return 'audio/mp4';
            case 'flac': return 'audio/flac';
            case 'ogg': return 'audio/ogg';
            case 'webm': return 'audio/webm';
            default: return 'audio/wav';
          }
        };
        
        // Create blob from buffer
        const mimeType = getAudioMimeType(audioFilePath);
        const blob = new Blob([audioBuffer], { type: mimeType });
        blobUrl = URL.createObjectURL(blob);
        
        console.log('Audio blob URL created successfully');
        setAudioBlobUrl(blobUrl);
        
      } catch (error) {
        console.error('Failed to load audio file:', error);
        setAudioBlobUrl(null);
      }
    };

    loadAudioBlob();
    
    // Cleanup blob URL on unmount or path change
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [audioFilePath]);

  // Update font settings when project data changes
  useEffect(() => {
    if (projectState.projectData?.fontSettings) {
      setFontSettings(projectState.projectData.fontSettings);
    } else {
      // Use defaults for new projects
      setFontSettings({
        fontFamily: 'Avenir',
        fontSize: 18
      });
    }
  }, [projectState.projectData]);

  // Get segments for fallback display
  const segments = useMemo(() => {
    if (selectedJob?.result?.segments) {
      return selectedJob.result.segments;
    } else if (projectState.projectData?.transcription?.segments) {
      return projectState.projectData.transcription.segments;
    }
    return [];
  }, [selectedJob, projectState.projectData]);

  // Group segments into natural paragraphs
  const groupSegmentsIntoParagraphs = useCallback((segments: any[], wordSegments: any[], settings?: ClipSettings['grouping']) => {
    const defaultSettings: ClipSettings['grouping'] = {
      pauseThreshold: 1.2,
      maxClipDuration: 30,
      minWordsPerClip: 20,
      maxWordsPerClip: 120,
      sentenceTerminators: ['.', '!', '?', '。', '！', '？']
    };
    
    const groupingSettings = settings || defaultSettings;
    const groups: any[][] = [];
    let currentGroup: any[] = [];
    let currentWordCount = 0;
    let currentDuration = 0;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentWords = wordSegments.filter((word: any) => 
        word.start >= segment.start && word.end <= segment.end
      );
      const segmentWordCount = segmentWords.length || segment.text?.split(' ').length || 0;
      const segmentDuration = (segment.end || 0) - (segment.start || 0);
      
      // Check if we should start a new group
      let shouldBreak = false;
      
      // Always break on speaker change
      if (currentGroup.length > 0 && segment.speaker !== currentGroup[0].speaker) {
        shouldBreak = true;
      }
      
      // Break on long pause
      if (currentGroup.length > 0) {
        const prevSegment = currentGroup[currentGroup.length - 1];
        const pauseDuration = (segment.start || 0) - (prevSegment.end || 0);
        if (pauseDuration > groupingSettings.pauseThreshold) {
          shouldBreak = true;
        }
      }
      
      // Break if adding this segment would exceed limits
      const newWordCount = currentWordCount + segmentWordCount;
      const newDuration = currentDuration + segmentDuration;
      
      if (currentGroup.length > 0 && (
        newWordCount > groupingSettings.maxWordsPerClip ||
        newDuration > groupingSettings.maxClipDuration
      )) {
        shouldBreak = true;
      }
      
      // Break on sentence terminators if we have enough content
      if (currentGroup.length > 0 && 
          currentWordCount >= groupingSettings.minWordsPerClip &&
          segment.text &&
          groupingSettings.sentenceTerminators.some(terminator => 
            segment.text.trim().endsWith(terminator)
          )) {
        shouldBreak = true;
      }
      
      if (shouldBreak) {
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
        }
        currentGroup = [segment];
        currentWordCount = segmentWordCount;
        currentDuration = segmentDuration;
      } else {
        currentGroup.push(segment);
        currentWordCount = newWordCount;
        currentDuration = newDuration;
      }
    }
    
    // Add the final group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    console.log('Segment grouping results:', {
      originalSegments: segments.length,
      groups: groups.length,
      averageSegmentsPerGroup: segments.length / groups.length,
      groupSizes: groups.map(g => g.length)
    });
    
    return groups;
  }, []);

  // Convert transcription segments to clips when transcription completes
  useEffect(() => {
    console.log('Transcription conversion effect triggered with:', {
      hasSelectedJob: !!selectedJob,
      jobStatus: selectedJob?.status,
      hasSegments: !!selectedJob?.result?.segments,
      segmentCount: selectedJob?.result?.segments?.length || 0,
      hasProjectData: !!projectState.projectData,
      jobId: selectedJob?.id
    });

    if (selectedJob?.result?.segments && selectedJob.status === 'completed' && projectState.projectData) {
      // Check if we already have clips from transcription (avoid duplicate conversion)
      const currentClips = projectState.projectData.clips?.clips || [];
      const hasInitialClipOnly = currentClips.length === 1 && currentClips[0].type === 'initial';
      const alreadyHasTranscribedClips = currentClips.some(clip => clip.type === 'transcribed');
      
      console.log('Transcription conversion check:', {
        hasInitialClipOnly,
        alreadyHasTranscribedClips,
        clipCount: currentClips.length,
        clipTypes: currentClips.map(c => c.type),
        jobId: selectedJob.id
      });
      
      if (hasInitialClipOnly && !alreadyHasTranscribedClips) {
        console.log('Converting transcription segments to clips...');
        
        // Map word_segments to individual segments
        const wordSegments = selectedJob.result.word_segments || [];
        
        // Group segments into natural paragraphs
        const segmentGroups = groupSegmentsIntoParagraphs(selectedJob.result.segments, wordSegments);
        
        // Convert grouped segments to clips
        const transcriptionClips = segmentGroups.map((group: any[], groupIndex: number) => {
          // Combine all words from all segments in this group
          let allGroupWords = group.flatMap(segment => {
            return wordSegments.filter((word: any) => 
              word.start >= segment.start && word.end <= segment.end
            );
          });
          
          // If no word-level data found, create placeholder words from text
          if (allGroupWords.length === 0) {
            allGroupWords = group.flatMap(segment => {
              if (!segment.text) return [];
              
              const words = segment.text.split(' ').filter((w: string) => w.trim().length > 0);
              const segmentDuration = (segment.end || 0) - (segment.start || 0);
              const wordDuration = segmentDuration / words.length;
              
              return words.map((word: string, wordIndex: number) => ({
                word: word,
                start: (segment.start || 0) + (wordIndex * wordDuration),
                end: (segment.start || 0) + ((wordIndex + 1) * wordDuration),
                confidence: segment.confidence || 0.95
              }));
            });
            
            console.log(`Created ${allGroupWords.length} placeholder words for group ${groupIndex}`);
          }
          
          // Sort words by start time to ensure proper order
          allGroupWords.sort((a, b) => a.start - b.start);
          
          // Calculate group boundaries
          const firstSegment = group[0];
          const lastSegment = group[group.length - 1];
          const startTime = firstSegment.start || 0;
          const endTime = lastSegment.end || 0;
          
          // Combine all text from the group
          const combinedText = group.map(seg => seg.text).filter(Boolean).join(' ');
          
          // Use the most common speaker in the group
          const speakerCounts = group.reduce((acc: Record<string, number>, seg) => {
            const speaker = seg.speaker || 'SPEAKER_00';
            acc[speaker] = (acc[speaker] || 0) + 1;
            return acc;
          }, {});
          const dominantSpeaker = Object.keys(speakerCounts).reduce((a, b) => 
            speakerCounts[a] > speakerCounts[b] ? a : b
          );
          
          console.log(`Group ${groupIndex}:`, {
            segmentCount: group.length,
            text: combinedText.substring(0, 100) + (combinedText.length > 100 ? '...' : ''),
            wordCount: allGroupWords.length,
            timeRange: `${startTime}-${endTime}`,
            duration: endTime - startTime,
            speaker: dominantSpeaker
          });
          
          return {
            id: `paragraph-${groupIndex}`,
            startTime,
            endTime,
            startWordIndex: groupIndex * 1000, // Rough estimate, will be refined
            endWordIndex: (groupIndex + 1) * 1000,
            words: allGroupWords,
            text: combinedText,
            speaker: dominantSpeaker,
            confidence: group.reduce((acc, seg) => acc + (seg.confidence || 0.95), 0) / group.length,
            type: 'paragraph-break' as const,
            duration: endTime - startTime,
            order: groupIndex,
            status: 'active' as const,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          };
        });

        // Update project with transcription clips
        const updatedProject = {
          ...projectState.projectData,
          transcription: {
            ...projectState.projectData.transcription,
            segments: selectedJob.result.segments,
          },
          clips: {
            ...projectState.projectData.clips,
            clips: transcriptionClips,
          },
        };

        console.log('Updating project with transcription clips:', {
          clipCount: transcriptionClips.length,
          clipsWithText: transcriptionClips.filter(c => c.text.length > 0).length,
          totalWords: transcriptionClips.reduce((sum, c) => sum + c.words.length, 0)
        });
        
        projectActions.updateProjectData(updatedProject);
      }
    }
  }, [selectedJob?.id, selectedJob?.status, projectState.projectData?.clips?.clips?.length, projectActions]);

  // Load API keys and color preference on component mount
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
    
    const loadColorPreference = () => {
      try {
        const savedColor = localStorage.getItem('app-color-theme');
        if (savedColor) {
          setCurrentColor(savedColor);
        }
      } catch (error) {
        console.error('Failed to load color preference:', error);
      }
    };

    loadApiKeys();
    loadColorPreference();
  }, []);

  // Load saved API keys on startup
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        if (window.electronAPI?.getApiKeys) {
          const savedKeys = await window.electronAPI.getApiKeys();
          if (savedKeys) {
            setCurrentApiKeys(savedKeys);
          }
        }
      } catch (error) {
        console.error('Failed to load API keys:', error);
      }
    };

    loadApiKeys();
  }, []);

  // Theme toggle IPC listener
  useEffect(() => {
    const handleThemeToggle = () => {
      const newTheme = theme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    };

    // Set up IPC listener
    if (window.electronAPI?.onToggleTheme) {
      window.electronAPI.onToggleTheme(handleThemeToggle);
    }

    // Cleanup function
    return () => {
      // Remove listener if cleanup is available
      // (In this simple case, we don't need explicit cleanup)
    };
  }, [theme, setTheme]);

  // API Keys handlers
  const handleApiKeySave = async (apiKeys: { [service: string]: string }) => {
    try {
      if (window.electronAPI?.saveApiKeys) {
        await window.electronAPI.saveApiKeys(apiKeys);
        setCurrentApiKeys(apiKeys);
        setOpenPanel(null);
      }
    } catch (error) {
      console.error('Failed to save API keys:', error);
    }
  };

  const handleApiKeyCancel = () => {
    setOpenPanel(null);
  };

  // GlassAudioPlayer handlers
  const handleToggleGlassPlayer = () => {
    console.log('Toggling GlassAudioPlayer:', !isGlassPlayerVisible);
    setIsGlassPlayerVisible(!isGlassPlayerVisible);
  };

  // Color settings handlers
  const handleColorChange = (color: string) => {
    setCurrentColor(color);
    
    // Save to localStorage for persistence across sessions
    try {
      localStorage.setItem('app-color-theme', color);
    } catch (error) {
      console.error('Failed to save color preference:', error);
    }
  };

  // Extract speakers from segments AND globalSpeakers
  const speakers: Speaker[] = useMemo(() => {
    const speakerMap = new Map();
    const globalSpeakers = projectState.globalSpeakers || {};
    
    // Get segments from current project
    const segments = projectState.projectData?.transcription?.segments || [];
    
    // First, add all speakers from segments
    segments.forEach((segment: any) => {
      const speakerId = segment.speaker || 'SPEAKER_00';
      if (!speakerMap.has(speakerId)) {
        const speakerName = globalSpeakers[speakerId] || 
          (speakerId === 'SPEAKER_00' ? 'Speaker 1' : `Speaker ${speakerId.replace('SPEAKER_', '')}`);
        speakerMap.set(speakerId, {
          id: speakerId,
          name: speakerName
        });
      }
    });
    
    // Then, add any additional speakers from globalSpeakers that aren't in segments
    Object.entries(globalSpeakers).forEach(([speakerId, speakerName]) => {
      if (!speakerMap.has(speakerId)) {
        speakerMap.set(speakerId, {
          id: speakerId,
          name: speakerName as string
        });
      }
    });
    
    const result = Array.from(speakerMap.values());
    
    // If no speakers found but we have segments, create default speakers
    if (result.length === 0 && segments.length > 0) {
      const speakerIds = [...new Set(segments.map((seg: any) => seg.speaker).filter(Boolean))];
      
      return speakerIds.map((speakerId: string) => ({
        id: speakerId,
        name: globalSpeakers[speakerId] || 
          (speakerId === 'SPEAKER_00' ? 'Speaker 1' : `Speaker ${speakerId.replace('SPEAKER_', '')}`)
      }));
    }
    
    return result;
  }, [projectState.projectData?.transcription?.segments, projectState.globalSpeakers]);

  // Handle speaker changes
  const handleSpeakersChange = (updatedSpeakers: Speaker[]) => {
    const speakerMappings = updatedSpeakers.reduce((acc, speaker) => {
      acc[speaker.id] = speaker.name;
      return acc;
    }, {} as { [key: string]: string });
    
    projectActions.updateSpeakers(speakerMappings);
  };

  // Handle project actions
  const handleNewProject = () => {
    const event = new CustomEvent('open-new-project');
    window.dispatchEvent(event);
  };

  const handleOpenProject = () => {
    const event = new CustomEvent('open-project-import');
    window.dispatchEvent(event);
  };

  const handleSaveProject = async () => {
    try {
      await projectActions.saveProject();
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleExportProject = () => {
    const event = new CustomEvent('open-export-dialog');
    window.dispatchEvent(event);
  };

  const handleImportAudio = () => {
    const event = new CustomEvent('open-import-dialog');
    window.dispatchEvent(event);
  };

  // Font settings handlers
  const handleFontChange = (newSettings: FontSettings) => {
    setFontSettings(newSettings);
    
    // Save to project data
    if (projectState.projectData) {
      const updatedProjectData = {
        ...projectState.projectData,
        fontSettings: newSettings
      };
      projectActions.updateProjectData(updatedProjectData);
    }
  };

  // Sidebar toggle handler
  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Render the main content area
  const renderMainContent = () => {
    // If we have clips data, use the new AudioSystemIntegration
    if (projectState.projectData?.clips?.clips && projectState.projectData.clips.clips.length > 0) {
      return (
        <AudioSystemIntegration
          mode={mode as 'listen' | 'edit'}
          fontSettings={fontSettings}
          audioUrl={audioBlobUrl || undefined}
        />
      );
    }
    
    // Fallback to simple segment display
    return <SimpleSegmentDisplay segments={segments} />;
  };

  return (
    <div className="flex flex-col h-screen text-text overflow-hidden">
      {/* Top Bar */}
      <TopBar
        mode={mode}
        onModeChange={setMode}
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={handleSidebarToggle}
        projectName={projectState.projectData?.project?.name}
        projectStatus="Ready"
      />
      
      {/* Main horizontal layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <EnhancedSidebar
        collapsed={sidebarCollapsed}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onImportAudio={handleImportAudio}
        onExportProject={handleExportProject}
        onOpenFonts={() => setOpenPanel(openPanel === 'fonts' ? null : 'fonts')}
        onOpenSpeakers={() => setOpenPanel(openPanel === 'speakers' ? null : 'speakers')}
        onOpenClips={() => setOpenPanel(openPanel === 'clips' ? null : 'clips')}
        onOpenApiSettings={() => setOpenPanel(openPanel === 'api' ? null : 'api')}
        onOpenColorSettings={() => setOpenPanel(openPanel === 'colors' ? null : 'colors')}
        onOpenPlayback={handleToggleGlassPlayer}
      />

      {/* Secondary Panel */}
      <SecondaryPanel
        open={openPanel !== null}
        onClose={() => setOpenPanel(null)}
        title={
          openPanel === 'speakers' ? 'Speakers' :
          openPanel === 'clips' ? 'Clips' :
          openPanel === 'fonts' ? 'Font Settings' :
          openPanel === 'api' ? 'API Settings' :
          openPanel === 'colors' ? 'Color Settings' :
          'Panel'
        }
      >
        {openPanel === 'speakers' && (
          <div className="p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Speakers</h2>
            <p className="text-white opacity-70 mb-4">Speaker management will be restored in a future update.</p>
            {speakers.map((speaker) => (
              <div key={speaker.id} className="mb-2 p-2 bg-white bg-opacity-10 rounded">
                <span className="text-white">{speaker.name}</span>
              </div>
            ))}
            <button
              onClick={() => setOpenPanel(null)}
              className="mt-4 px-3 py-1 bg-white bg-opacity-20 text-white rounded hover:bg-opacity-30"
            >
              Close
            </button>
          </div>
        )}
        
        {openPanel === 'clips' && (
          <ClipsPanel
            clips={projectState.projectData?.clips?.clips || []}
            onClipEdit={(clipId, updatedClip) => {
              console.log('Clip edit not yet implemented in new system');
            }}
            onClipDelete={(clipId) => {
              console.log('Clip deletion not yet implemented in new system');
            }}
            onClipPlay={(clip) => {
              console.log('Clip play will be handled by AudioSystemIntegration');
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
        
        {openPanel === 'api' && (
          <ApiSettings
            currentKeys={currentApiKeys}
            onSave={handleApiKeySave}
            onCancel={handleApiKeyCancel}
          />
        )}
        
        {openPanel === 'colors' && (
          <ColorSettings
            currentColor={currentColor}
            onColorChange={handleColorChange}
            onClose={() => setOpenPanel(null)}
          />
        )}
        
      </SecondaryPanel>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {renderMainContent()}
          </div>
        </main>
      </div>

      {/* Glass Audio Player */}
      <GlassAudioPlayer
        isVisible={isGlassPlayerVisible}
        isPlaying={false}
        currentTime={0}
        duration={0}
        volume={1}
        speed={1}
        fileName="Demo Audio"
        onPlayPause={() => console.log('Play/Pause')}
        onSeek={(time) => console.log('Seek to:', time)}
        onSkipToClipStart={() => console.log('Skip to clip start')}
        onSkipToClipEnd={() => console.log('Skip to clip end')}
        onVolume={(volume) => console.log('Volume:', volume)}
        onSpeedChange={(speed) => console.log('Speed:', speed)}
        onClose={() => setIsGlassPlayerVisible(false)}
      />
    </div>
  );
};

export default NewUIShell;
