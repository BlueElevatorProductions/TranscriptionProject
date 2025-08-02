import React, { useState, useEffect, useCallback } from 'react';
import TranscriptPanel from './TranscriptPanel';
// import Sidebar from './Sidebar'; // Replaced with SpeakersPanel for consistency
import SpeakersPanel from '../shared/SpeakersPanel';
import { useClips } from './useClips';
import './TranscriptEdit.css';

interface SharedAudioState {
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  playbackSpeed: number;
}

interface TranscriptEditProps {
  transcriptionJob: any;
  editedSegments: any[];
  onEditedSegmentsUpdate: (segments: any[]) => void;
  speakers?: { [key: string]: string };
  onSpeakersUpdate?: (speakers: { [key: string]: string }) => void;
  onBack: () => void;
  onSwitchToPlayback: () => void;
  sharedAudioState: SharedAudioState;
  onAudioStateUpdate: (updates: Partial<SharedAudioState>) => void;
}

interface EditAction {
  type: 'word-edit' | 'speaker-change' | 'clip-create' | 'word-insert' | 'word-delete' | 'paragraph-break';
  data: any;
  timestamp: number;
}

const TranscriptEditContainer: React.FC<TranscriptEditProps> = ({ 
  transcriptionJob, 
  editedSegments,
  onEditedSegmentsUpdate,
  speakers = {},
  onSpeakersUpdate,
  onBack, 
  onSwitchToPlayback,
  sharedAudioState,
  onAudioStateUpdate
}) => {
  // Use shared audio state instead of local state
  const { currentTime, isPlaying, volume, playbackSpeed } = sharedAudioState;
  
  // Local UI state
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [selectedSegments, setSelectedSegments] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'speakers' | 'segments'>('speakers');
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [tempSpeakerName, setTempSpeakerName] = useState('');
  const [isCreatingClip, setIsCreatingClip] = useState(false); // Prevent duplicate clip creation
  
  // Undo/Redo system
  const [editHistory, setEditHistory] = useState<EditAction[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [segments, setSegments] = useState(editedSegments);
  
  // Sync local segments with editedSegments prop only if they're different
  useEffect(() => {
    if (JSON.stringify(segments) !== JSON.stringify(editedSegments)) {
      setSegments(editedSegments);
    }
  }, [editedSegments]);
  
  // Update parent when segments change, but avoid circular updates
  const [isUpdatingParent, setIsUpdatingParent] = useState(false);
  useEffect(() => {
    if (!isUpdatingParent && JSON.stringify(segments) !== JSON.stringify(editedSegments)) {
      setIsUpdatingParent(true);
      onEditedSegmentsUpdate(segments);
      // Reset flag after update
      setTimeout(() => setIsUpdatingParent(false), 0);
    }
  }, [segments]);
  
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
  } = useClips({ segments, speakerNames: speakers, setSpeakerNames: onSpeakersUpdate });
  
  // Extract speakers from segments - EXACT SAME STRUCTURE AS PLAYBACK MODE
  const speakerIds = React.useMemo(() => {
    const speakerMap = new Map();
    
    segments.forEach((segment: any) => {
      const speakerId = segment.speaker || 'SPEAKER_00';
      if (!speakerMap.has(speakerId)) {
        // Use current speaker name from speakers prop, fallback to generated name
        const speakerName = speakers[speakerId] || (speakerId === 'SPEAKER_00' ? 'Speaker 1' : `Speaker ${speakerId.replace('SPEAKER_', '')}`);
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

  const handleWordClick = (timestamp: number) => {
    onAudioStateUpdate({ currentTime: timestamp });
  };

  // Speaker editing functions
  const handleSpeakerEdit = (speakerId: string, currentName: string) => {
    console.log('TranscriptEdit handleSpeakerEdit called:', { speakerId, currentName });
    console.log('Before state update - editingSpeakerId:', editingSpeakerId, 'tempSpeakerName:', tempSpeakerName);
    setEditingSpeakerId(speakerId);
    setTempSpeakerName(currentName);
    console.log('State update calls made for speaker editing');
  };

  const handleSpeakerNameEdit = (speakerId: string, newName: string) => {
    const updatedSpeakers = {
      ...speakers,
      [speakerId]: newName
    };
    onSpeakersUpdate?.(updatedSpeakers);
  };

  const handleSpeakerSave = (speakerId: string) => {
    console.log('TranscriptEdit handleSpeakerSave called for:', speakerId, 'tempName:', tempSpeakerName);
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
          onSpeakersUpdate?.({
            ...speakers,
            [speakerId]: originalName
          });
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
        case 'word-delete':
          // For undo, we need to re-insert the deleted word
          const { segmentIndex: delSegIdx, wordIndex: delWordIdx, deletedWord } = action.data;
          setSegments(prev => {
            const newSegments = [...prev];
            if (newSegments[delSegIdx]?.words) {
              newSegments[delSegIdx].words.splice(delWordIdx, 0, deletedWord);
              newSegments[delSegIdx].text = newSegments[delSegIdx].words.map((w: any) => w.word).join(' ');
            }
            return newSegments;
          });
          break;
        case 'paragraph-break':
          // For undo, we need to reverse the paragraph break operation
          // This is complex, so for now we'll just log it
          console.log('Undoing paragraph break - feature coming soon');
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
          onSpeakersUpdate?.({
            ...speakers,
            [speakerId]: newName
          });
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
        case 'word-delete':
          // For redo, we remove the word again
          const { segmentIndex: redoSegIdx, wordIndex: redoWordIdx } = action.data;
          setSegments(prev => {
            const newSegments = [...prev];
            if (newSegments[redoSegIdx]?.words && newSegments[redoSegIdx].words.length > 1) {
              newSegments[redoSegIdx].words.splice(redoWordIdx, 1);
              newSegments[redoSegIdx].text = newSegments[redoSegIdx].words.map((w: any) => w.word).join(' ');
            }
            return newSegments;
          });
          break;
        case 'paragraph-break':
          // For redo, we replay the paragraph break operation
          const breakData = action.data;
          handleParagraphBreak(breakData);
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

  // Handle word deletion with history
  const handleWordDelete = useCallback((segmentIndex: number, wordIndex: number) => {
    const segment = segments[segmentIndex];
    if (!segment?.words?.[wordIndex]) return;
    
    const deletedWord = segment.words[wordIndex];
    
    const action: EditAction = {
      type: 'word-delete',
      data: { 
        segmentIndex, 
        wordIndex, 
        deletedWord,
        originalText: segment.text 
      },
      timestamp: Date.now()
    };
    
    addToHistory(action);
    
    setSegments(prev => {
      const newSegments = [...prev];
      if (newSegments[segmentIndex]?.words && newSegments[segmentIndex].words.length > 1) {
        // Remove the word
        newSegments[segmentIndex].words.splice(wordIndex, 1);
        // Rebuild segment text
        newSegments[segmentIndex].text = newSegments[segmentIndex].words.map((w: any) => w.word).join(' ');
      }
      return newSegments;
    });
  }, [addToHistory, segments]);

  // Handle paragraph break with history
  const handleParagraphBreak = useCallback((breakData: {
    segmentIndex: number;
    wordIndex: number;
    position: 'before' | 'after';
    timestamp: number;
  }) => {
    const { segmentIndex, wordIndex, position } = breakData;
    
    // Add to undo history
    const action: EditAction = {
      type: 'paragraph-break',
      data: breakData,
      timestamp: Date.now()
    };
    
    addToHistory(action);

    // Add paragraph break to segment
    setSegments(prev => {
      const newSegments = [...prev];
      
      if (position === 'before' && wordIndex === 0) {
        // Add paragraph break before this segment
        newSegments[segmentIndex] = {
          ...newSegments[segmentIndex],
          paragraphBreak: true
        };
      } else {
        // Split segment at word boundary and add paragraph break
        const currentSegment = newSegments[segmentIndex];
        const splitIndex = position === 'before' ? wordIndex : wordIndex + 1;
        
        const firstPart = {
          ...currentSegment,
          words: currentSegment.words?.slice(0, splitIndex) || [],
          text: currentSegment.words?.slice(0, splitIndex).map((w: any) => w.word).join(' ') || '',
          end: currentSegment.words?.[splitIndex - 1]?.end || currentSegment.end
        };
        
        const secondPart = {
          ...currentSegment,
          id: currentSegment.id + '_split_' + Date.now(),
          words: currentSegment.words?.slice(splitIndex) || [],
          text: currentSegment.words?.slice(splitIndex).map((w: any) => w.word).join(' ') || '',
          start: currentSegment.words?.[splitIndex]?.start || currentSegment.start,
          paragraphBreak: true
        };
        
        // Replace current segment with split segments
        newSegments.splice(segmentIndex, 1, firstPart, secondPart);
      }
      
      return newSegments;
    });
  }, [addToHistory]);

  // Audio control handlers
  const handleVolumeChange = (newVolume: number) => {
    onAudioStateUpdate({ volume: newVolume });
  };

  const handleSpeedChange = (newSpeed: number) => {
    onAudioStateUpdate({ playbackSpeed: newSpeed });
  };

  const handleSkipBack = () => {
    const newTime = Math.max(0, currentTime - 15);
    onAudioStateUpdate({ currentTime: newTime });
  };

  const handleSkipForward = () => {
    const duration = segments.length > 0 ? segments[segments.length - 1].end : 0;
    const newTime = Math.min(duration, currentTime + 15);
    onAudioStateUpdate({ currentTime: newTime });
  };

  // Update current word based on shared audio currentTime
  useEffect(() => {
    // Find current word based on timestamp
    let currentWord = null;
    let globalWordIndex = -1;
    let runningIndex = 0;
    
    for (let segIndex = 0; segIndex < segments.length; segIndex++) {
      const segment = segments[segIndex];
      if (segment.words && segment.words.length > 0) {
        for (let wordIdx = 0; wordIdx < segment.words.length; wordIdx++) {
          const word = segment.words[wordIdx];
          if (currentTime >= word.start && currentTime <= word.end) {
            currentWord = word;
            globalWordIndex = runningIndex;
            break;
          }
          runningIndex++;
        }
      } else {
        // If no word-level data, check if we're in this segment
        if (currentTime >= segment.start && currentTime <= segment.end) {
          globalWordIndex = runningIndex;
        }
        runningIndex++;
      }
      
      if (currentWord) break;
    }
    
    setCurrentWordIndex(globalWordIndex);
  }, [currentTime, segments]);

  const handleTimeUpdate = (time: number) => {
    onAudioStateUpdate({ currentTime: time });
    // Note: currentWordIndex will be updated by the useEffect above
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
        // Ensure isPlaying is always a boolean
        const currentIsPlaying = typeof isPlaying === 'boolean' ? isPlaying : false;
        onAudioStateUpdate({ isPlaying: !currentIsPlaying });
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
            speakerNames={speakers}
            selectedClipId={selectedClipId}
            onSelectClip={selectClip}
            onCreateNewClip={(wordIndex) => {
              // Prevent duplicate clip creation
              if (isCreatingClip) {
                return false;
              }
              
              setIsCreatingClip(true);
              
              try {
                const success = createNewClip(wordIndex);
                return success;
              } finally {
                // Reset creation flag after a short delay to prevent rapid duplicates
                setTimeout(() => setIsCreatingClip(false), 500);
              }
            }}
            onAddNewSpeaker={(wordIndex, speakerName) => {
              return addNewSpeakerLabel(wordIndex, speakerName);
            }}
            editingSpeakerId={editingSpeakerId}
            tempSpeakerName={tempSpeakerName}
            onSpeakerEditStart={handleSpeakerEdit}
            onSpeakerEditSave={handleSpeakerSave}
            onSpeakerEditCancel={handleSpeakerCancel}
            onSpeakerNameChange={setTempSpeakerName}
            onWordEdit={handleWordEdit}
            onWordInsert={handleWordInsert}
            onWordDelete={handleWordDelete}
            onParagraphBreak={handleParagraphBreak}
          />
        </div>
        
        <div className="right-sidebar">
          <SpeakersPanel
            mode="transcript-edit"
            speakers={speakerIds}
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

// Helper function to generate random colors for speakers
function getRandomColor(): string {
  const colors = [
    '#4a9eff', '#ff6b4a', '#ffb84a', '#4ade80', '#a855f7', 
    '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default TranscriptEditContainer;