import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Play, Pause, SkipBack, SkipForward, Volume2, FileText, FolderOpen, Users, Scissors, Save, Type, Music, Settings, Palette, Download, File, ChevronDown } from 'lucide-react';
import { useProject, useSelectedJob } from '../../contexts';
import { useTheme } from '../theme-provider';
import { Segment, ClipSettings } from '../../types';
import { generateClipId, createContinuousClips } from '../../audio/AudioAppState';
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
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  
  const [currentApiKeys, setCurrentApiKeys] = useState<{ [service: string]: string }>({});
  const [currentColor, setCurrentColor] = useState<string>('#003223');
  const [transcriptTheme, setTranscriptTheme] = useState<'light' | 'dark'>('dark');

  // Apply initial transcript theme on component mount
  useEffect(() => {
    const applyTranscriptTheme = (theme: 'light' | 'dark') => {
      const root = document.documentElement;
      
      if (theme === 'light') {
        // Light transcript theme - white background with black text
        root.style.setProperty('--transcript-bg', '0 0% 100%');     // White background
        root.style.setProperty('--transcript-text', '0 0% 0%');     // Black text
      } else {
        // Dark transcript theme - dark grey background with white text  
        root.style.setProperty('--transcript-bg', '220 15% 15%');   // Dark grey background
        root.style.setProperty('--transcript-text', '0 0% 95%');    // White text
      }
    };

    applyTranscriptTheme(transcriptTheme);
  }, [transcriptTheme]);
  
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
  const isConverting = useMemo(() => {
    const status = (selectedJob as any)?.status || (selectedJob as any)?.state || (selectedJob as any)?.progress?.status;
    return status === 'processing' || status === 'pending';
  }, [selectedJob]);
  const { theme, setTheme } = useTheme();

  // Get audio file path from project and convert to file URL
  const [audioFileUrl, setAudioFileUrl] = useState<string | null>(null);
  
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

  // Use direct file:// URL for audio playback (stream from disk)
  useEffect(() => {
    if (!audioFilePath || isConverting) {
      setAudioFileUrl(null);
      return;
    }
    const fileUrl = `file://${encodeURI(audioFilePath)}`;
    setAudioFileUrl(fileUrl);
  }, [audioFilePath, isConverting]);

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
    
    const UI_DEBUG = (import.meta as any).env?.VITE_UI_DEBUG === 'true';
    if (UI_DEBUG) console.log('Segment grouping results:', {
      originalSegments: segments.length,
      groups: groups.length,
      averageSegmentsPerGroup: segments.length / groups.length,
      groupSizes: groups.map(g => g.length)
    });
    
    return groups;
  }, []);

  // Convert transcription segments to clips when transcription completes
  useEffect(() => {
    const UI_DEBUG = (import.meta as any).env?.VITE_UI_DEBUG === 'true';
    if (UI_DEBUG) console.log('Transcription conversion effect triggered with:', {
      hasSelectedJob: !!selectedJob,
      jobStatus: selectedJob?.status,
      hasSegments: !!selectedJob?.result?.segments,
      segmentCount: selectedJob?.result?.segments?.length || 0,
      hasProjectData: !!projectState.projectData,
      jobId: selectedJob?.id
    });
    const convertIfNeeded = async () => {
      if (selectedJob?.result?.segments && selectedJob.status === 'completed' && projectState.projectData) {
        // Check if we already have clips from transcription (avoid duplicate conversion)
        const currentClips = projectState.projectData.clips?.clips || [];
        const hasInitialClipOnly = currentClips.length === 1 && currentClips[0].type === 'initial';
        const alreadyHasTranscribedClips = currentClips.some(clip => clip.type === 'transcribed');
        
        if (UI_DEBUG) console.log('Transcription conversion check:', {
          hasInitialClipOnly,
          alreadyHasTranscribedClips,
          clipCount: currentClips.length,
          clipTypes: currentClips.map(c => c.type),
          jobId: selectedJob.id
        });
        
        if (hasInitialClipOnly && !alreadyHasTranscribedClips) {
          if (UI_DEBUG) console.log('Converting transcription segments to clips...');
          
          // Map word_segments to individual segments
          const wordSegments = selectedJob.result.word_segments || [];
          
          // Group segments into natural paragraphs
          const segmentGroups = groupSegmentsIntoParagraphs(selectedJob.result.segments, wordSegments);

          // Build clips from model-provided word timings, and add transport gap clips for continuous playback
          const computeClips = () => {
            // Convert grouped segments to clips
            const transcriptionClips = segmentGroups.map((group: any[], groupIndex: number) => {
            // Combine words provided by the model from segments in this group
            let allGroupWords = group.flatMap((seg: any) => (seg.words || []).map((w: any) => ({
              word: w.word || w.text || '',
              start: w.start,
              end: w.end,
              confidence: w.score || w.confidence || 1.0,
            })));
            // Do not synthesize fallback words; use only model-provided timings
            // Sort words by start time to ensure proper order
            allGroupWords.sort((a, b) => a.start - b.start);
            
            // Calculate group boundaries
            const firstSegment = group[0];
            const lastSegment = group[group.length - 1];
            let startTime = firstSegment.start || 0;
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
              id: generateClipId('clip'),
              startTime,
              endTime,
              startWordIndex: groupIndex * 1000, // Rough estimate, will be refined
              endWordIndex: (groupIndex + 1) * 1000,
              words: allGroupWords,
              text: combinedText,
              speaker: dominantSpeaker,
              confidence: group.reduce((acc, seg) => acc + (seg.confidence || 0.95), 0) / group.length,
              type: 'user-created' as const,
              duration: endTime - startTime,
              order: groupIndex,
              status: 'active' as const,
              createdAt: Date.now(),
              modifiedAt: Date.now(),
            };
            });
            // Create continuous clips with gaps using utility function
            const audioDuration = (projectState.projectData as any)?.project?.audio?.duration || 0;
            console.log('Gap generation debug:', {
              audioDuration,
              transcriptionClipsCount: transcriptionClips.length,
              firstClip: transcriptionClips[0] ? `${transcriptionClips[0].startTime}-${transcriptionClips[0].endTime}` : 'none',
              lastClip: transcriptionClips.length > 0 ? `${transcriptionClips[transcriptionClips.length-1].startTime}-${transcriptionClips[transcriptionClips.length-1].endTime}` : 'none'
            });
            const merged = createContinuousClips(transcriptionClips, audioDuration);

            const updatedProject = {
              ...projectState.projectData,
              transcription: {
                ...projectState.projectData.transcription,
                segments: selectedJob.result.segments,
              },
              clips: {
                ...projectState.projectData.clips,
                clips: merged,
              },
            };

            console.log('Updating project with transcription clips:', {
              speechCount: merged.filter(c => c.type !== 'audio-only').length,
              gapCount: merged.filter(c => c.type === 'audio-only').length,
              totalClips: merged.length,
              totalWords: merged.reduce((sum, c) => sum + (c.words?.length || 0), 0)
            });
            
            projectActions.updateProjectData(updatedProject);
          };

          // Build clips strictly from provided word timings
          computeClips();
        }
      }
    };

    // kick async conversion
    convertIfNeeded();
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
    
    const setHighlightCssFromHex = (hex: string) => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!m) return;
      const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
      const rr = r/255, gg = g/255, bb = b/255;
      const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
      let h = 0, s = 0; let l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max - min);
        switch (max) {
          case rr: h = (gg - bb) / d + (gg < bb ? 6 : 0); break;
          case gg: h = (bb - rr) / d + 2; break;
          case bb: h = (rr - gg) / d + 4; break;
        }
        h /= 6;
      }
      const H = Math.round(h * 360), S = Math.round(s * 100), L = Math.round(l * 100);
      const root = document.documentElement;
      root.style.setProperty('--highlight-bg', `${H} ${S}% ${L}%`);
      const srgb = [r, g, b].map(v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
      const lum = 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
      root.style.setProperty('--highlight-text', lum > 0.6 ? '0 0% 0%' : '0 0% 98%');
      const outlineL = Math.max(0, Math.min(100, lum > 0.5 ? L - 20 : L + 20));
      root.style.setProperty('--highlight-outline', `${H} ${Math.max(30, S)}% ${outlineL}%`);
    };

    const loadColorPreference = () => {
      try {
        const savedColor = localStorage.getItem('app-color-theme');
        if (savedColor) {
          setCurrentColor(savedColor);
        }
        const hl = localStorage.getItem('transcript-highlight-color');
        if (hl) setHighlightCssFromHex(hl);
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

  // Open isolated audio editor window (child BrowserWindow)
  const handleOpenAudioEditor = () => {
    const audio = projectState.projectData?.project?.audio as any;
    const filePath = audio?.extractedPath || audio?.embeddedPath || audio?.path || audio?.originalFile;
    if (!filePath) {
      console.warn('No audio file available for editor');
      return;
    }
    (window as any).electronAPI.openAudioEditor(filePath);
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
          audioUrl={audioFileUrl || undefined}
          disableAudio={isEditorOpen || isConverting}
          isGlassPlayerVisible={isGlassPlayerVisible}
          onCloseGlassPlayer={() => setIsGlassPlayerVisible(false)}
        />
      );
    }
    
    // Fallback to simple segment display
    return <SimpleSegmentDisplay segments={segments} />;
  };

  return (
    <div className="flex flex-col text-text overflow-hidden" style={{ height: '100dvh' }}>
      {/* Top Bar */}
      <TopBar
        mode={mode}
        onModeChange={setMode}
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={handleSidebarToggle}
        projectName={projectState.projectData?.project?.name}
        projectStatus="Ready"
        onOpenAudioEditor={handleOpenAudioEditor}
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
          openPanel === 'colors' ? 'Colors' :
          'Panel'
        }
      >
        {openPanel === 'speakers' && (
          <div className="px-4 py-0">
            <div className="space-y-3 mb-4">
              {speakers.map((speaker, index) => (
                <div key={speaker.id} className="flex items-center gap-3">
                  <input
                    className="flex-1 px-3 py-2 rounded bg-white bg-opacity-10 border border-white border-opacity-20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 text-sm min-w-0"
                    style={{ 
                      color: 'hsl(var(--text))', 
                      backgroundColor: 'hsl(var(--text) / 0.1)',
                      borderColor: 'hsl(var(--text) / 0.2)'
                    }}
                    value={((projectState.globalSpeakers as any)[speaker.id] ?? '') as string}
                    onChange={(e) => {
                      const next = { ...projectState.globalSpeakers, [speaker.id]: e.target.value } as any;
                      projectActions.updateSpeakers(next);
                    }}
                    placeholder={`Speaker ${index + 1}`}
                  />
                  {index > 0 && (
                    <button
                      onClick={() => {
                        // Remove this speaker from global speakers
                        const { [speaker.id]: removed, ...remainingSpeakers } = projectState.globalSpeakers as any;
                        projectActions.updateSpeakers(remainingSpeakers);
                      }}
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center opacity-50 hover:opacity-100 hover:text-red-400 transition-colors text-sm font-bold"
                      style={{ color: 'hsl(var(--text))' }}
                      title="Remove speaker"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <button
              onClick={() => {
                // Add new speaker functionality
                const newSpeakerId = `SPEAKER_${speakers.length.toString().padStart(2, '0')}`;
                const newSpeaker = {
                  id: newSpeakerId,
                  name: `Speaker ${speakers.length + 1}`,
                  segments: [],
                  totalDuration: 0
                };
                
                // Update global speakers with the new speaker
                const nextGlobalSpeakers = {
                  ...projectState.globalSpeakers,
                  [newSpeakerId]: `Speaker ${speakers.length + 1}`
                };
                projectActions.updateSpeakers(nextGlobalSpeakers);
                
                // For now, we'll just show it in the UI - ideally this should integrate with the project's speaker system
                console.log('Added new speaker:', newSpeaker);
              }}
              className="w-full px-3 py-2 rounded text-sm font-medium transition-colors"
              style={{ 
                backgroundColor: 'hsl(220 15% 15%)', 
                color: 'hsl(50 100% 95%)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(220 15% 10%)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'hsl(220 15% 15%)'}
            >
              + Add Speaker
            </button>
            
          </div>
        )}
        
        {openPanel === 'clips' && (
          <ClipsPanel
            clips={projectState.projectData?.clips?.clips || []}
            onClipPlay={(clip) => {
              // Seek to the clip's start time and start playing
              window.dispatchEvent(new CustomEvent('audio-seek-to-time', { 
                detail: { time: clip.startTime, shouldPlay: true } 
              }));
            }}
            onClipDelete={(clipId) => {
              // Mark clip as deleted in project data
              if (projectState.projectData?.clips?.clips) {
                const updatedClips = projectState.projectData.clips.clips.map(clip =>
                  clip.id === clipId ? { ...clip, status: 'deleted' as const } : clip
                );
                const updatedProjectData = {
                  ...projectState.projectData,
                  clips: {
                    ...projectState.projectData.clips,
                    clips: updatedClips
                  }
                };
                projectActions.updateProjectData(updatedProjectData);
              }
            }}
            onClipMerge={(clipIds) => {
              // Basic clip merging functionality
              if (projectState.projectData?.clips?.clips && clipIds.length >= 2) {
                const clips = projectState.projectData.clips.clips;
                const clipsToMerge = clips.filter(clip => clipIds.includes(clip.id));
                clipsToMerge.sort((a, b) => a.startTime - b.startTime);
                
                if (clipsToMerge.length >= 2) {
                  const firstClip = clipsToMerge[0];
                  const lastClip = clipsToMerge[clipsToMerge.length - 1];
                  
                  // Create merged clip
                  const mergedClip = {
                    ...firstClip,
                    id: `merged-${Date.now()}`,
                    endTime: lastClip.endTime,
                    duration: lastClip.endTime - firstClip.startTime,
                    text: clipsToMerge.map(c => c.text).join(' '),
                    words: clipsToMerge.flatMap(c => c.words || []),
                    type: 'user-created' as const,
                    createdAt: new Date().toISOString()
                  };
                  
                  // Remove original clips and add merged clip
                  const updatedClips = clips.filter(clip => !clipIds.includes(clip.id));
                  updatedClips.push(mergedClip);
                  
                  const updatedProjectData = {
                    ...projectState.projectData,
                    clips: {
                      ...projectState.projectData.clips,
                      clips: updatedClips
                    }
                  };
                  projectActions.updateProjectData(updatedProjectData);
                }
              }
            }}
            onClipReorder={(fromIndex, toIndex) => {
              // Use the same clip reordering system as the transcript editor
              if (projectState.projectData?.clips?.clips) {
                const allClips = projectState.projectData.clips.clips;
                // Filter to get only non-audio-only clips (same as ClipsPanel filter)
                const visibleClips = allClips.filter(clip => clip.type !== 'audio-only' && clip.status !== 'deleted');
                
                if (fromIndex >= 0 && toIndex >= 0 && fromIndex < visibleClips.length && toIndex < visibleClips.length) {
                  const srcClip = visibleClips[fromIndex];
                  const targetClip = visibleClips[toIndex];
                  
                  // Use the same event system as the transcript drag-and-drop
                  window.dispatchEvent(new CustomEvent('clip-reorder', {
                    detail: {
                      srcClipId: srcClip.id,
                      targetClipId: targetClip.id,
                      placeBefore: fromIndex > toIndex // If dragging upward, place before target
                    }
                  }));
                }
              }
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
            currentTranscriptTheme={transcriptTheme}
            onTranscriptThemeChange={setTranscriptTheme}
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

    </div>
  );
};

export default NewUIShell;
