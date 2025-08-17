import React, { useState, useEffect, useRef } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Slider from '@radix-ui/react-slider';
import { Play, Pause, SkipBack, SkipForward, Volume2, FileText, FolderOpen, Users, Scissors, Save, Type, Music, Settings } from 'lucide-react';
import { useAudio, useProject, useSelectedJob } from '../../contexts';
import { Segment, SharedAudioState } from '../../types';
import SecondaryPanel from '../SecondaryPanel';
import SpeakersPanel, { Speaker } from '../SpeakersPanel';
import ClipBasedTranscript from './ClipBasedTranscript';
import ClipsPanel from '../shared/ClipsPanel';
import FontsPanel, { FontSettings } from '../shared/FontsPanel';
import { useClips } from '../TranscriptEdit/useClips';
import { GlassAudioPlayer } from './GlassAudioPlayer';
import ApiSettings from '../Settings/ApiSettings';

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
  onOpenPlayback: () => void;
  onOpenApiSettings: () => void;
}> = ({ mode, onModeChange, onNewProject, onOpenProject, onSaveProject, onOpenFonts, onOpenSpeakers, onOpenClips, onOpenPlayback, onOpenApiSettings }) => {
  return (
    <aside 
      className="bg-green-900 text-white font-arial w-64 h-full flex flex-col" 
      style={{ 
        backgroundColor: '#003223',
        width: '256px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        color: 'white',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* Logo/Title */}
      <div className="p-4 border-b border-white border-opacity-20">
        <h1 className="text-xl font-bold text-white">TranscriptApp</h1>
      </div>
      
      {/* Mode Tabs */}
      <Tabs.Root value={mode} onValueChange={onModeChange} className="flex-1 flex flex-col">
        <Tabs.List className="flex border-b border-white border-opacity-20">
          <Tabs.Trigger value="listen" className="flex-1 px-4 py-3 text-white hover:bg-white hover:bg-opacity-10 data-[state=active]:bg-white data-[state=active]:bg-opacity-20">
            Listen
          </Tabs.Trigger>
          <Tabs.Trigger value="edit" className="flex-1 px-4 py-3 text-white hover:bg-white hover:bg-opacity-10 data-[state=active]:bg-white data-[state=active]:bg-opacity-20">
            Edit
          </Tabs.Trigger>
        </Tabs.List>
        
        <div className="flex-1 p-4 space-y-6">
          {/* Document Settings */}
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-70">DOCUMENT</h3>
            
            {/* Project Actions */}
            <div className="space-y-2 mb-4">
              <button
                onClick={onNewProject}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white hover:bg-opacity-10 rounded transition-colors"
              >
                <FileText size={16} />
                New
              </button>
              <button
                onClick={onOpenProject}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white hover:bg-opacity-10 rounded transition-colors"
              >
                <FolderOpen size={16} />
                Open
              </button>
              <button
                onClick={onSaveProject}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white hover:bg-opacity-10 rounded transition-colors"
              >
                <Save size={16} />
                Save
              </button>
              <button
                onClick={onOpenFonts}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white hover:bg-opacity-10 rounded transition-colors"
              >
                <Type size={16} />
                Fonts
              </button>
            </div>
            
            <div className="space-y-3">
              {/* Speakers Panel Button */}
              <button
                onClick={onOpenSpeakers}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white hover:bg-opacity-10 rounded transition-colors"
              >
                <Users size={16} />
                Speakers
              </button>
              
              {/* Clips Panel Button (only in edit mode) */}
              {mode === 'edit' && (
                <button
                  onClick={onOpenClips}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white hover:bg-opacity-10 rounded transition-colors"
                >
                  <Scissors size={16} />
                  Clips
                </button>
              )}
            </div>
          </div>
          
          {/* Audio Settings */}
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-70">AUDIO</h3>
            <div className="space-y-2">
              <button
                onClick={onOpenPlayback}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white hover:bg-opacity-10 rounded transition-colors"
              >
                <Music size={16} />
                Playback
              </button>
            </div>
            <p className="text-xs opacity-60 mt-2">
              Control audio playback and navigation.
            </p>
          </div>
          
          {/* Settings */}
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-70">SETTINGS</h3>
            <div className="space-y-2">
              <button
                onClick={onOpenApiSettings}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white hover:bg-opacity-10 rounded transition-colors"
              >
                <Settings size={16} />
                API Keys
              </button>
            </div>
            <p className="text-xs opacity-60 mt-2">
              Configure transcription service API keys.
            </p>
          </div>
          
          {/* Clips Panel (if in edit mode) */}
          {mode === 'edit' && (
            <div>
              <h3 className="text-sm font-semibold mb-3 opacity-70">CLIPS</h3>
              <p className="text-xs opacity-60">
                Select text to create clips for export.
              </p>
            </div>
          )}
        </div>
      </Tabs.Root>
    </aside>
  );
};

// Enhanced Transcript Area
export const EnhancedTranscript: React.FC<{ 
  mode: string;
  fontSettings?: FontSettings;
  clipsHook?: {
    clips: any[];
    selectedClipId: string | null;
    findClipByWordIndex: (wordIndex: number) => any | null;
    selectClip: (clipId: string) => void;
    createNewClip: (splitWordIndex: number) => boolean;
    mergeClipWithAbove?: (clipId: string) => boolean;
    addNewSpeakerLabel: (wordIndex: number, speakerName: string) => boolean;
    getAdjustedPlaybackTime?: (deletedWordIds: Set<string>, targetTime: number) => number;
    getOriginalTimeFromAdjusted?: (deletedWordIds: Set<string>, adjustedTime: number) => number;
  };
}> = ({ mode, fontSettings, clipsHook }) => {
  const { state: audioState } = useAudio();
  const { state: projectState } = useProject();
  const { selectedJob } = useSelectedJob();
  const transcriptRef = useRef<HTMLDivElement>(null);
  
  // Helper function to get speaker display name
  const getSpeakerDisplayName = (speakerId: string): string => {
    const globalSpeakers = projectState.globalSpeakers || {};
    if (globalSpeakers[speakerId]) {
      return globalSpeakers[speakerId];
    }
    // Fallback to formatted speaker ID
    if (speakerId.startsWith('SPEAKER_')) {
      const speakerNumber = speakerId.replace('SPEAKER_', '');
      return `Speaker ${parseInt(speakerNumber) + 1}`;
    }
    return speakerId;
  };
  
  // Get segments from the selected job or project
  const segments: Segment[] = React.useMemo(() => {
    
    if (selectedJob?.result?.segments) {
      return selectedJob.result.segments;
    } else if (projectState.projectData?.transcription?.segments) {
      return projectState.projectData.transcription.segments;
    }
    return [];
  }, [selectedJob, projectState.projectData, projectState.globalSpeakers]);
  
  // Find current word based on audio time
  const currentWordIndex = React.useMemo(() => {
    if (!audioState.currentTime || segments.length === 0) return -1;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.words) {
        for (let j = 0; j < segment.words.length; j++) {
          const word = segment.words[j];
          if (audioState.currentTime >= word.start && audioState.currentTime <= word.end) {
            return { segmentIndex: i, wordIndex: j };
          }
        }
      }
    }
    return -1;
  }, [audioState.currentTime, segments]);
  
  const handleWordClick = (start: number) => {
    // Seek to word position
    if ((window as any).electronAPI?.seekTo) {
      (window as any).electronAPI.seekTo(start);
    }
  };
  
  
  // Use clips if available, otherwise fall back to segments
  const clips = clipsHook?.clips || [];
  const hasClips = clips.length > 0;
  
  if (!hasClips && segments.length === 0) {
    return (
      <main className="flex-1 p-8 bg-white font-transcript overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500 text-center py-12">
            No transcript loaded. Import an audio file to begin.
          </p>
        </div>
      </main>
    );
  }
  
  // If we have clips, render them with the same visual structure as Edit mode
  if (hasClips) {
    return (
      <main className="flex-1 p-8 bg-white font-transcript overflow-y-auto" ref={transcriptRef}>
        <div className="max-w-4xl mx-auto">
          {clips.map((clip, clipIndex) => (
            <div 
              key={clip.id} 
              className={`mb-12 p-6 border-l-4 rounded-r-lg shadow-sm ${
                clipsHook?.selectedClipId === clip.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              } ${clip.type === 'user-created' ? 'bg-green-50 border-green-400' : 'bg-white'}`}
              onClick={() => clipsHook?.selectClip(clip.id)}
            >
              {/* Clip header with speaker */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
                    {projectState.globalSpeakers?.[clip.speaker] || clip.speaker}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(clip.startTime * 1000).toISOString().substr(14, 5)} - {new Date(clip.endTime * 1000).toISOString().substr(14, 5)}
                  </span>
                </div>
              </div>
              
              {/* Clip content - read-only words */}
              <div 
                className="leading-[1.4] text-gray-900"
                style={{
                  fontFamily: fontSettings?.fontFamily || 'Avenir',
                  fontSize: `${fontSettings?.fontSize || 35}px`
                }}
              >
                {clip.words.map((word: any, wordIndex: number) => {
                  // Calculate if this word is currently playing
                  const isActive = audioState.currentTime >= word.start && audioState.currentTime <= word.end;
                  
                  return (
                    <React.Fragment key={`${clip.id}-${wordIndex}`}>
                      <span
                        className={`
                          cursor-pointer hover:bg-blue-100 transition-colors rounded px-1
                          ${isActive ? 'bg-blue-500 text-white' : ''}
                        `}
                        onClick={() => handleWordClick(word.start)}
                      >
                        {word.word}
                      </span>
                      {' '}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }
  
  // Fall back to segment-based rendering if no clips
  return (
    <main className="flex-1 p-8 bg-white font-transcript overflow-y-auto" ref={transcriptRef}>
      <div className="max-w-4xl mx-auto">
        {segments.map((segment, segIndex) => (
          <div key={segment.id} className="mb-6">
            {/* Speaker label */}
            {segment.speaker && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                  {getSpeakerDisplayName(segment.speaker)}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(segment.start * 1000).toISOString().substr(14, 5)}
                </span>
              </div>
            )}
            
            {/* Transcript text */}
            <p 
              className="leading-[1.4] text-gray-900"
              style={{
                fontFamily: fontSettings?.fontFamily || 'Avenir',
                fontSize: `${fontSettings?.fontSize || 35}px`
              }}
            >
              {segment.words?.map((word, wordIndex) => {
                const isActive = 
                  typeof currentWordIndex === 'object' &&
                  currentWordIndex.segmentIndex === segIndex && 
                  currentWordIndex.wordIndex === wordIndex;
                
                return (
                  <span
                    key={`${segment.id}-${wordIndex}`}
                    className={`
                      cursor-pointer hover:bg-blue-100 transition-colors
                      ${isActive ? 'bg-blue-500 text-white px-1 rounded' : ''}
                      ${mode === 'edit' ? 'hover:underline' : ''}
                    `}
                    onClick={() => handleWordClick(word.start)}
                  >
                    {word.word}{' '}
                  </span>
                );
              }) || segment.text}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
};

// Enhanced Audio Player
export const EnhancedAudioPlayer: React.FC = () => {
  const { state: audioState, actions: audioActions } = useAudio();
  const [volume, setVolume] = useState(100);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const handlePlayPause = () => {
    if (audioState.isPlaying) {
      audioActions.pause();
    } else {
      audioActions.play();
    }
  };
  
  const handleSkipBack = () => {
    // Skip back 15 seconds or to clip start
    const newTime = Math.max(0, audioState.currentTime - 15);
    audioActions.seek(newTime);
  };
  
  const handleSkipForward = () => {
    // Skip forward 15 seconds or to clip end
    const newTime = Math.min(audioState.duration, audioState.currentTime + 15);
    audioActions.seek(newTime);
  };
  
  const handleSeek = (value: number[]) => {
    audioActions.seek(value[0]);
  };
  
  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    audioActions.updateAudioState({ volume: value[0] / 100 });
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (!audioState.currentAudioPath) {
    return null;
  }
  
  return (
    <footer className="bg-player-bg border-t border-border p-4">
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        {/* Play controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSkipBack}
            className="p-2 rounded hover:bg-hover-bg transition-colors"
            aria-label="Skip back 15 seconds"
          >
            <SkipBack size={20} />
          </button>
          
          <button
            onClick={handlePlayPause}
            className="p-3 rounded-full bg-accent text-white hover:bg-accent/90 transition-colors"
            aria-label={audioState.isPlaying ? 'Pause' : 'Play'}
          >
            {audioState.isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          
          <button
            onClick={handleSkipForward}
            className="p-2 rounded hover:bg-hover-bg transition-colors"
            aria-label="Skip forward 15 seconds"
          >
            <SkipForward size={20} />
          </button>
        </div>
        
        {/* Time and progress */}
        <div className="flex-1 flex items-center gap-3">
          <span className="text-sm tabular-nums text-text-muted">
            {formatTime(audioState.currentTime)}
          </span>
          
          <Slider.Root
            value={[audioState.currentTime]}
            onValueChange={handleSeek}
            max={audioState.duration}
            step={0.1}
            className="relative flex-1 flex items-center h-8"
          >
            <Slider.Track className="relative bg-border h-1 flex-1 rounded">
              <Slider.Range className="absolute bg-accent h-full rounded" />
            </Slider.Track>
            <Slider.Thumb className="block w-4 h-4 bg-accent rounded-full hover:scale-110 transition-transform" />
          </Slider.Root>
          
          <span className="text-sm tabular-nums text-text-muted">
            {formatTime(audioState.duration)}
          </span>
        </div>
        
        {/* Volume and speed controls */}
        <div className="flex items-center gap-3">
          {/* Speed selector */}
          <select
            value={playbackSpeed}
            onChange={(e) => {
              const speed = parseFloat(e.target.value);
              setPlaybackSpeed(speed);
              audioActions.updateAudioState({ playbackSpeed: speed });
            }}
            className="px-2 py-1 bg-surface text-text rounded border border-border text-sm"
          >
            <option value="0.5">0.5×</option>
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
          
          {/* Volume control */}
          <div className="flex items-center gap-2 w-32">
            <Volume2 size={16} className="text-text-muted" />
            <Slider.Root
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              className="relative flex-1 flex items-center h-8"
            >
              <Slider.Track className="relative bg-border h-1 flex-1 rounded">
                <Slider.Range className="absolute bg-accent h-full rounded" />
              </Slider.Track>
              <Slider.Thumb className="block w-3 h-3 bg-accent rounded-full hover:scale-110 transition-transform" />
            </Slider.Root>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Main Shell Component
const NewUIShell: React.FC<NewUIShellProps> = () => {
  const [mode, setMode] = useState<string>('listen');
  const [speakersPanelOpen, setSpeakersPanelOpen] = useState(false);
  const [clipsPanelOpen, setClipsPanelOpen] = useState(false);
  const [fontsPanelOpen, setFontsPanelOpen] = useState(false);
  const [playbackPanelOpen, setPlaybackPanelOpen] = useState(false);
  const [apiSettingsPanelOpen, setApiSettingsPanelOpen] = useState(false);
  const [currentApiKeys, setCurrentApiKeys] = useState<{ [service: string]: string }>({});
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const isSeekingRef = useRef(false);
  
  // Font settings state
  const [fontSettings, setFontSettings] = useState<FontSettings>({
    fontFamily: 'Avenir',
    fontSize: 35
  });
  
  // Get contexts
  const { state: projectState, actions: projectActions } = useProject();
  const { selectedJob } = useSelectedJob();
  const { state: audioState, actions: audioActions } = useAudio();
  
  // Get segments for clips hook
  const segments = React.useMemo(() => {
    if (selectedJob?.result?.segments) {
      return selectedJob.result.segments;
    } else if (projectState.projectData?.transcription?.segments) {
      return projectState.projectData.transcription.segments;
    }
    return [];
  }, [selectedJob, projectState.projectData]);
  
  // Initialize clips hook
  const clipsHook = useClips({
    segments,
    speakerNames: projectState.globalSpeakers,
    setSpeakerNames: (speakers) => projectActions.updateSpeakers(speakers)
  });
  
  
  // Get audio file path from job or project
  const audioFilePath = React.useMemo(() => {
    if (selectedJob?.filePath) {
      return selectedJob.filePath;
    } else if (projectState.projectData?.audio?.originalFile) {
      return projectState.projectData.audio.originalFile;
    }
    return null;
  }, [selectedJob, projectState.projectData]);
  
  // Load audio file when path changes
  useEffect(() => {
    let blobUrl: string | null = null;
    
    const loadAudio = async () => {
      if (!audioFilePath) {
        setIsAudioReady(false);
        setAudioBlobUrl(null);
        return;
      }
      
      try {
        // Check if electronAPI is available
        if (!window.electronAPI || !window.electronAPI.readAudioFile) {
          throw new Error('Electron API not available');
        }
        
        // Read audio file as ArrayBuffer through IPC
        const audioBuffer = await window.electronAPI.readAudioFile(audioFilePath);
        
        if (!audioBuffer || audioBuffer.byteLength === 0) {
          throw new Error('Audio file is empty or could not be read');
        }
        
        // Get audio MIME type
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
        
        setAudioBlobUrl(blobUrl);
      } catch (error) {
        console.error('NewUIShell - Failed to load audio file:', error);
      }
    };
    
    loadAudio();
    
    // Cleanup blob URL
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [audioFilePath]);
  
  // Set up audio element when blob URL is ready
  useEffect(() => {
    if (audioRef.current && audioBlobUrl && audioRef.current.src !== audioBlobUrl) {
      audioRef.current.src = audioBlobUrl;
      
      const handleLoadedData = () => {
        setIsAudioReady(true);
        setDuration(audioRef.current?.duration || 0);
        audioActions.setAudioSource(audioFilePath || '', audioRef.current?.duration || 0);
      };
      
      const handleCanPlay = () => {
        setIsAudioReady(true);
        setDuration(audioRef.current?.duration || 0);
      };
      
      // Handle time updates for word highlighting
      let updateInterval: NodeJS.Timeout | null = null;
      
      const startTimeUpdates = () => {
        if (updateInterval) {
          clearInterval(updateInterval);
        }
        updateInterval = setInterval(() => {
          if (audioRef.current && !isSeekingRef.current && !audioRef.current.paused) {
            // Add small offset to compensate for processing delays
            const audioTime = audioRef.current.currentTime + 0.05; // 50ms ahead
            audioActions.updateAudioState({ currentTime: audioTime });
          }
        }, 50); // 50ms = 20 updates per second
      };
      
      const handlePlay = () => {
        startTimeUpdates();
      };
      
      const handlePause = () => {
        if (updateInterval) {
          clearInterval(updateInterval);
          updateInterval = null;
        }
      };
      
      audioRef.current.addEventListener('loadeddata', handleLoadedData);
      audioRef.current.addEventListener('canplay', handleCanPlay);
      audioRef.current.addEventListener('play', handlePlay);
      audioRef.current.addEventListener('pause', handlePause);
      
      // Cleanup listeners
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('loadeddata', handleLoadedData);
          audioRef.current.removeEventListener('canplay', handleCanPlay);
          audioRef.current.removeEventListener('play', handlePlay);
          audioRef.current.removeEventListener('pause', handlePause);
        }
        if (updateInterval) {
          clearInterval(updateInterval);
        }
      };
    }
  }, [audioBlobUrl, audioFilePath, audioActions]);
  
  // Handle play/pause state changes
  useEffect(() => {
    if (audioRef.current && isAudioReady) {
      if (audioState.isPlaying && audioRef.current.paused) {
        audioRef.current.play().catch(error => {
          console.error('NewUIShell - Audio play failed:', error);
        });
      } else if (!audioState.isPlaying && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }
  }, [audioState.isPlaying, isAudioReady]);
  
  // Handle seek
  useEffect(() => {
    if (audioRef.current && isAudioReady && Math.abs(audioRef.current.currentTime - audioState.currentTime) > 0.5) {
      isSeekingRef.current = true;
      audioRef.current.currentTime = audioState.currentTime;
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 200);
    }
  }, [audioState.currentTime, isAudioReady]);
  
  // Handle volume and speed changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioState.volume;
      audioRef.current.playbackRate = audioState.playbackSpeed;
    }
  }, [audioState.volume, audioState.playbackSpeed]);
  
  // Load API keys on component mount
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
  
  // API Keys handlers
  const handleApiKeySave = async (apiKeys: { [service: string]: string }) => {
    try {
      if (window.electronAPI?.saveApiKeys) {
        await window.electronAPI.saveApiKeys(apiKeys);
        setCurrentApiKeys(apiKeys);
        setApiSettingsPanelOpen(false);
      }
    } catch (error) {
      console.error('Failed to save API keys:', error);
    }
  };
  
  const handleApiKeyCancel = () => {
    setApiSettingsPanelOpen(false);
  };
  
  // Extract speakers from segments AND globalSpeakers
  const speakers: Speaker[] = React.useMemo(() => {
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
    // This preserves manually added speakers
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
    // Trigger the new project dialog
    const event = new CustomEvent('open-new-project');
    window.dispatchEvent(event);
  };
  
  const handleOpenProject = () => {
    // Trigger the project import dialog
    const event = new CustomEvent('open-project-import');
    window.dispatchEvent(event);
  };

  const handleSaveProject = async () => {
    try {
      await projectActions.saveProject();
    } catch (error) {
      console.error('Save failed:', error);
      // Could show a notification here
    }
  };

  const handleOpenFonts = () => {
    setFontsPanelOpen(true);
  };

  const handleFontSettingsChange = (newSettings: FontSettings) => {
    setFontSettings(newSettings);
  };
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Spacebar for play/pause (when not in input field)
      if (e.code === 'Space' && !(e.target as HTMLElement).matches('input, textarea, select')) {
        e.preventDefault();
        const playButton = document.querySelector('[aria-label="Play"], [aria-label="Pause"]') as HTMLButtonElement;
        playButton?.click();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
  
  // Fallback UI if project state is not ready
  if (!projectState) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#f0f0f0', height: '100vh' }}>
        <h1>TranscriptApp - Loading...</h1>
        <p>Project state is initializing...</p>
      </div>
    );
  }
  
  return (
    <div 
      className="flex h-screen bg-bg" 
      style={{ 
        backgroundColor: '#003223', 
        height: '100vh',
        display: 'flex',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <EnhancedSidebar 
        mode={mode} 
        onModeChange={setMode}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onOpenFonts={() => setFontsPanelOpen(!fontsPanelOpen)}
        onOpenSpeakers={() => setSpeakersPanelOpen(!speakersPanelOpen)}
        onOpenClips={() => setClipsPanelOpen(!clipsPanelOpen)}
        onOpenPlayback={() => setPlaybackPanelOpen(!playbackPanelOpen)}
        onOpenApiSettings={() => setApiSettingsPanelOpen(!apiSettingsPanelOpen)}
      />
      
      {/* Secondary Panel */}
      <SecondaryPanel
        open={speakersPanelOpen}
        title="Speakers"
        onClose={() => setSpeakersPanelOpen(false)}
        widthPx={340}
      >
        <SpeakersPanel
          initial={speakers}
          onChange={handleSpeakersChange}
          onClose={() => setSpeakersPanelOpen(false)}
        />
      </SecondaryPanel>
      
      {/* Clips Panel */}
      <SecondaryPanel
        open={clipsPanelOpen}
        title="Clips"
        onClose={() => setClipsPanelOpen(false)}
        widthPx={400}
      >
        <ClipsPanel
          clips={clipsHook.clips}
          selectedClipId={clipsHook.selectedClipId}
          onClipSelect={clipsHook.selectClip}
          onClipDelete={(clipId) => {
            // TODO: Implement clip deletion
          }}
          onClipPlay={(clip) => {
            audioActions.seek(clip.startTime);
            audioActions.play();
          }}
          onClose={() => setClipsPanelOpen(false)}
        />
      </SecondaryPanel>
      
      {/* Fonts Panel */}
      <SecondaryPanel
        open={fontsPanelOpen}
        title="Fonts"
        onClose={() => setFontsPanelOpen(false)}
        widthPx={320}
      >
        <FontsPanel
          initial={fontSettings}
          onChange={handleFontSettingsChange}
          onClose={() => setFontsPanelOpen(false)}
        />
      </SecondaryPanel>
      
      {/* API Settings Panel */}
      <SecondaryPanel
        open={apiSettingsPanelOpen}
        title="API Settings"
        onClose={() => setApiSettingsPanelOpen(false)}
        widthPx={500}
      >
        <ApiSettings
          currentKeys={currentApiKeys}
          onSave={handleApiKeySave}
          onCancel={handleApiKeyCancel}
        />
      </SecondaryPanel>
      
      <div 
        className="flex-1 flex flex-col min-w-0 relative"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white',
          minWidth: 0,
          position: 'relative'
        }}
      >
        {mode === 'edit' ? (
          <ClipBasedTranscript mode={mode} clipsHook={clipsHook} fontSettings={fontSettings} />
        ) : (
          <EnhancedTranscript mode={mode} clipsHook={clipsHook} fontSettings={fontSettings} />
        )}
        
        {/* Glass Audio Player - positioned within transcript area */}
        <GlassAudioPlayer
        isVisible={playbackPanelOpen}
        isPlaying={audioState.isPlaying}
        currentTime={audioState.currentTime}
        duration={audioState.duration}
        volume={audioState.volume}
        speed={audioState.playbackSpeed}
        fileName={selectedJob?.fileName || projectState.projectData?.project?.name || 'Audio'}
        onPlayPause={() => {
          if (audioState.isPlaying) {
            audioActions.pause();
          } else {
            audioActions.play();
          }
        }}
        onSeek={(time) => audioActions.seek(time)}
        onSkipToClipStart={() => {
          // Find current clip and skip to its start or previous clip
          const currentClip = clipsHook.clips.find(
            clip => audioState.currentTime >= clip.startTime && audioState.currentTime <= clip.endTime
          );
          if (currentClip) {
            // If we're more than 2 seconds into the clip, restart it
            if (audioState.currentTime - currentClip.startTime > 2) {
              audioActions.seek(currentClip.startTime);
            } else {
              // Otherwise, go to previous clip
              const currentIndex = clipsHook.clips.indexOf(currentClip);
              if (currentIndex > 0) {
                const prevClip = clipsHook.clips[currentIndex - 1];
                audioActions.seek(prevClip.startTime);
              } else {
                audioActions.seek(0);
              }
            }
          } else {
            audioActions.seek(0);
          }
        }}
        onSkipToClipEnd={() => {
          // Find current clip and skip to next clip
          const currentClip = clipsHook.clips.find(
            clip => audioState.currentTime >= clip.startTime && audioState.currentTime <= clip.endTime
          );
          if (currentClip) {
            const currentIndex = clipsHook.clips.indexOf(currentClip);
            if (currentIndex < clipsHook.clips.length - 1) {
              const nextClip = clipsHook.clips[currentIndex + 1];
              audioActions.seek(nextClip.startTime);
              // Auto-play the next clip
              if (!audioState.isPlaying) {
                audioActions.play();
              }
            } else {
              // If last clip, go to its end
              audioActions.seek(currentClip.endTime);
            }
          } else if (clipsHook.clips.length > 0) {
            // If between clips, find next clip
            const nextClip = clipsHook.clips.find(clip => clip.startTime > audioState.currentTime);
            if (nextClip) {
              audioActions.seek(nextClip.startTime);
              if (!audioState.isPlaying) {
                audioActions.play();
              }
            }
          }
        }}
        onVolume={(volume) => audioActions.updateAudioState({ volume })}
        onSpeedChange={(speed) => audioActions.updateAudioState({ playbackSpeed: speed })}
        onClose={() => setPlaybackPanelOpen(false)}
      />
      
      {/* Hidden audio element for actual playback */}
      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        preload="metadata"
      />
      </div>
    </div>
  );
};

export default NewUIShell;