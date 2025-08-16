import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useProject, useAudio, useSelectedJob } from '../../contexts';
import { Segment } from '../../types';
import ContextMenu from '../TranscriptEdit/ContextMenu';
import { useClips, Clip } from '../TranscriptEdit/useClips';
import { FontSettings } from '../shared/FontsPanel';

interface ClipBasedTranscriptProps {
  mode: string;
  fontSettings?: FontSettings;
  clipsHook?: {
    clips: Clip[];
    selectedClipId: string | null;
    findClipByWordIndex: (wordIndex: number) => Clip | null;
    selectClip: (clipId: string) => void;
    createNewClip: (splitWordIndex: number) => boolean;
    mergeClipWithAbove?: (clipId: string) => boolean;
    addNewSpeakerLabel: (wordIndex: number, speakerName: string) => boolean;
    getAdjustedPlaybackTime?: (deletedWordIds: Set<string>, targetTime: number) => number;
    getOriginalTimeFromAdjusted?: (deletedWordIds: Set<string>, adjustedTime: number) => number;
  };
  onDeletedWordsChange?: (deletedWords: Set<string>) => void;
}

interface CursorPosition {
  clipId: string;
  wordIndex: number; // Word index within the clip
  position: 'before' | 'after';
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  wordData?: {
    word: any;
    wordIndex: number;
    clipId: string;
    globalWordIndex: number;
  };
}

interface EditingState {
  clipId: string | null;
  wordIndex: number | null;
  text: string;
}

export const ClipBasedTranscript: React.FC<ClipBasedTranscriptProps> = ({ mode, fontSettings, clipsHook: externalClipsHook, onDeletedWordsChange }) => {
  const { state: audioState } = useAudio();
  const { state: projectState, actions: projectActions } = useProject();
  const { selectedJob } = useSelectedJob();
  const transcriptRef = useRef<HTMLDivElement>(null);
  
  // Get segments
  const segments: Segment[] = React.useMemo(() => {
    if (selectedJob?.result?.segments) {
      return selectedJob.result.segments;
    } else if (projectState.projectData?.transcription?.segments) {
      return projectState.projectData.transcription.segments;
    }
    return [];
  }, [selectedJob, projectState.projectData]);
  
  // Use external clips hook if provided, otherwise use our own (for backwards compatibility)
  const {
    clips,
    selectedClipId,
    findClipByWordIndex,
    selectClip,
    createNewClip,
    mergeClipWithAbove,
    addNewSpeakerLabel,
    getAdjustedPlaybackTime,
    getOriginalTimeFromAdjusted
  } = externalClipsHook || useClips({
    segments,
    speakerNames: projectState.globalSpeakers,
    setSpeakerNames: (speakers) => projectActions.updateSpeakers(speakers)
  });
  
  // Edit state
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null);
  const [editingWord, setEditingWord] = useState<EditingState>({ clipId: null, wordIndex: null, text: '' });
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [tempSpeakerName, setTempSpeakerName] = useState('');
  const [speakerDropdownOpen, setSpeakerDropdownOpen] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [deletedWords, setDeletedWords] = useState<Set<string>>(new Set()); // Track deleted words by unique ID
  
  // Calculate global word index from clip and local word index
  const getGlobalWordIndex = useCallback((clipId: string, localWordIndex: number): number => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return -1;
    return clip.startWordIndex + localWordIndex;
  }, [clips]);
  
  // Get unique word ID for tracking deletions
  const getWordId = useCallback((clip: Clip, wordIndex: number): string => {
    return `${clip.id}-${wordIndex}`;
  }, []);
  
  // Handle word double-click for editing
  const handleWordDoubleClick = useCallback((clip: Clip, wordIndex: number) => {
    console.log('Double-click on word in clip:', clip.id, 'word index:', wordIndex);
    setEditingWord({
      clipId: clip.id,
      wordIndex,
      text: clip.words[wordIndex]?.word || ''
    });
  }, []);
  
  // Handle word edit save
  const handleWordEditSave = useCallback(() => {
    if (editingWord.clipId && editingWord.wordIndex !== null && editingWord.text.trim()) {
      const globalWordIndex = getGlobalWordIndex(editingWord.clipId, editingWord.wordIndex);
      if (globalWordIndex >= 0) {
        // Find the actual segment and word to update
        let runningIndex = 0;
        const newSegments = [...segments];
        
        for (let segIndex = 0; segIndex < newSegments.length; segIndex++) {
          const segment = newSegments[segIndex];
          if (segment.words) {
            for (let wordIdx = 0; wordIdx < segment.words.length; wordIdx++) {
              if (runningIndex === globalWordIndex) {
                newSegments[segIndex].words[wordIdx].word = editingWord.text.trim();
                projectActions.updateSegments(newSegments);
                break;
              }
              runningIndex++;
            }
          } else {
            runningIndex++;
          }
        }
      }
    }
    setEditingWord({ clipId: null, wordIndex: null, text: '' });
  }, [editingWord, segments, projectActions, getGlobalWordIndex]);
  
  // Handle word right-click for context menu
  const handleWordRightClick = useCallback((
    event: React.MouseEvent,
    clip: Clip,
    wordIndex: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    
    const word = clip.words[wordIndex];
    const globalWordIndex = getGlobalWordIndex(clip.id, wordIndex);
    
    console.log('Right-click on word:', word, 'in clip:', clip.id);
    
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      wordData: {
        word,
        wordIndex,
        clipId: clip.id,
        globalWordIndex
      }
    });
  }, [getGlobalWordIndex]);
  
  // Handle word deletion (strikethrough)
  const handleWordDelete = useCallback((clip: Clip, wordIndex: number) => {
    const wordId = getWordId(clip, wordIndex);
    setDeletedWords(prev => {
      const newSet = new Set([...prev, wordId]);
      onDeletedWordsChange?.(newSet);
      return newSet;
    });
  }, [getWordId, onDeletedWordsChange]);
  
  // Handle word restore (remove strikethrough)
  const handleWordRestore = useCallback((clip: Clip, wordIndex: number) => {
    const wordId = getWordId(clip, wordIndex);
    setDeletedWords(prev => {
      const newSet = new Set(prev);
      newSet.delete(wordId);
      onDeletedWordsChange?.(newSet);
      return newSet;
    });
  }, [getWordId, onDeletedWordsChange]);
  
  // Handle speaker click to show dropdown
  const handleSpeakerClick = useCallback((clipId: string, currentSpeaker: string) => {
    console.log('Speaker clicked for clip:', clipId, 'current speaker:', currentSpeaker);
    setSpeakerDropdownOpen(clipId);
    setEditingSpeaker(null); // Close any text editing
  }, []);

  // Handle speaker change for a specific clip
  const handleSpeakerChange = useCallback((clipId: string, newSpeakerId: string) => {
    console.log('Changing speaker for clip', clipId, 'to', newSpeakerId);
    
    // Find the clip and update its speaker in the underlying segments
    const clip = clips.find(c => c.id === clipId);
    if (!clip) {
      console.error('Clip not found:', clipId);
      return;
    }

    // Update the segments that correspond to this clip's word range
    const newSegments = [...segments];
    let runningWordIndex = 0;
    
    for (let segIndex = 0; segIndex < newSegments.length; segIndex++) {
      const segment = newSegments[segIndex];
      const segmentWordCount = segment.words?.length || 1;
      const segmentEndIndex = runningWordIndex + segmentWordCount - 1;
      
      // Check if this segment overlaps with the clip's word range
      const clipStartIndex = clip.startWordIndex;
      const clipEndIndex = clip.endWordIndex;
      
      if (segmentEndIndex >= clipStartIndex && runningWordIndex <= clipEndIndex) {
        // This segment overlaps with the clip, update its speaker
        newSegments[segIndex].speaker = newSpeakerId;
        console.log('Updated segment', segIndex, 'speaker to', newSpeakerId);
      }
      
      runningWordIndex += segmentWordCount;
    }
    
    // Update the project state with new segments
    projectActions.updateSegments(newSegments);
    setSpeakerDropdownOpen(null);
  }, [clips, segments, projectActions]);
  
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
  
  // Handle paragraph break / clip creation
  const handleCreateClip = useCallback((clip: Clip, wordIndex: number) => {
    const globalWordIndex = getGlobalWordIndex(clip.id, wordIndex);
    console.log('Creating new clip at global word index:', globalWordIndex);
    
    if (globalWordIndex >= 0) {
      const success = createNewClip(globalWordIndex);
      if (success) {
        console.log('Successfully created new clip');
      }
    }
  }, [getGlobalWordIndex, createNewClip]);

  // Handle merge with previous clip
  const handleMergeWithAbove = useCallback((clipId: string) => {
    console.log('Merging clip with above:', clipId);
    
    if (mergeClipWithAbove) {
      const success = mergeClipWithAbove(clipId);
      if (success) {
        console.log('Successfully merged clips');
      } else {
        console.log('Failed to merge clips');
      }
    }
  }, [mergeClipWithAbove]);
  
  // Context menu items
  const contextMenuItems = React.useMemo(() => {
    const wordData = contextMenu.wordData;
    if (!wordData) return [];
    
    const wordId = getWordId(clips.find(c => c.id === wordData.clipId)!, wordData.wordIndex);
    const isDeleted = deletedWords.has(wordId);
    
    return [
      {
        label: "Edit Word",
        icon: "✏️",
        action: () => {
          const clip = clips.find(c => c.id === wordData.clipId);
          if (clip) {
            handleWordDoubleClick(clip, wordData.wordIndex);
          }
          setContextMenu({ visible: false, x: 0, y: 0 });
        }
      },
      {
        label: isDeleted ? "Restore Word" : "Delete Word",
        icon: isDeleted ? "↩️" : "🗑️",
        action: () => {
          const clip = clips.find(c => c.id === wordData.clipId);
          if (clip) {
            if (isDeleted) {
              handleWordRestore(clip, wordData.wordIndex);
            } else {
              handleWordDelete(clip, wordData.wordIndex);
            }
          }
          setContextMenu({ visible: false, x: 0, y: 0 });
        }
      },
      { label: "", isSeparator: true },
      {
        label: "Create Clip Here",
        icon: "✂️",
        action: () => {
          const clip = clips.find(c => c.id === wordData.clipId);
          if (clip) {
            handleCreateClip(clip, wordData.wordIndex);
          }
          setContextMenu({ visible: false, x: 0, y: 0 });
        }
      }
    ];
  }, [contextMenu.wordData, clips, deletedWords, getWordId, handleWordDoubleClick, handleWordDelete, handleWordRestore, handleCreateClip]);
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingWord.clipId || editingSpeaker) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (editingWord.clipId) handleWordEditSave();
          if (editingSpeaker) handleSpeakerEditSave();
        } else if (e.key === 'Escape') {
          setEditingWord({ clipId: null, wordIndex: null, text: '' });
          setEditingSpeaker(null);
          setTempSpeakerName('');
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingWord, editingSpeaker, handleWordEditSave, handleSpeakerEditSave]);
  
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
  
  // Get available speakers for dropdown
  const availableSpeakers = React.useMemo(() => {
    const speakers: Array<{id: string, name: string}> = [];
    
    // Add all known speakers from globalSpeakers
    if (projectState.globalSpeakers) {
      Object.entries(projectState.globalSpeakers).forEach(([id, name]) => {
        speakers.push({ id, name });
      });
    }
    
    // If no speakers found, add the current speakers from clips as fallback
    if (speakers.length === 0) {
      const uniqueSpeakers = new Set<string>();
      clips.forEach(clip => {
        if (clip.speaker && !uniqueSpeakers.has(clip.speaker)) {
          uniqueSpeakers.add(clip.speaker);
          speakers.push({ 
            id: clip.speaker, 
            name: projectState.globalSpeakers?.[clip.speaker] || clip.speaker 
          });
        }
      });
    }
    
    console.log('Available speakers for dropdown:', speakers);
    return speakers;
  }, [projectState.globalSpeakers, clips]);

  console.log('=== ClipBasedTranscript Debug ===');
  console.log('Segments:', segments.length, segments.slice(0, 2));
  console.log('Clips from useClips:', clips.length, clips);
  console.log('Selected clip ID:', selectedClipId);
  console.log('Speaker names:', projectState.globalSpeakers);
  console.log('Available speakers for dropdown:', availableSpeakers);
  console.log('===============================');
  
  console.log('🎨 === RENDERING TRANSCRIPT ===');
  console.log('Total clips to render:', clips.length);
  console.log('Clips details:', clips.map(c => ({ id: c.id, type: c.type, wordsLength: c.words.length, startWordIndex: c.startWordIndex, endWordIndex: c.endWordIndex })));
  console.log('🎨 ==============================');

  return (
    <main className="flex-1 p-8 bg-white font-transcript overflow-y-auto" ref={transcriptRef}>
      <div className="max-w-4xl mx-auto">
        {clips.map((clip, clipIndex) => {
          console.log(`🎨 Rendering clip ${clipIndex + 1}/${clips.length}:`, { id: clip.id, type: clip.type, words: clip.words.length });
          return (
          <div 
            key={clip.id} 
            className={`mb-12 p-6 border-l-4 rounded-r-lg shadow-sm ${selectedClipId === clip.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} ${clip.type === 'user-created' ? 'bg-green-50 border-green-400' : 'bg-white'}`}
            onClick={() => selectClip(clip.id)}
          >
            {/* Clip header with speaker and controls */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 relative">
                {speakerDropdownOpen === clip.id ? (
                  <div className="relative">
                    <select
                      value={clip.speaker}
                      onChange={(e) => {
                        handleSpeakerChange(clip.id, e.target.value);
                        setSpeakerDropdownOpen(null);
                      }}
                      onBlur={(e) => {
                        // Use setTimeout to allow click events on options to fire first
                        setTimeout(() => {
                          setSpeakerDropdownOpen(null);
                        }, 200);
                      }}
                      className="text-sm font-semibold text-blue-600 uppercase tracking-wide bg-blue-50 border border-blue-300 rounded px-2 py-1 outline-none"
                      autoFocus
                    >
                      {availableSpeakers.map(speaker => (
                        <option key={speaker.id} value={speaker.id}>
                          {speaker.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span
                    className="text-sm font-semibold text-blue-600 uppercase tracking-wide cursor-pointer hover:underline hover:bg-blue-50 px-2 py-1 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeakerClick(clip.id, clip.speaker);
                    }}
                  >
                    {projectState.globalSpeakers?.[clip.speaker] || clip.speaker}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {new Date(clip.startTime * 1000).toISOString().substr(14, 5)} - {new Date(clip.endTime * 1000).toISOString().substr(14, 5)}
                </span>
              </div>
              {clipIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMergeWithAbove(clip.id);
                  }}
                  className="text-xs px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded text-orange-700"
                  title="Merge with clip above"
                >
                  ↑ Merge
                </button>
              )}
            </div>
            
            {/* Clip content - editable words */}
            <div 
              className="leading-[1.4] text-gray-900"
              style={{
                fontFamily: fontSettings?.fontFamily || 'Avenir',
                fontSize: `${fontSettings?.fontSize || 35}px`
              }}
              contentEditable={mode === 'edit' && !editingWord.clipId && !editingSpeaker}
              suppressContentEditableWarning={true}
              onKeyDown={(e) => {
                console.log('=== KeyDown Event ===');
                console.log('Key pressed:', e.key);
                console.log('Clip ID:', clip.id);
                console.log('Event target:', e.target);
                console.log('contentEditable enabled:', mode === 'edit' && !editingWord.clipId && !editingSpeaker);
                
                if (e.key === 'Enter') {
                  e.preventDefault();
                  console.log('🚀 ENTER KEY PRESSED - Creating clip');
                  console.log('Current clip words:', clip.words.length);
                  
                  // Get actual cursor position within the clip
                  const selection = window.getSelection();
                  let splitPosition = Math.floor(clip.words.length / 2); // Default to middle
                  
                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    console.log('Selection range:', range);
                    
                    // Find which word the cursor is positioned at
                    let wordIndex = 0;
                    const container = range.startContainer;
                    const offset = range.startOffset;
                    
                    console.log('Cursor container:', container);
                    console.log('Cursor offset:', offset);
                    
                    // If cursor is in a text node, find the corresponding word
                    if (container.nodeType === Node.TEXT_NODE) {
                      const textContent = container.textContent || '';
                      console.log('Text content at cursor:', textContent);
                      console.log('Text before cursor:', textContent.substring(0, offset));
                      
                      // Count words before the cursor position
                      const textBeforeCursor = textContent.substring(0, offset);
                      const wordsBeforeCursor = textBeforeCursor.trim().split(/\s+/).filter(w => w.length > 0);
                      
                      // Find this text node within the clip
                      const clipElement = e.currentTarget;
                      const allTextNodes: Text[] = [];
                      
                      function getTextNodes(node: Node) {
                        if (node.nodeType === Node.TEXT_NODE) {
                          allTextNodes.push(node as Text);
                        } else {
                          for (let i = 0; i < node.childNodes.length; i++) {
                            getTextNodes(node.childNodes[i]);
                          }
                        }
                      }
                      
                      getTextNodes(clipElement);
                      
                      // Find the position of our text node
                      let totalWordsBeforeThisNode = 0;
                      for (const textNode of allTextNodes) {
                        if (textNode === container) {
                          break;
                        }
                        const nodeText = textNode.textContent || '';
                        const nodeWords = nodeText.trim().split(/\s+/).filter(w => w.length > 0);
                        totalWordsBeforeThisNode += nodeWords.length;
                      }
                      
                      splitPosition = totalWordsBeforeThisNode + wordsBeforeCursor.length;
                      console.log('Calculated split position:', splitPosition, 'out of', clip.words.length);
                      
                      // Ensure split position is within bounds
                      splitPosition = Math.max(0, Math.min(splitPosition, clip.words.length - 1));
                    }
                  }
                  
                  console.log('Split position:', splitPosition);
                  
                  // Find cursor position and create clip
                  const result = handleCreateClip(clip, splitPosition);
                  console.log('Create clip result:', result);
                }
                console.log('===================');
              }}
            >
              {clip.words.map((word, wordIndex) => {
                const isEditing = editingWord.clipId === clip.id && editingWord.wordIndex === wordIndex;
                const wordId = getWordId(clip, wordIndex);
                const isDeleted = deletedWords.has(wordId);
                
                return (
                  <React.Fragment key={`${clip.id}-${wordIndex}`}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingWord.text}
                        onChange={(e) => setEditingWord(prev => ({ ...prev, text: e.target.value }))}
                        onBlur={handleWordEditSave}
                        className="inline-block border-b-2 border-blue-500 outline-none bg-transparent"
                        style={{ 
                          width: `${editingWord.text.length + 1}ch`,
                          fontFamily: fontSettings?.fontFamily || 'Avenir',
                          fontSize: `${fontSettings?.fontSize || 35}px`
                        }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`
                          cursor-pointer hover:bg-blue-100 transition-colors rounded px-1
                          ${mode === 'edit' ? 'hover:underline' : ''}
                          ${isDeleted ? 'line-through text-gray-400 opacity-60' : ''}
                        `}
                        onDoubleClick={() => handleWordDoubleClick(clip, wordIndex)}
                        onContextMenu={(e) => handleWordRightClick(e, clip, wordIndex)}
                        data-word-id={wordId}
                        title={isDeleted ? 'Deleted word (right-click to restore)' : undefined}
                      >
                        {word.word}
                      </span>
                    )}
                    {' '}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
        })}
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

export default ClipBasedTranscript;