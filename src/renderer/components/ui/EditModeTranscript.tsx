import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useProject, useAudio, useSelectedJob } from '../../contexts';
import { Segment } from '../../types';
import ContextMenu from '../TranscriptEdit/ContextMenu';

interface EditModeTranscriptProps {
  mode: string;
}

interface CursorPosition {
  segmentIndex: number;
  wordIndex: number;
  position: 'before' | 'after';
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  wordData?: {
    word: any;
    wordIndex: number;
    segmentIndex: number;
    timestamp: number;
  };
}

export const EditModeTranscript: React.FC<EditModeTranscriptProps> = ({ mode }) => {
  const { state: audioState } = useAudio();
  const { state: projectState, actions: projectActions } = useProject();
  const { selectedJob } = useSelectedJob();
  const transcriptRef = useRef<HTMLDivElement>(null);
  
  // Edit mode state
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null);
  const [editingWordIndex, setEditingWordIndex] = useState<{ segmentIndex: number; wordIndex: number } | null>(null);
  const [editingWord, setEditingWord] = useState('');
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [tempSpeakerName, setTempSpeakerName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  
  // Helper function to get speaker display name
  const getSpeakerDisplayName = (speakerId: string): string => {
    const globalSpeakers = projectState.globalSpeakers || {};
    if (globalSpeakers[speakerId]) {
      return globalSpeakers[speakerId];
    }
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
  
  // Update segments with edits
  const updateSegments = useCallback((newSegments: Segment[]) => {
    projectActions.updateSegments(newSegments);
  }, [projectActions]);
  
  // Handle word double-click for editing
  const handleWordDoubleClick = useCallback((segmentIndex: number, wordIndex: number, word: any) => {
    console.log('Double-click on word:', word, 'at position', wordIndex, 'in segment', segmentIndex);
    setEditingWordIndex({ segmentIndex, wordIndex });
    setEditingWord(word.word);
  }, []);
  
  // Handle word edit save
  const handleWordEditSave = useCallback(() => {
    if (editingWordIndex && editingWord.trim()) {
      const newSegments = [...segments];
      if (newSegments[editingWordIndex.segmentIndex]?.words?.[editingWordIndex.wordIndex]) {
        newSegments[editingWordIndex.segmentIndex].words[editingWordIndex.wordIndex].word = editingWord.trim();
        updateSegments(newSegments);
      }
    }
    setEditingWordIndex(null);
    setEditingWord('');
  }, [editingWordIndex, editingWord, segments, updateSegments]);
  
  // Handle word right-click for context menu
  const handleWordRightClick = useCallback((
    event: React.MouseEvent,
    word: any,
    wordIndex: number,
    segmentIndex: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Right-click on word:', word, 'at position', wordIndex, 'in segment', segmentIndex);
    
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      wordData: {
        word,
        wordIndex,
        segmentIndex,
        timestamp: word.start || segments[segmentIndex].start
      }
    });
  }, [segments]);
  
  // Handle speaker click for editing
  const handleSpeakerClick = useCallback((speakerId: string) => {
    setEditingSpeaker(speakerId);
    setTempSpeakerName(getSpeakerDisplayName(speakerId));
  }, [projectState.globalSpeakers]);
  
  // Handle speaker edit save
  const handleSpeakerEditSave = useCallback(() => {
    if (editingSpeaker && tempSpeakerName.trim()) {
      const updatedSpeakers = {
        ...projectState.globalSpeakers,
        [editingSpeaker]: tempSpeakerName.trim()
      };
      projectActions.updateSpeakers(updatedSpeakers);
    }
    setEditingSpeaker(null);
    setTempSpeakerName('');
  }, [editingSpeaker, tempSpeakerName, projectState.globalSpeakers, projectActions]);
  
  // Handle word insertion
  const handleWordInsert = useCallback((segmentIndex: number, afterWordIndex: number, newWordText: string) => {
    const newSegments = [...segments];
    const segment = newSegments[segmentIndex];
    if (segment?.words) {
      const prevWord = segment.words[afterWordIndex];
      const nextWord = segment.words[afterWordIndex + 1];
      
      const newWord = {
        word: newWordText,
        start: prevWord?.end || segment.start,
        end: nextWord?.start || prevWord?.end || segment.end,
        confidence: 1.0,
        score: 1.0
      };
      
      segment.words.splice(afterWordIndex + 1, 0, newWord);
      updateSegments(newSegments);
    }
  }, [segments, updateSegments]);
  
  // Handle word deletion
  const handleWordDelete = useCallback((segmentIndex: number, wordIndex: number) => {
    const newSegments = [...segments];
    if (newSegments[segmentIndex]?.words && newSegments[segmentIndex].words.length > 1) {
      newSegments[segmentIndex].words.splice(wordIndex, 1);
      updateSegments(newSegments);
    }
  }, [segments, updateSegments]);
  
  // Handle paragraph break
  const handleParagraphBreak = useCallback((segmentIndex: number, wordIndex: number, position: 'before' | 'after') => {
    const newSegments = [...segments];
    const segment = newSegments[segmentIndex];
    
    if (position === 'before' && wordIndex === 0) {
      // Add paragraph break before this segment
      newSegments[segmentIndex] = {
        ...segment,
        paragraphBreak: true
      };
    } else {
      // Split segment at word boundary
      const splitIndex = position === 'before' ? wordIndex : wordIndex + 1;
      
      const firstPart = {
        ...segment,
        words: segment.words?.slice(0, splitIndex) || [],
        text: segment.words?.slice(0, splitIndex).map((w: any) => w.word).join(' ') || '',
        end: segment.words?.[splitIndex - 1]?.end || segment.end
      };
      
      const secondPart = {
        ...segment,
        id: segment.id + '_split_' + Date.now(),
        words: segment.words?.slice(splitIndex) || [],
        text: segment.words?.slice(splitIndex).map((w: any) => w.word).join(' ') || '',
        start: segment.words?.[splitIndex]?.start || segment.start,
        paragraphBreak: true
      };
      
      newSegments.splice(segmentIndex, 1, firstPart, secondPart);
    }
    
    updateSegments(newSegments);
  }, [segments, updateSegments]);
  
  // Context menu items
  const contextMenuItems = React.useMemo(() => [
    {
      label: "Edit Word",
      icon: "✏️",
      action: () => {
        if (contextMenu.wordData) {
          const { segmentIndex, wordIndex, word } = contextMenu.wordData;
          handleWordDoubleClick(segmentIndex, wordIndex, word);
        }
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    },
    {
      label: "Insert Word After",
      icon: "➕",
      action: () => {
        if (contextMenu.wordData) {
          const newWord = prompt('Enter new word:');
          if (newWord) {
            handleWordInsert(contextMenu.wordData.segmentIndex, contextMenu.wordData.wordIndex, newWord);
          }
        }
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    },
    { isSeparator: true },
    {
      label: "Delete Word",
      icon: "🗑️",
      className: "delete-item",
      action: () => {
        if (contextMenu.wordData) {
          const { segmentIndex, wordIndex } = contextMenu.wordData;
          handleWordDelete(segmentIndex, wordIndex);
        }
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    }
  ], [contextMenu.wordData, handleWordDoubleClick, handleWordInsert, handleWordDelete]);
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingWordIndex || editingSpeaker) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (editingWordIndex) handleWordEditSave();
          if (editingSpeaker) handleSpeakerEditSave();
        } else if (e.key === 'Escape') {
          setEditingWordIndex(null);
          setEditingWord('');
          setEditingSpeaker(null);
          setTempSpeakerName('');
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingWordIndex, editingSpeaker, handleWordEditSave, handleSpeakerEditSave]);
  
  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };
    
    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);
  
  if (segments.length === 0) {
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
  
  return (
    <main className="flex-1 p-8 bg-white font-transcript overflow-y-auto" ref={transcriptRef}>
      <div className="max-w-4xl mx-auto">
        {segments.map((segment, segIndex) => (
          <div key={segment.id} className={`mb-6 ${segment.paragraphBreak ? 'mt-8' : ''}`}>
            {/* Speaker label - clickable for editing */}
            {segment.speaker && (
              <div className="flex items-center gap-2 mb-2">
                {editingSpeaker === segment.speaker ? (
                  <input
                    type="text"
                    value={tempSpeakerName}
                    onChange={(e) => setTempSpeakerName(e.target.value)}
                    onBlur={handleSpeakerEditSave}
                    className="text-xs font-semibold text-blue-600 uppercase tracking-wide border-b-2 border-blue-600 outline-none bg-transparent"
                    autoFocus
                  />
                ) : (
                  <span
                    className="text-xs font-semibold text-blue-600 uppercase tracking-wide cursor-pointer hover:underline"
                    onClick={() => handleSpeakerClick(segment.speaker)}
                  >
                    {getSpeakerDisplayName(segment.speaker)}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {new Date(segment.start * 1000).toISOString().substr(14, 5)}
                </span>
              </div>
            )}
            
            {/* Transcript text with editable words */}
            <div 
              className="text-[35px] leading-[1.4] text-gray-900"
              contentEditable={mode === 'edit' && !editingWordIndex && !editingSpeaker}
              suppressContentEditableWarning={true}
              onKeyDown={(e) => {
                // Prevent default contentEditable behavior for special keys
                if (e.key === 'Enter') {
                  e.preventDefault();
                  // Get current cursor position and create paragraph break
                  const selection = window.getSelection();
                  if (selection && selection.rangeCount > 0) {
                    // Find which word the cursor is near
                    // For now, just log
                    console.log('Enter pressed in edit mode');
                  }
                }
              }}
            >
              {segment.words?.map((word, wordIndex) => {
                const isEditing = editingWordIndex?.segmentIndex === segIndex && 
                                 editingWordIndex?.wordIndex === wordIndex;
                
                return (
                  <React.Fragment key={`${segment.id}-${wordIndex}`}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingWord}
                        onChange={(e) => setEditingWord(e.target.value)}
                        onBlur={handleWordEditSave}
                        className="inline-block border-b-2 border-blue-500 outline-none bg-transparent text-[35px]"
                        style={{ width: `${editingWord.length + 1}ch` }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`
                          cursor-pointer hover:bg-blue-100 transition-colors rounded px-1
                          ${mode === 'edit' ? 'hover:underline' : ''}
                        `}
                        onDoubleClick={() => handleWordDoubleClick(segIndex, wordIndex, word)}
                        onContextMenu={(e) => handleWordRightClick(e, word, wordIndex, segIndex)}
                        data-word-index={wordIndex}
                        data-segment-index={segIndex}
                      >
                        {word.word}
                      </span>
                    )}
                    {' '}
                  </React.Fragment>
                );
              }) || segment.text}
            </div>
          </div>
        ))}
      </div>
      
      {/* Context Menu */}
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenuItems}
        onClose={() => setContextMenu({ visible: false, x: 0, y: 0 })}
        visible={contextMenu.visible}
      />
    </main>
  );
};

export default EditModeTranscript;