import React, { useState, useEffect, useMemo, useRef } from 'react';
import CleanTranscriptDisplay from './CleanTranscriptDisplay';
import SpeakersPanel from '../shared/SpeakersPanel';
import AudioControlsPanel from '../shared/AudioControlsPanel';
import './PlaybackMode.css';

interface PlaybackModeProps {
  transcriptionJob: any;
  onBack: () => void;
  onSwitchToTranscriptEdit: () => void;
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
  onBack, 
  onSwitchToTranscriptEdit 
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speakerNames, setSpeakerNames] = useState<{ [key: string]: string }>(
    transcriptionJob.speakerNames || {}
  );
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [tempSpeakerName, setTempSpeakerName] = useState('');
  const [volume, setVolume] = useState(0.7);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  
  // Resizable layout state
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const segments = transcriptionJob.result?.segments || [];

  // Group segments by speaker for paragraph display
  const paragraphs = useMemo(() => {
    return groupSegmentsByParagraph(segments);
  }, [segments]);

  // Extract speakers from segments
  const speakers = useMemo(() => {
    const speakerMap = new Map();
    segments.forEach((segment: any) => {
      const speakerId = segment.speaker || 'SPEAKER_00';
      if (!speakerMap.has(speakerId)) {
        const speakerName = speakerNames[speakerId] || `Speaker ${speakerId.replace('SPEAKER_', '')}`;
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
  }, [segments, speakerNames]);

  const handleTimeSeek = (time: number) => {
    setCurrentTime(time);
    // TODO: Integrate with audio player
    console.log('Seeking to time:', time);
  };

  const handleSpeakerNameEdit = (speakerId: string, newName: string) => {
    console.log('Updating speaker name:', speakerId, '->', newName);
    setSpeakerNames(prev => ({
      ...prev,
      [speakerId]: newName
    }));
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
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
    setVolume(newVolume);
    // TODO: Connect to audio player
    console.log('Volume changed to:', newVolume);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    // TODO: Connect to audio player
    console.log('Speed changed to:', newSpeed);
  };

  const handleSkipBack = () => {
    const newTime = Math.max(0, currentTime - 10);
    handleTimeSeek(newTime);
  };

  const handleSkipForward = () => {
    const newTime = Math.min(getDuration(), currentTime + 10);
    handleTimeSeek(newTime);
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
        setIsPlaying(prev => !prev);
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
            speakerNames={speakerNames}
            onSpeakerNameEdit={handleSpeakerNameEdit}
            currentTime={currentTime}
            onTimeSeek={handleTimeSeek}
          />
        </div>
        
        <div className="resize-handle" onMouseDown={handleMouseDown} />
        
        <div className="right-sidebar" style={{ width: `${sidebarWidth}px` }}>
          <SpeakersPanel
            mode="playback"
            speakers={speakers}
            speakerNames={speakerNames}
            editingSpeakerId={editingSpeakerId}
            tempSpeakerName={tempSpeakerName}
            onSpeakerEdit={handleSpeakerEdit}
            onSpeakerSave={handleSpeakerSave}
            onSpeakerCancel={handleSpeakerCancel}
            onTempNameChange={setTempSpeakerName}
          />
          
          <AudioControlsPanel
            mode="playback"
            currentTime={currentTime}
            duration={getDuration()}
            isPlaying={isPlaying}
            volume={volume}
            playbackSpeed={playbackSpeed}
            onPlayPause={handlePlayPause}
            onSeek={handleTimeSeek}
            onVolumeChange={handleVolumeChange}
            onSpeedChange={handleSpeedChange}
            onSkipBack={handleSkipBack}
            onSkipForward={handleSkipForward}
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