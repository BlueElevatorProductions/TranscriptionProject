import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Play, Pause, SkipBack, SkipForward, Volume2, FileText, FolderOpen, Users, Scissors, Save, Type, Music, Settings, Palette, Download } from 'lucide-react';
import { useProject, useSelectedJob } from '../../contexts';
import { Segment } from '../../types';
import SecondaryPanel from '../SecondaryPanel';
import SpeakersPanel, { Speaker } from '../SpeakersPanel';
import { AudioSystemIntegration } from '../AudioSystemIntegration';
import ClipsPanel from '../shared/ClipsPanel';
import FontsPanel, { FontSettings } from '../shared/FontsPanel';
import ApiSettings from '../Settings/ApiSettings';
import ColorSettings from '../Settings/ColorSettings';
import ImportSettings from '../Settings/ImportSettings';
import { GlassAudioPlayer } from './GlassAudioPlayer';

interface NewUIShellProps {
  // Any props from parent component
}

// Enhanced Sidebar with Mode Tabs
export const EnhancedSidebar: React.FC<{ 
  mode: string; 
  onModeChange: (mode: string) => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onOpenFonts: () => void;
  onOpenSpeakers: () => void;
  onOpenClips: () => void;
  onOpenApiSettings: () => void;
  onOpenColorSettings: () => void;
  onOpenImportSettings: () => void;
  onOpenPlayback: () => void;
  onExportProject: () => void;
}> = ({ 
  mode, 
  onModeChange, 
  onNewProject, 
  onOpenProject, 
  onSaveProject,
  onOpenFonts,
  onOpenSpeakers,
  onOpenClips,
  onOpenApiSettings,
  onOpenColorSettings,
  onOpenImportSettings,
  onOpenPlayback,
  onExportProject
}) => {
  return (
    <aside className="w-64 vibrancy-sidebar border-r border-glass-border-subtle flex flex-col h-full">
      {/* Mode Tabs */}
      <Tabs.Root value={mode} onValueChange={onModeChange} className="flex-1 flex flex-col">
        <Tabs.List className="grid grid-cols-2 gap-1 p-4">
          <Tabs.Trigger
            value="listen"
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors data-[state=active]:bg-accent data-[state=active]:text-white hover:bg-hover-bg"
          >
            Listen
          </Tabs.Trigger>
          <Tabs.Trigger
            value="edit"
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors data-[state=active]:bg-accent data-[state=active]:text-white hover:bg-hover-bg"
          >
            Edit
          </Tabs.Trigger>
        </Tabs.List>

        {/* Project Controls */}
        <div className="px-4 pb-4 border-b border-border">
          <div className="space-y-2">
            <button
              onClick={onNewProject}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-surface hover:bg-hover-bg rounded-lg transition-colors"
            >
              <FileText size={16} />
              New Project
            </button>
            <button
              onClick={onOpenProject}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-surface hover:bg-hover-bg rounded-lg transition-colors"
            >
              <FolderOpen size={16} />
              Open Project
            </button>
            <button
              onClick={onSaveProject}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-surface hover:bg-hover-bg rounded-lg transition-colors"
            >
              <Save size={16} />
              Save Project
            </button>
            <button
              onClick={onExportProject}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-surface hover:bg-hover-bg rounded-lg transition-colors"
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>

        {/* Panel Controls */}
        <div className="px-4 py-4 flex-1">
          <div className="space-y-2">
            <button
              onClick={onOpenSpeakers}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover-bg rounded-lg transition-colors"
            >
              <Users size={16} />
              Speakers
            </button>
            <button
              onClick={onOpenClips}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover-bg rounded-lg transition-colors"
            >
              <Scissors size={16} />
              Clips
            </button>
            <button
              onClick={onOpenFonts}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover-bg rounded-lg transition-colors"
            >
              <Type size={16} />
              Fonts
            </button>
            <button
              onClick={onOpenApiSettings}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover-bg rounded-lg transition-colors"
            >
              <Settings size={16} />
              API Settings
            </button>
            <button
              onClick={onOpenColorSettings}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover-bg rounded-lg transition-colors"
            >
              <Palette size={16} />
              Colors
            </button>
            <button
              onClick={onOpenImportSettings}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover-bg rounded-lg transition-colors"
            >
              <Music size={16} />
              Import
            </button>
            <button
              onClick={onOpenPlayback}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover-bg rounded-lg transition-colors"
            >
              <Play size={16} />
              Playback
            </button>
          </div>
        </div>
      </Tabs.Root>
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
  const [mode, setMode] = useState<string>('listen');
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  
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

  // Get audio file path from project and convert to blob URL
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  
  const audioFilePath = useMemo(() => {
    if (projectState.projectData?.project?.audio?.embeddedPath) {
      return projectState.projectData.project.audio.embeddedPath;
    } else if (projectState.projectData?.project?.audio?.path) {
      return projectState.projectData.project.audio.path;
    }
    return null;
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
        
        // Convert segments to clips with proper word mapping
        const transcriptionClips = selectedJob.result.segments.map((segment: any, index: number) => {
          // Find words that belong to this segment based on timing
          let segmentWords = wordSegments.filter((word: any) => 
            word.start >= segment.start && word.end <= segment.end
          );
          
          // If no word-level data found, create placeholder words from text
          if (segmentWords.length === 0 && segment.text) {
            const words = segment.text.split(' ').filter(w => w.trim().length > 0);
            const segmentDuration = (segment.end || 0) - (segment.start || 0);
            const wordDuration = segmentDuration / words.length;
            
            segmentWords = words.map((word: string, wordIndex: number) => ({
              word: word,
              start: (segment.start || 0) + (wordIndex * wordDuration),
              end: (segment.start || 0) + ((wordIndex + 1) * wordDuration),
              confidence: segment.confidence || 0.95
            }));
            
            console.log(`Created ${segmentWords.length} placeholder words for segment ${index}`);
          }
          
          console.log(`Segment ${index}:`, {
            text: segment.text,
            wordCount: segmentWords.length,
            totalWordSegments: wordSegments.length,
            timeRange: `${segment.start}-${segment.end}`,
            hasWords: segmentWords.length > 0
          });
          
          return {
            id: `segment-${index}`,
            startTime: segment.start || 0,
            endTime: segment.end || 0,
            startWordIndex: index * 100, // Rough estimate, will be refined
            endWordIndex: (index + 1) * 100,
            words: segmentWords,
            text: segment.text || '',
            speaker: segment.speaker || 'SPEAKER_00',
            confidence: segment.confidence || 0.95,
            type: 'transcribed' as const,
            duration: (segment.end || 0) - (segment.start || 0),
            order: index,
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
      {/* Main horizontal layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <EnhancedSidebar
        mode={mode}
        onModeChange={setMode}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onOpenFonts={() => setOpenPanel('fonts')}
        onOpenSpeakers={() => setOpenPanel('speakers')}
        onOpenClips={() => setOpenPanel('clips')}
        onOpenApiSettings={() => setOpenPanel('api')}
        onOpenColorSettings={() => setOpenPanel('colors')}
        onOpenImportSettings={() => setOpenPanel('import')}
        onOpenPlayback={handleToggleGlassPlayer}
        onExportProject={handleExportProject}
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
          openPanel === 'import' ? 'Import Settings' :
          'Panel'
        }
      >
        {openPanel === 'speakers' && (
          <SpeakersPanel
            speakers={speakers}
            onChange={handleSpeakersChange}
            onClose={() => setOpenPanel(null)}
          />
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
        
        {openPanel === 'import' && (
          <ImportSettings
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