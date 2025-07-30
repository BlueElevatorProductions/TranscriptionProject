import React, { useState, useEffect, useCallback } from 'react';
import TranscriptPanel from './TranscriptPanel';
import Sidebar from './Sidebar';
import SpeakersPanel from '../shared/SpeakersPanel';
import AudioControlsPanel from '../shared/AudioControlsPanel';
import { useClips } from './useClips';
import './TranscriptEdit.css';

interface TranscriptEditProps {
  transcriptionJob: any;
  onBack: () => void;
  onSwitchToPlayback: () => void;
}

interface EditAction {
  type: 'word-edit' | 'speaker-change' | 'clip-create' | 'word-insert';
  data: any;
  timestamp: number;
}

const TranscriptEditContainer: React.FC<TranscriptEditProps> = ({ transcriptionJob, onBack, onSwitchToPlayback }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'speakers' | 'segments'>('speakers');
  const [speakerNames, setSpeakerNames] = useState<{ [key: string]: string }>(transcriptionJob.speakerNames || {});
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [tempSpeakerName, setTempSpeakerName] = useState('');
  const [volume, setVolume] = useState(0.7);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  
  // Undo/Redo system
  const [editHistory, setEditHistory] = useState<EditAction[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [segments, setSegments] = useState(transcriptionJob.result?.segments || []);
  
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
      // If the user tries to save an empty name, do nothing and exit edit mode.
      // The name remains unchanged.
      setEditingSpeakerId(null);
      setTempSpeakerName('');
      return;
    }
    
    if (trimmedName.length > 50) {
      // Validation: too long
      return;
    }
    
    // Check for duplicates
    const existingNames = Object.entries(speakerNames)
      .filter(([id, name]) => id !== speakerId && name && name.toLowerCase() === trimmedName.toLowerCase());
    
    if (existingNames.length > 0) {
      // Validation: duplicate name
      return;
    }
    
    setSpeakerNames(prev => ({ ...prev, [speakerId]: trimmedName }));
    
    setEditingSpeakerId(null);
    setTempSpeakerName('');
  };

  const handleSpeakerCancel = () => {
    setEditingSpeakerId(null);
    setTempSpeakerName('');
  };

  // Add action to history
  const addToHistory = useCallback((action: EditAction) => {
    setEditHistory(prev => {
      // Remove any actions after current index (when we're in the middle of history)
      const newHistory = prev.slice(0, currentHistoryIndex + 1);
      // Add new action
      newHistory.push(action);
      // Limit history to 50 actions
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setCurrentHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [currentHistoryIndex]);

  // Undo function
  const performUndo = useCallback(() => {
    if (currentHistoryIndex >= 0) {
      const action = editHistory[currentHistoryIndex];
      
      switch (action.type) {
        case 'word-edit':
          const { segmentIndex, wordIndex, originalWord } = action.data;
          setSegments(prev => {
            const newSegments = [...prev];
            if (newSegments[segmentIndex]?.words?.[wordIndex]) {
              newSegments[segmentIndex].words[wordIndex].word = originalWord;
            }
            return newSegments;
          });
          break;
        case 'speaker-change':
          const { speakerId, originalName } = action.data;
          setSpeakerNames(prev => ({
            ...prev,
            [speakerId]: originalName
          }));
          break;
        case 'word-insert':
          const { insertSegmentIndex, insertWordIndex } = action.data;
          setSegments(prev => {
            const newSegments = [...prev];
            if (newSegments[insertSegmentIndex]?.words) {
              newSegments[insertSegmentIndex].words.splice(insertWordIndex, 1);
            }
            return newSegments;
          });
          break;
      }
      
      setCurrentHistoryIndex(prev => prev - 1);
    }
  }, [editHistory, currentHistoryIndex]);

  // Redo function
  const performRedo = useCallback(() => {
    if (currentHistoryIndex < editHistory.length - 1) {
      const nextIndex = currentHistoryIndex + 1;
      const action = editHistory[nextIndex];
      
      switch (action.type) {
        case 'word-edit':
          const { segmentIndex, wordIndex, newWord } = action.data;
          setSegments(prev => {
            const newSegments = [...prev];
            if (newSegments[segmentIndex]?.words?.[wordIndex]) {
              newSegments[segmentIndex].words[wordIndex].word = newWord;
            }
            return newSegments;
          });
          break;
        case 'speaker-change':
          const { speakerId, newName } = action.data;
          setSpeakerNames(prev => ({
            ...prev,
            [speakerId]: newName
          }));
          break;
        case 'word-insert':
          const { insertSegmentIndex, insertWordIndex, insertedWord } = action.data;
          setSegments(prev => {
            const newSegments = [...prev];
            if (newSegments[insertSegmentIndex]?.words) {
              newSegments[insertSegmentIndex].words.splice(insertWordIndex, 0, insertedWord);
            }
            return newSegments;
          });
          break;
      }
      
      setCurrentHistoryIndex(nextIndex);
    }
  }, [editHistory, currentHistoryIndex]);

  // Handle word editing with history
  const handleWordEdit = useCallback((segmentIndex: number, wordIndex: number, originalWord: string, newWord: string) => {
    const action: EditAction = {
      type: 'word-edit',
      data: { segmentIndex, wordIndex, originalWord, newWord },
      timestamp: Date.now()
    };
    
    addToHistory(action);
    
    setSegments(prev => {
      const newSegments = [...prev];
      if (newSegments[segmentIndex]?.words?.[wordIndex]) {
        newSegments[segmentIndex].words[wordIndex].word = newWord;
      }
      return newSegments;
    });
  }, [addToHistory]);

  // Handle word insertion with history
  const handleWordInsert = useCallback((segmentIndex: number, wordIndex: number, newWordText: string) => {
    const newWord = {
      word: newWordText,
      start: segments[segmentIndex]?.words?.[wordIndex - 1]?.end || 0,
      end: segments[segmentIndex]?.words?.[wordIndex]?.start || 0,
      confidence: 1.0
    };
    
    const action: EditAction = {
      type: 'word-insert',
      data: { insertSegmentIndex: segmentIndex, insertWordIndex: wordIndex, insertedWord: newWord },
      timestamp: Date.now()
    };
    
    addToHistory(action);
    
    setSegments(prev => {
      const newSegments = [...prev];
      if (newSegments[segmentIndex]?.words) {
        newSegments[segmentIndex].words.splice(wordIndex, 0, newWord);
      }
      return newSegments;
    });
  }, [addToHistory, segments]);

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
    handleWordClick(newTime);
  };

  const handleSkipForward = () => {
    const duration = segments.length > 0 ? segments[segments.length - 1].end : 0;
    const newTime = Math.min(duration, currentTime + 10);
    handleWordClick(newTime);
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
      // Check if we're in an input field
      const isInInput = ['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName);
      
      // Handle undo/redo
      if ((event.metaKey || event.ctrlKey) && !isInInput) {
        switch (event.key) {
          case 'z':
            if (event.shiftKey) {
              event.preventDefault();
              performRedo();
            } else {
              event.preventDefault();
              performUndo();
            }
            break;
          case 'y':
            event.preventDefault();
            performRedo();
            break;
        }
      }
      
      // Handle spacebar only if not typing in an input or textarea
      if (event.code === 'Space' && !isInInput) {
        event.preventDefault();
        setIsPlaying(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [performUndo, performRedo]);

  return (
    <div className="transcript-edit-container">
      <header className="transcript-edit-header">
        <div className="header-left">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <div className="project-info">
            <h1>{transcriptionJob.fileName}</h1>
            <div className="mode-badges">
              <span 
                className="mode-badge"
                onClick={onSwitchToPlayback}
              >
                Playback
              </span>
              <span className="mode-badge active">Transcript Edit</span>
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
            editingSpeakerId={editingSpeakerId}
            tempSpeakerName={tempSpeakerName}
            onSpeakerEditStart={handleSpeakerEdit}
            onSpeakerEditSave={handleSpeakerSave}
            onSpeakerEditCancel={handleSpeakerCancel}
            onSpeakerNameChange={setTempSpeakerName}
            onWordEdit={handleWordEdit}
            onWordInsert={handleWordInsert}
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

export default TranscriptEditContainer;