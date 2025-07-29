import React, { useState, useEffect } from 'react';
import TranscriptPanel from './TranscriptPanel';
import Sidebar from './Sidebar';
import { useClips } from './useClips';
import './PlaybackMode.css';

interface PlaybackModeProps {
  transcriptionJob: any;
  onBack: () => void;
}

const PlaybackModeContainer: React.FC<PlaybackModeProps> = ({ transcriptionJob, onBack }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'speakers' | 'segments'>('speakers');
  const [speakerNames, setSpeakerNames] = useState<{ [key: string]: string }>(transcriptionJob.speakerNames || {});
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [tempSpeakerName, setTempSpeakerName] = useState('');

  const segments = transcriptionJob.result?.segments || [];
  
  // Clips management
  const {
    clips,
    selectedClipId,
    findClipByWordIndex,
    findClipByTime,
    getNextClip,
    getPreviousClip,
    selectClip,
    createNewClip,
    addNewSpeakerLabel
  } = useClips({ segments, speakerNames: speakerNames, setSpeakerNames });
  
  // Extract speakers from segments
  const speakers = React.useMemo(() => {
    console.log('Processing segments for speakers:', segments.length);
    console.log('Speaker names from state:', speakerNames);
    
    const speakerMap = new Map();
    segments.forEach((segment: any, index: number) => {
      console.log(`Segment ${index}:`, { 
        speaker: segment.speaker, 
        text: segment.text?.substring(0, 50) + '...',
        start: segment.start,
        end: segment.end 
      });
      
      const speakerId = segment.speaker || 'SPEAKER_00'; // Fallback for missing speaker
      if (!speakerMap.has(speakerId)) {
        // Use custom name if available, otherwise fallback to generic name
        const customName = speakerNames[speakerId];
        const fallbackName = speakerId === 'SPEAKER_00' ? 'Speaker 1' : `Speaker ${speakerId.replace('SPEAKER_', '')}`;
        
        speakerMap.set(speakerId, {
          id: speakerId,
          name: customName || fallbackName,
          totalTime: 0,
          color: getRandomColor()
        });
      }
    });
    
    // Calculate speaking time for each speaker
    segments.forEach((segment: any) => {
      const speakerId = segment.speaker || 'SPEAKER_00';
      if (speakerMap.has(speakerId)) {
        const speaker = speakerMap.get(speakerId);
        speaker.totalTime += (segment.end - segment.start);
      }
    });
    
    const speakerList = Array.from(speakerMap.values());
    console.log('Extracted speakers:', speakerList);
    
    return speakerList;
  }, [segments, speakerNames]);

  const handleWordClick = (timestamp: number) => {
    setCurrentTime(timestamp);
    // TODO: Seek audio to timestamp
  };

  // Speaker editing functions
  const handleSpeakerEdit = (speakerId: string, currentName: string) => {
    setEditingSpeakerId(speakerId);
    setTempSpeakerName(currentName);
  };

  const handleSpeakerSave = (speakerId: string) => {
    const trimmedName = tempSpeakerName.trim();
    
    if (trimmedName.length === 0) {
      // Use default name if empty
      const speakerIndex = Object.keys(speakerNames).indexOf(speakerId);
      const defaultName = `Speaker ${speakerIndex + 1}`;
      setSpeakerNames(prev => ({ ...prev, [speakerId]: defaultName }));
    } else if (trimmedName.length > 50) {
      // Validation: too long
      return;
    } else {
      // Check for duplicates
      const existingNames = Object.entries(speakerNames)
        .filter(([id, name]) => id !== speakerId && name && name.toLowerCase() === trimmedName.toLowerCase());
      
      if (existingNames.length > 0) {
        // Validation: duplicate name
        return;
      }
      
      setSpeakerNames(prev => ({ ...prev, [speakerId]: trimmedName }));
    }
    
    setEditingSpeakerId(null);
    setTempSpeakerName('');
  };

  const handleSpeakerCancel = () => {
    setEditingSpeakerId(null);
    setTempSpeakerName('');
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    
    // Find current word based on timestamp
    let currentWord = null;
    let globalWordIndex = -1;
    let runningIndex = 0;
    
    for (let segIndex = 0; segIndex < segments.length; segIndex++) {
      const segment = segments[segIndex];
      if (segment.words && segment.words.length > 0) {
        for (let wordIdx = 0; wordIdx < segment.words.length; wordIdx++) {
          const word = segment.words[wordIdx];
          if (time >= word.start && time <= word.end) {
            currentWord = word;
            globalWordIndex = runningIndex;
            break;
          }
          runningIndex++;
        }
      } else {
        // If no word-level data, check if we're in this segment
        if (time >= segment.start && time <= segment.end) {
          globalWordIndex = runningIndex;
        }
        runningIndex++;
      }
      
      if (currentWord) break;
    }
    
    setCurrentWordIndex(globalWordIndex);
  };

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

  return (
    <div className="playback-mode-container">
      <header className="playback-header">
        <div className="header-left">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <div className="project-info">
            <h1>{transcriptionJob.fileName}</h1>
            <div className="mode-badges">
              <span className="mode-badge active">Playback</span>
              <span className="mode-badge">Transcript Edit</span>
              <span className="mode-badge">Audio Edit</span>
            </div>
          </div>
        </div>
      </header>

      <div className="document-layout">
        <div className="document-container">
          <TranscriptPanel
            segments={segments}
            currentTime={currentTime}
            currentWordIndex={currentWordIndex}
            onWordClick={handleWordClick}
            selectedSegments={selectedSegments}
            onSegmentSelect={setSelectedSegments}
            speakerNames={speakerNames}
            selectedClipId={selectedClipId}
            onSelectClip={selectClip}
            onCreateNewClip={(wordIndex) => {
              const success = createNewClip(wordIndex);
              if (success) {
                // Force re-render to show updated segments
                setCurrentTime(currentTime); // Trigger re-render
              }
              return success;
            }}
            onAddNewSpeaker={(wordIndex, speakerName) => {
              const success = addNewSpeakerLabel(wordIndex, speakerName);
              if (success) {
                // Force re-render to show updated segments and speakers
                setCurrentTime(currentTime); // Trigger re-render
              }
              return success;
            }}
          />
        </div>
        
        <div className="right-sidebar">
          <Sidebar
            speakers={speakers}
            segments={segments}
            clips={clips}
            selectedClipId={selectedClipId}
            onClipSelect={selectClip}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            currentTime={currentTime}
            onTimeSeek={handleWordClick}
            editingSpeakerId={editingSpeakerId}
            tempSpeakerName={tempSpeakerName}
            onSpeakerEdit={handleSpeakerEdit}
            onSpeakerSave={handleSpeakerSave}
            onSpeakerCancel={handleSpeakerCancel}
            onTempNameChange={setTempSpeakerName}
            audioPath={transcriptionJob.filePath}
            isPlaying={isPlaying}
            onTimeUpdate={handleTimeUpdate}
            onPlayPause={setIsPlaying}
            duration={segments.length > 0 ? segments[segments.length - 1].end : 0}
          />
        </div>
      </div>
    </div>
  );
};

// Helper function to generate random colors for speakers
function getRandomColor(): string {
  const colors = [
    '#4a9eff', '#ff6b4a', '#ffb84a', '#4ade80', '#a855f7', 
    '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default PlaybackModeContainer;