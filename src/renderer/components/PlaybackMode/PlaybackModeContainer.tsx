import React, { useState, useEffect, useMemo, useRef } from 'react';
import CleanTranscriptDisplay from './CleanTranscriptDisplay';
import SpeakersPanel from '../shared/SpeakersPanel';
import './PlaybackMode.css';

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
  onAudioStateUpdate
}) => {
  // Use shared audio state instead of local state
  const { currentTime, isPlaying, volume, playbackSpeed } = sharedAudioState;
  
  // Local UI state
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [tempSpeakerName, setTempSpeakerName] = useState('');
  
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
    console.log('PlaybackMode - PlayPause clicked, current state:', isPlaying, '-> new state:', !isPlaying);
    onAudioStateUpdate({ isPlaying: !isPlaying });
  };

  const getDuration = () => {
    if (segments.length === 0) return 0;
    return Math.max(...segments.map((s: any) => s.end));
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

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle spacebar if not typing in an input or textarea
      if (event.code === 'Space' && 
          !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) {
        event.preventDefault();
        onAudioStateUpdate({ isPlaying: !isPlaying });
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const transcriptWidth = `calc(100% - ${sidebarWidth}px)`;

  return (
    <div ref={containerRef} className="playback-mode-container">
      <header className="playback-header">
        <div className="header-left">
          <button className="back-button" onClick={onBack}>← Back</button>
          <div className="project-info">
            <h1>{transcriptionJob.fileName}</h1>
            <div className="mode-badges">
              <span className="mode-badge active">Playback</span>
              <span 
                className="mode-badge" 
                onClick={onSwitchToTranscriptEdit}
              >
                Transcript Edit
              </span>
              <span className="mode-badge">Audio Edit</span>
            </div>
          </div>
        </div>
      </header>

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
        
        <div className="right-sidebar" style={{ width: `${sidebarWidth}px` }}>
          <SpeakersPanel
            mode="playback"
            speakers={speakerData}
            speakerNames={speakers}
            editingSpeakerId={editingSpeakerId}
            tempSpeakerName={tempSpeakerName}
            onSpeakerEdit={handleSpeakerEdit}
            onSpeakerSave={handleSpeakerSave}
            onSpeakerCancel={handleSpeakerCancel}
            onTempNameChange={setTempSpeakerName}
          />
          
        </div>
      </div>
    </div>
  );
};

// Helper function to group segments into paragraphs
const groupSegmentsByParagraph = (segments: any[]): Paragraph[] => {
  const paragraphs: Paragraph[] = [];
  let currentParagraph: Paragraph | null = null;
  
  segments.forEach((segment, index) => {
    const speakerId = segment.speaker || 'SPEAKER_00';
    
    // Start new paragraph if speaker changes or significant time gap
    if (!currentParagraph || 
        currentParagraph.speakerId !== speakerId ||
        (segment.start - currentParagraph.endTime) > 5.0) {
      
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
  
  return paragraphs;
};

export default PlaybackModeContainer;