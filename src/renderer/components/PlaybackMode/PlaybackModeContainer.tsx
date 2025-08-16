import React, { useState, useEffect, useMemo, useRef } from 'react';
import CleanTranscriptDisplay from './CleanTranscriptDisplay';
import PanelContainer from '../shared/PanelContainer';
import AppHeader from '../shared/AppHeader';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface SharedAudioState {
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  playbackSpeed: number;
}

interface PlaybackModeProps {
  transcriptionJob: any;
  editedSegments: any[];
  speakers?: { [key: string]: string };
  onSpeakersUpdate?: (speakers: { [key: string]: string }) => void;
  onBack: () => void;
  onSwitchToTranscriptEdit: () => void;
  sharedAudioState: SharedAudioState;
  onAudioStateUpdate: (updates: Partial<SharedAudioState>) => void;
  onSave?: () => Promise<void>;
}

interface Paragraph {
  id: string;
  speakerId: string;
  startTime: number;
  endTime: number;
  text: string;
  segments: any[];
}

const PlaybackModeContainer: React.FC<PlaybackModeProps> = ({ 
  transcriptionJob, 
  editedSegments,
  speakers = {},
  onSpeakersUpdate,
  onBack, 
  onSwitchToTranscriptEdit,
  sharedAudioState,
  onAudioStateUpdate,
  onSave
}) => {
  // Use shared audio state instead of local state
  const { currentTime, isPlaying, volume, playbackSpeed } = sharedAudioState;
  
  // Track current word for efficient highlighting
  const [currentWordInfo, setCurrentWordInfo] = useState<{paragraphId: string, segmentIndex: number, wordIndex: number} | null>(null);
  
  // Local UI state
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [tempSpeakerName, setTempSpeakerName] = useState('');
  
  // Panel visibility state
  const [panelStates, setPanelStates] = useState({
    speakers: true,
    clips: false,
    fonts: false,
    info: false
  });
  
  // Resizable layout state
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const segments = editedSegments;
  
  // Debug log the transcription job to see audio path
  useEffect(() => {
    console.log('PlaybackModeContainer - transcriptionJob:', {
      fileName: transcriptionJob.fileName,
      audioPath: transcriptionJob.audioPath,
      originalPath: transcriptionJob.originalPath,
      fullTranscriptionJob: transcriptionJob,
      hasResult: !!transcriptionJob.result,
      segmentCount: segments.length
    });
  }, [transcriptionJob, segments.length]);

  // Get the correct audio path from transcription job
  const audioPath = transcriptionJob.audioPath || transcriptionJob.originalPath || transcriptionJob.filePath;

  // Group segments by speaker for paragraph display
  const paragraphs = useMemo(() => {
    return groupSegmentsByParagraph(segments);
  }, [segments]);

  // Extract speaker data from segments for display
  const speakerData = useMemo(() => {
    const speakerMap = new Map();
    segments.forEach((segment: any) => {
      const speakerId = segment.speaker || 'SPEAKER_00';
      if (!speakerMap.has(speakerId)) {
        const speakerName = speakers[speakerId] || `Speaker ${speakerId.replace('SPEAKER_', '')}`;
        speakerMap.set(speakerId, {
          id: speakerId,
          name: speakerName,
          segments: [],
          totalDuration: 0
        });
      }
      
      const speaker = speakerMap.get(speakerId);
      speaker.segments.push(segment);
      speaker.totalDuration += (segment.end - segment.start);
    });
    
    return Array.from(speakerMap.values());
  }, [segments, speakers]);

  const handleTimeSeek = (time: number) => {
    console.log('PlaybackMode - Parent received time update:', time);
    onAudioStateUpdate({ currentTime: time });
  };

  const handleSpeakerNameEdit = (speakerId: string, newName: string) => {
    console.log('Updating speaker name:', speakerId, '->', newName);
    const updatedSpeakers = {
      ...speakers,
      [speakerId]: newName
    };
    onSpeakersUpdate?.(updatedSpeakers);
  };

  const handlePlayPause = () => {
    // Ensure isPlaying is always a boolean
    const currentIsPlaying = typeof isPlaying === 'boolean' ? isPlaying : false;
    const newIsPlaying = !currentIsPlaying;
    console.log('PlaybackMode - PlayPause clicked, current state:', currentIsPlaying, '-> new state:', newIsPlaying);
    onAudioStateUpdate({ isPlaying: newIsPlaying });
  };

  const getDuration = () => {
    if (segments.length === 0) return 0;
    return Math.max(...segments.map((s: any) => s.end));
  };

  // Panel toggle handler
  const handleTogglePanel = (panelName: string) => {
    setPanelStates(prev => ({
      ...prev,
      [panelName]: !prev[panelName as keyof typeof prev]
    }));
  };

  // Speaker editing handlers
  const handleSpeakerEdit = (speakerId: string, currentName: string) => {
    setEditingSpeakerId(speakerId);
    setTempSpeakerName(currentName);
  };

  const handleSpeakerSave = (speakerId: string) => {
    if (tempSpeakerName.trim()) {
      handleSpeakerNameEdit(speakerId, tempSpeakerName.trim());
    }
    setEditingSpeakerId(null);
    setTempSpeakerName('');
  };

  const handleSpeakerCancel = () => {
    setEditingSpeakerId(null);
    setTempSpeakerName('');
  };

  // Audio control handlers
  const handleVolumeChange = (newVolume: number) => {
    console.log('PlaybackMode - Volume changed to:', newVolume);
    onAudioStateUpdate({ volume: newVolume });
  };

  const handleSpeedChange = (newSpeed: number) => {
    console.log('PlaybackMode - Speed changed to:', newSpeed);
    onAudioStateUpdate({ playbackSpeed: newSpeed });
  };

  const handleSkipBack = () => {
    const newTime = Math.max(0, currentTime - 15);
    onAudioStateUpdate({ currentTime: newTime });
  };

  const handleSkipForward = () => {
    const newTime = Math.min(getDuration(), currentTime + 15);
    onAudioStateUpdate({ currentTime: newTime });
  };

  // Resizable layout handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      
      const minWidth = 280;
      const maxWidth = containerRect.width * 0.6;
      
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Mode-specific keyboard shortcuts (text formatting, clips, etc.)
  useKeyboardShortcuts({
    onBold: () => {
      // TODO: Implement bold text functionality
      console.log('Bold shortcut pressed in Playback mode');
    },
    onItalic: () => {
      // TODO: Implement italic text functionality  
      console.log('Italic shortcut pressed in Playback mode');
    },
    onHighlight: () => {
      // TODO: Implement highlight functionality
      console.log('Highlight shortcut pressed in Playback mode');
    },
    onNewClip: () => {
      // TODO: Implement new clip functionality
      console.log('New clip shortcut pressed in Playback mode');
    }
  });

  const transcriptWidth = `calc(100% - ${sidebarWidth}px)`;

  return (
    <div ref={containerRef} className="playback-mode-container">
      <AppHeader
        projectName={transcriptionJob.fileName}
        onCloseProject={onBack}
        onSave={onSave}
        onNewProject={() => {/* TODO: Implement new project */}}
        onImportAudio={() => {/* TODO: Implement import audio */}}
        onPrint={() => {/* TODO: Implement print */}}
        panelStates={panelStates}
        onTogglePanel={handleTogglePanel}
      />

      <div className="document-layout" style={{ cursor: isResizing ? 'col-resize' : 'default' }}>
        <div className="document-container" style={{ width: transcriptWidth }}>
          <CleanTranscriptDisplay 
            paragraphs={paragraphs}
            speakerNames={speakers}
            onSpeakerNameEdit={handleSpeakerNameEdit}
            currentTime={currentTime}
            onTimeSeek={handleTimeSeek}
          />
        </div>
        
        <div className="resize-handle" onMouseDown={handleMouseDown} />
        
        <PanelContainer
          panelStates={panelStates}
          onTogglePanel={handleTogglePanel}
          sidebarWidth={sidebarWidth}
          panelProps={{
            speakers: {
              mode: 'playback',
              speakers: speakerData,
              speakerNames: speakers,
              editingSpeakerId: editingSpeakerId,
              tempSpeakerName: tempSpeakerName,
              onSpeakerEdit: handleSpeakerEdit,
              onSpeakerSave: handleSpeakerSave,
              onSpeakerCancel: handleSpeakerCancel,
              onTempNameChange: setTempSpeakerName
            },
            clips: {
              clips: [],
              onCreateClip: () => console.log('Create clip'),
              onPlayClip: (id: string) => console.log('Play clip:', id),
              onDeleteClip: (id: string) => console.log('Delete clip:', id),
              onRenameClip: (id: string, name: string) => console.log('Rename clip:', id, name)
            },
            fonts: {
              fontSize: 16,
              lineHeight: 1.5,
              fontFamily: 'Inter',
              onFontSizeChange: (size: number) => console.log('Font size:', size),
              onLineHeightChange: (height: number) => console.log('Line height:', height),
              onFontFamilyChange: (family: string) => console.log('Font family:', family)
            },
            info: {
              fileName: transcriptionJob.fileName,
              projectName: transcriptionJob.fileName,
              duration: getDuration(),
              wordCount: segments.reduce((acc: number, seg: any) => acc + (seg.words?.length || 0), 0),
              speakerCount: speakerData.length,
              transcriptionModel: transcriptionJob.model || 'whisper-1'
            }
          }}
        />
      </div>
    </div>
  );
};

// Helper function to group segments into paragraphs
const groupSegmentsByParagraph = (segments: any[]): Paragraph[] => {
  console.log('PlaybackMode groupSegmentsByParagraph - input segments:', segments.length, segments.map(s => ({
    id: s.id,
    text: s.text.substring(0, 30) + '...',
    paragraphBreak: s.paragraphBreak,
    speaker: s.speaker
  })));
  
  const paragraphs: Paragraph[] = [];
  let currentParagraph: Paragraph | null = null;
  
  segments.forEach((segment, index) => {
    const speakerId = segment.speaker || 'SPEAKER_00';
    
    // Start new paragraph if speaker changes, significant time gap, or explicit paragraph break
    if (!currentParagraph || 
        currentParagraph.speakerId !== speakerId ||
        (segment.start - currentParagraph.endTime) > 5.0 ||
        segment.paragraphBreak === true) {
      
      if (currentParagraph) {
        paragraphs.push(currentParagraph);
      }
      
      currentParagraph = {
        id: `paragraph-${paragraphs.length}`,
        speakerId: speakerId,
        startTime: segment.start,
        endTime: segment.end,
        text: segment.text.trim(),
        segments: [segment]
      };
    } else {
      // Append to current paragraph
      currentParagraph.text += ' ' + segment.text.trim();
      currentParagraph.endTime = segment.end;
      currentParagraph.segments.push(segment);
    }
  });
  
  if (currentParagraph) {
    paragraphs.push(currentParagraph);
  }
  
  console.log('PlaybackMode groupSegmentsByParagraph - output paragraphs:', paragraphs.length, paragraphs.map(p => ({
    id: p.id,
    speakerId: p.speakerId,
    segmentCount: p.segments.length,
    text: p.text.substring(0, 50) + '...'
  })));
  
  return paragraphs;
};

export default PlaybackModeContainer;